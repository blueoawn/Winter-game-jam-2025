import { Scene } from 'phaser';
import { PlayerController } from "../gameObjects/Characters/PlayerController.ts";
import { EnemyController } from "../gameObjects/NPC/EnemyController.ts";
import { LizardWizard } from "../gameObjects/Characters/LizardWizard.ts";
import { SwordAndBoard } from "../gameObjects/Characters/SwordAndBoard.ts";
import { CheeseTouch } from "../gameObjects/Characters/CheeseTouch.ts";
import { BigSword } from "../gameObjects/Characters/BigSword.ts";
import { BoomStick } from "../gameObjects/Characters/BoomStick.ts";
import { ButtonMapper } from "../../managers/ButtonMapper.ts";
import { Railgun } from '../gameObjects/Characters/Railgun.ts';
import Tilemap = Phaser.Tilemaps.Tilemap;
import Sprite = Phaser.GameObjects.Sprite;
import TilemapLayer = Phaser.Tilemaps.TilemapLayer;
import Text = Phaser.GameObjects.Text;
import Group = Phaser.GameObjects.Group;
import CursorKeys = Phaser.Types.Input.Keyboard.CursorKeys;

import ANIMATION from '../animation.ts';
import ASSETS from '../assets.ts';
import EnemyBullet from "../gameObjects/Projectile/EnemyBullet.ts";
import Wall from "../gameObjects/Wall.ts";
import TimerEvent = Phaser.Time.TimerEvent;
import EnemyFlying from "../gameObjects/NPC/EnemyFlying.ts";
import { Spawner } from "../gameObjects/Spawner.ts";
import NetworkManager from '../../managers/NetworkManager.ts';
import { DeltaDeserializer } from '../../network/DeltaDeserializer';
import { updateHost, updateClient } from '../../network/MultiplayerUpdates';
import { applyDeltaState } from '../../network/Sync';
import { PlayerManager } from '../../managers/MultiplayerManager.ts';
import { SceneManager } from '../../managers/SceneManager.ts';
import * as LevelManager from '../../managers/LevelManager.ts';
import Rectangle = Phaser.GameObjects.Rectangle;
import { MapData } from '../maps/SummonerRift';
import { getDefaultMap, getMapById } from '../maps/MapRegistry';
import { audioManager } from '../../managers/AudioManager';
import { CharacterIdsEnum, CharacterNamesEnum } from "../gameObjects/Characters/CharactersEnum.ts";
import {
    initVariables,
    initBackground,
    initWorldBounds,
    initCamera,
    initGameUi,
    initAnimations,
    initInput,
    initPhysics
} from '../init';


export class GameScene extends Scene
{
    score: number;
    centreX: number;
    centreY: number;
    tiles: number[];
    gameStarted: boolean = false;
    player: Sprite;
    spawnEnemyCounter: number;
    tileSize: number;
    mapOffset: number;
    mapTop: number;
    mapHeight: number;
    mapWidth: number;
    scrollSpeed: number;
    scrollMovement: number;
    map: Tilemap
    groundLayer: TilemapLayer | null;
    tutorialText: Text;
    scoreText: Text;
    gameOverText: Text;
    enemyGroup: Group;
    enemyBulletGroup: Group;
    playerBulletGroup: Group;
    enemyBulletDestroyersGroup: Group;
    wallGroup: Group;
    cursors?: CursorKeys;
    timedEvent: TimerEvent;

    // Network properties
    networkEnabled: boolean = false;
    isHost: boolean = false;
    players: string[] = [];
    playerManager: PlayerManager | null = null;
    buttonMapper: ButtonMapper | null = null;
    stateSyncRate: number;
    lastStateSyncTime: number;
    inputSendRate: number;
    lastInputSendTime: number;
    tick: number;
    syncedEnemyBullets: Map<string, EnemyBullet> = new Map();  // Track network-synced enemy bullets
    syncedEnemies: Map<string, EnemyFlying> = new Map();  // Track network-synced enemies
    syncedWalls: Map<string, Wall> = new Map();  // Track network-synced walls
    enemyBulletIdCache: Set<string> = new Set();  // Reusable Set for enemy bullet ID tracking
    enemyIdCache: Set<string> = new Set();  // Reusable Set for enemy ID tracking
    currentMap: MapData;  // Current active map data
    spawners: Spawner[] = [];  // Enemy spawners for current map
    deltaDeserializer: DeltaDeserializer = new DeltaDeserializer();  // Delta reconstruction
    lastReceivedTick: number = 0;  // Track last received tick for desync detection

    constructor ()
    {
        super('GameScene');
    }

    init(data: any): void {
        // Receive data from CharacterSelect scene
        this.networkEnabled = data?.networkEnabled || false;
        this.isHost = data?.isHost || false;
        this.players = data?.players || [];

        // Store selected character ID
        (this as any).selectedCharacterId = data?.characterId || 'lizard-wizard';

        console.log('Game initialized:', {
            networkEnabled: this.networkEnabled,
            isHost: this.isHost,
            players: this.players,
            characterId: (this as any).selectedCharacterId
        });
    }

    create ()
    {
        try {
            // Initialize audio manager
            audioManager.init(this);

            // Load current map (default to Summoners Rift)
            this.currentMap = getDefaultMap();

            // Initialize variables using extracted init function
            const vars = initVariables(this, this.currentMap);
            this.score = vars.score;
            this.centreX = vars.centreX;
            this.centreY = vars.centreY;
            this.tileSize = vars.tileSize;
            this.mapOffset = vars.mapOffset;
            this.mapTop = vars.mapTop;
            this.mapHeight = vars.mapHeight;
            this.mapWidth = vars.mapWidth;
            this.spawnEnemyCounter = vars.spawnEnemyCounter;
            this.stateSyncRate = vars.stateSyncRate;
            this.inputSendRate = vars.inputSendRate;
            this.tick = vars.tick;
            this.lastStateSyncTime = 0;
            this.lastInputSendTime = 0;
            this.tiles = [50, 50, 50, 50, 50, 50, 50, 50, 50, 110, 110, 110, 110, 110, 50, 50, 50, 50, 50, 50, 50, 50, 50, 110, 110, 110, 110, 110, 36, 48, 60, 72, 84];

            // Initialize scene UI
            initBackground(this, this.currentMap);
            const ui = initGameUi(this);
            this.tutorialText = ui.tutorialText;
            this.scoreText = ui.scoreText;
            this.gameOverText = ui.gameOverText;

            initAnimations(this);

            // Initialize ButtonMapper for input
            this.buttonMapper = new ButtonMapper(this);

            // Set world bounds before creating players
            initWorldBounds(this, this.currentMap);

            // Create player(s) based on game mode
            if (this.networkEnabled) {
                this.initMultiplayer();
            } else {
                this.initSinglePlayer();
            }

            initInput(this);
            initPhysics(this);

            // Create all game object groups BEFORE using them in Level Manager
            this.enemyGroup = this.add.group();
            this.enemyBulletGroup = this.add.group();
            this.playerBulletGroup = this.add.group();
            this.enemyBulletDestroyersGroup = this.add.group();
            this.wallGroup = this.add.group();

            // Set up multiplayer wall collisions after physics is initialized
            if (this.networkEnabled) {
                this.setupMultiplayerWallCollisions();
            }

            this.initSpawners();  // Initialize enemy spawners from map config
            this.initWalls();     // Initialize walls from map config

            // Setup camera after players are created
            const playerToFollow = this.networkEnabled ? this.playerManager?.getLocalPlayer() : this.player;
            initCamera(this, this.currentMap, playerToFollow || undefined);

            // Auto-start for now
            this.startGame();
        } catch (error) {
            console.error('Fatal error in Game.create():', error);
            console.error('Stack:', (error as any).stack);
        }
    }

    update() {
        if (!this.gameStarted) return;

        if (this.networkEnabled) {
            this.updateMultiplayer();
        } else {
            this.updateSinglePlayer();
        }

    }

    initSinglePlayer() {
        // Create single player with selected character
        const characterId = (this as any).selectedCharacterId || 'lizard-wizard';
        const characterType = this.getCharacterType(characterId);

        // Use default spawn point from current map
        const spawn = this.currentMap.spawnPoints.default;

        switch (characterType) {
            case CharacterNamesEnum.BigSword:
                this.player = new BigSword(this, spawn.x, spawn.y);
                break;
            case CharacterNamesEnum.SwordAndBoard:
                this.player = new SwordAndBoard(this, spawn.x, spawn.y);
                break;
            case CharacterNamesEnum.CheeseTouch:
                this.player = new CheeseTouch(this, spawn.x, spawn.y);
                break;
            case CharacterNamesEnum.BoomStick:
                this.player = new BoomStick(this, spawn.x, spawn.y);
                break;
            case CharacterNamesEnum.Railgun:
                this.player = new Railgun(this,spawn.x,spawn.y);
                break;
            case CharacterNamesEnum.LizardWizard:
            default:
                this.player = new LizardWizard(this, spawn.x, spawn.y);
        }

        (this.player as any).isLocal = true;
        this.playerManager = null;
    }

    getCharacterType(characterId: string): CharacterNamesEnum {
        switch (characterId) {
            case CharacterIdsEnum.BigSword:
                return CharacterNamesEnum.BigSword;
            case CharacterIdsEnum.SwordAndBoard:
                return CharacterNamesEnum.SwordAndBoard;
            case CharacterIdsEnum.CheeseTouch:
                return CharacterNamesEnum.CheeseTouch;
            case CharacterIdsEnum.BoomStick:
                return CharacterNamesEnum.BoomStick;
            case CharacterIdsEnum.Railgun:
                return CharacterNamesEnum.Railgun;
            case CharacterIdsEnum.LizardWizard:
            default:
                return CharacterNamesEnum.LizardWizard;
        }
    }

    /**
     * Load a new map by ID
     * This method can be used in the future to transition between maps
     * @param mapId The ID of the map to load (e.g., 'summoners-rift')
     * @returns True if map was loaded, false if not found
     */
    loadMap(mapId: string): boolean {
        const newMap = getMapById(mapId);
        if (!newMap) {
            console.error(`Map not found: ${mapId}`);
            return false;
        }

        this.currentMap = newMap;
        console.log(`Loaded map: ${newMap.name} (${newMap.id})`);

        // Clear existing spawners on map transition
        // Note: To fully transition to a new map:
        // 0. Clear existing spawners
        // 1. Clear existing game objects (enemies, bullets, etc.)
        // 2. Update world bounds via initWorldBounds()
        // 3. Update camera bounds via initCamera()
        // 4. Respawn players at new spawn points
        // 5. Reload the background via initBackground()
        // This is left for future implementation when map transitions are needed, for now we just load at start. 

        return true;
    }

    initMultiplayer() {
        // Create PlayerManager
        this.playerManager = new PlayerManager(this);

        // Create all players with character assignments
        const localPlayerId = NetworkManager.getPlayerId();
        
        if (!this.players || this.players.length === 0) {
            console.error('Error: No players array provided for multiplayer game!', {
                players: this.players,
                localPlayerId: localPlayerId
            });
            // Fall back to at least creating local player
            if (localPlayerId) {
                const characterType = Object.values(CharacterNamesEnum)[0];
                this.playerManager!.createPlayer(localPlayerId, true, characterType);
            }
            return;
        }

        // Get character selections from network storage
        const storage = NetworkManager.getStorage();
        const characterSelections = storage?.characterSelections || {};

        this.players.forEach((playerId) => {
            const isLocal = (playerId === localPlayerId);
            
            // Get the character ID for this player from storage
            let characterType: CharacterNamesEnum | undefined;
            const selection = characterSelections[playerId];
            
            if (selection && selection.characterId) {
                // Map character ID to enum value
                const charIdMap: {[key: string]: CharacterNamesEnum} = {
                    'lizard-wizard': CharacterNamesEnum.LizardWizard,
                    'sword-and-board': CharacterNamesEnum.SwordAndBoard,
                    'cheese-touch': CharacterNamesEnum.CheeseTouch,
                    'big-sword': CharacterNamesEnum.BigSword,
                    'boom-stick': CharacterNamesEnum.BoomStick,
                    'rail-gun': CharacterNamesEnum.Railgun,
                };
                characterType = charIdMap[selection.characterId];
            }
            
            // Fall back to first character if not found
            if (!characterType) {
                characterType = Object.values(CharacterNamesEnum)[0];
                console.warn(`Character selection not found for ${playerId}, using ${characterType}`);
            }

            try {
                this.playerManager!.createPlayer(playerId, isLocal, characterType);
            } catch (err) {
                console.error(`Error creating player ${playerId}:`, err);
            }
        });

        // Set up network message handlers
        this.setupNetworkHandlers();

        console.log(`Multiplayer initialized - Host: ${this.isHost}, Players: ${this.players.length}`);
    }

    setupMultiplayerWallCollisions() {
        if (!this.playerManager) return;

        // Add wall collision for each multiplayer player
        this.playerManager.getAllPlayers().forEach(player => {
            this.physics.add.collider(player, this.wallGroup);
        });
    }

    setupNetworkHandlers() {
        //console.log('[NETWORK] Setting up network handlers'); //Debug
        
        // ALL clients listen for delta state updates from the server (server is source of truth)
        NetworkManager.onStorageKey('lastStateDelta', (delta: any) => {
            //console.log(`[NETWORK] Storage listener fired for lastStateDelta`); //Debug
            if (delta) {
                applyDeltaState(this, delta);
            }
        });

        // All clients listen for player inputs to validate their own input was received
        NetworkManager.onStorageKey('inputs', () => {
            // Could use this for input validation/feedback, but not for game logic
            // Game logic comes from server deltas only
        });
    }

    updateSinglePlayer() {
        if (!this.player || !this.buttonMapper) return;

        // Increment tick counter for spawner timing (same as multiplayer)
        this.tick++;

        // Get input from ButtonMapper
        const input = this.buttonMapper.getInput();

        // Process input
        (this.player as PlayerController).processInput(input);

        // Store for potential network serialization - might use this for debugging
        (this.player as PlayerController).storeInputForNetwork(input);

        if ((this.player as any).update) {
            (this.player as any).update();
        }

        this.updateSpawners();
    }

    updateMultiplayer() {
        this.tick++;

        if (this.isHost) {
            this.updateHost();
        } else {
            this.updateClient();
        }
    }

    //TODO - refactored: use updateHost/updateClient from MultiplayerUpdates.ts
    updateHost() {
        updateHost(this, this.playerManager, this.buttonMapper);
    }

    // Can probably be refactored
    updateClient() {
        updateClient(this, this.playerManager, this.buttonMapper);
    }



    initGameUi() {
        // Create tutorial text
        this.tutorialText = this.add.text(this.centreX, this.centreY, 'Tap to shoot!', {
            fontFamily: 'Arial Black', fontSize: 42, color: '#ffffff',
            stroke: '#000000', strokeThickness: 8,
            align: 'center'
        })
            .setOrigin(0.5)
            .setDepth(100)
            .setScrollFactor(0);  // Fix to camera viewport

        // Create score text
        this.scoreText = this.add.text(20, 20, 'Score: 0', {
            fontFamily: 'Arial Black', fontSize: 28, color: '#ffffff',
            stroke: '#000000', strokeThickness: 8,
        })
            .setDepth(100)
            .setScrollFactor(0);  // Fix to camera viewport

        // Create game over text
        this.gameOverText = this.add.text(this.scale.width * 0.5, this.scale.height * 0.5, 'Game Over', {
            fontFamily: 'Arial Black', fontSize: 64, color: '#ffffff',
            stroke: '#000000', strokeThickness: 8,
            align: 'center'
        })
            .setOrigin(0.5)
            .setDepth(100)
            .setVisible(false)
            .setScrollFactor(0);  // Fix to camera viewport
    }

    initAnimations() {
        // Only create animation if it doesn't already exist (prevents error on scene restart)
        if (!this.anims.exists(ANIMATION.explosion.key)) {
            this.anims.create({
                key: ANIMATION.explosion.key,
                frames: this.anims.generateFrameNumbers(ANIMATION.explosion.texture, ANIMATION.explosion.config),
                frameRate: ANIMATION.explosion.frameRate,
                repeat: ANIMATION.explosion.repeat
            });
        }
    }

    initPhysics() {
        // Groups are now created earlier in create() before LevelManager functions use them
        
        // Only set up collisions for single player mode
        if (!this.networkEnabled && this.player) {
            // This overlap should come before checking if the bullet hit the player
            this.physics.add.overlap(
                this.enemyBulletDestroyersGroup,
                this.enemyBulletGroup,
                this.destroyEnemyBullet as () => void,
                undefined,
                this
            );
            this.physics.add.overlap(
                this.playerBulletGroup,
                this.enemyGroup,
                this.hitEnemy as () => void,
                undefined,
                this
            );
            this.physics.add.overlap(
                this.player,
                this.enemyBulletGroup,
                this.hitPlayer as () => void,
                undefined,
                this
            );
            this.physics.add.overlap(
                this.player,
                this.enemyGroup,
                this.hitPlayer as () => void,
                undefined,
                this
            );

        }
        // TODO: Set up collisions for multiplayer mode with all players

        // Wall collisions (applies to both single and multiplayer)
        // Players collide with walls (solid collision)
        if (this.player) {
            this.physics.add.collider(this.player, this.wallGroup);
        }

        // Enemies collide with walls (solid collision)
        this.physics.add.collider(this.enemyGroup, this.wallGroup);

        // Player bullets can damage destructible walls
        this.physics.add.overlap(
            this.playerBulletGroup,
            this.wallGroup,
            this.hitWall as () => void,
            undefined,
            this
        );

        // Enemy bullets collide with walls (both types blocked)
        this.physics.add.collider(this.enemyBulletGroup, this.wallGroup, (bullet: any) => {
            this.removeEnemyBullet(bullet);
        });
    }

    /**
     * Initialize spawners from current map configuration
     * Delegates to LevelManager
     */
    initSpawners(): void {
        LevelManager.initSpawners(this);
    }

    /**
     * Initialize walls from current map configuration
     * Delegates to LevelManager
     */
    initWalls(): void {
        LevelManager.initWalls(this);
    }

    /**
     * Update all active spawners 
     * Called every frame from updateHost()
     * Delegates to LevelManager
     */
    updateSpawners(): void {
        LevelManager.updateSpawners(this);
    }

    // initPlayer() removed - now using initSinglePlayer() and initMultiplayer() with character classes

    initInput() {
        this.cursors = this.input.keyboard?.createCursorKeys();

        // check for spacebar press only once
        this.cursors?.space.once('down', () => {
            this.startGame();
        });
    }

    // create tile map data
    initMap() {
        const mapData = [];
        for (let y = 0; y < this.mapHeight; y++) {
            const row = [];

            for (let x = 0; x < this.mapWidth; x++) {
                // randomly choose a tile id from this.tiles
                // weightedPick favours items earlier in the array
                const tileIndex = Phaser.Math.RND.weightedPick(this.tiles);
                row.push(tileIndex);
            }

            mapData.push(row);
        }

        this.map = this.make.tilemap({ data: mapData, tileWidth: this.tileSize, tileHeight: this.tileSize });
        const tileset = this.map.addTilesetImage(ASSETS.spritesheet.tiles.key);
        if (tileset) {
            this.groundLayer = this.map.createLayer(0, tileset, 0, this.mapTop);
        }
    }

    // scroll the tile map
    updateMap() {
        this.scrollMovement += this.scrollSpeed;

        if (this.scrollMovement >= this.tileSize) {
            //  Create new row on top
            let tile;
            let prev;

            // loop through map from bottom to top row
            for (let y = this.mapHeight - 2; y > 0; y--) {
                // loop through map from left to right column
                for (let x = 0; x < this.mapWidth; x++) {
                    tile = this.map.getTileAt(x, y - 1);
                    prev = this.map.getTileAt(x, y);

                    if (prev && tile) {
                        prev.index = tile.index;
                    }

                    if (y === 1 && tile) { // if top row
                        // randomly choose a tile id from this.tiles
                        // weightedPick favours items earlier in the array
                        tile.index = Phaser.Math.RND.weightedPick(this.tiles);
                    }
                }
            }

            this.scrollMovement -= this.tileSize; // reset to 0
        }

        if (this.groundLayer) {
            this.groundLayer.y = this.mapTop + this.scrollMovement; // move one tile up
        }
    }

    startGame() {
        // Delegate to SceneManager for consistent game lifecycle management
        SceneManager.startGameSession(this);
    }

    fireEnemyBullet(x: number, y: number, power: number, targetX?: number, targetY?: number) {
        LevelManager.fireEnemyBullet(this, x, y, power, targetX, targetY);
    }

    removeEnemyBullet(bullet: EnemyBullet) {
        LevelManager.removeEnemyBullet(this, bullet);
    }

    addEnemyBulletDestroyer(destroyer: Rectangle) {
        LevelManager.addEnemyBulletDestroyer(this, destroyer);
    }

    removeEnemyBulletDestroyer(destroyer: Rectangle) {
        LevelManager.removeEnemyBulletDestroyer(this, destroyer);
    }

    addEnemy(shipId: number, pathId: number, speed: number, power: number) {
        return LevelManager.addEnemy(this, shipId, pathId, speed, power);
    }

    addLizardWizardEnemy(x: number, y: number) {
        return LevelManager.addLizardWizardEnemy(this, x, y);
    }

    removeEnemy(enemy: EnemyController) {
        LevelManager.removeEnemy(this, enemy);
    }

    addWall(wall: Wall) {
        LevelManager.addWall(this, wall);
    }

    removeWall(wall: Wall) {
        LevelManager.removeWall(this, wall);
    }

    addExplosion(x: number, y: number) {
        LevelManager.addExplosion(this, x, y);
    }

    hitPlayer(player: PlayerController, obstacle: EnemyBullet) {
        LevelManager.hitPlayer(this, player, obstacle);
    }

    hitEnemy(bullet: any, enemy: EnemyFlying) {
        LevelManager.hitEnemy(this, bullet, enemy);
    }

    hitWall(bullet: any, wall: Wall) {
        LevelManager.hitWall(this, bullet, wall);
    }

    destroyEnemyBullet(_bulletDestroyer: Rectangle, enemyBullet: EnemyBullet) {
        LevelManager.destroyEnemyBullet(this, _bulletDestroyer, enemyBullet);
    }

    updateScore(points: number) {
        this.score += points;
        this.scoreText.setText(`Score: ${this.score}`);
    }

    GameOver() {
        // Delegate to SceneManager for consistent scene transitions
        SceneManager.endGameSession(this);
    }
}
