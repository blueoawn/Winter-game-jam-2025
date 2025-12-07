import { Scene } from 'phaser';
import { PlayerController } from "../gameObjects/Characters/PlayerController.ts";
import { EnemyController } from "../gameObjects/NPC/EnemyController.ts";
import { ButtonMapper } from "../../managers/ButtonMapper.ts";
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
import { DeltaDeserializer } from '../../network/DeltaDeserializer.ts';
import { updateHost, updateClient } from '../../network/MultiplayerUpdates.ts';
import { applyDeltaState } from '../../network/Sync.ts';
import { PlayerManager } from '../../managers/MultiplayerManager.ts';
import { SceneManager } from '../../managers/SceneManager.ts';
import * as LevelManager from '../../managers/LevelManager.ts';
import Rectangle = Phaser.GameObjects.Rectangle;
import { MapData } from '../maps/SummonerRift.ts';
import { getDefaultMap, getMapById } from '../maps/MapRegistry.ts';
import { audioManager } from '../../managers/AudioManager.ts';
import { CharacterIdsEnum, CharacterNamesEnum } from "../gameObjects/Characters/CharactersEnum.ts";
import {
    initVariables,
    initBackground,
    initWorldBounds,
    initCamera,
    initGameUi,
    initAnimations,
    initInput
} from '../init.ts';
import { getCharacterType, createCharacter, CHARACTER_ID_MAP } from '../utils/CharacterFactory.ts';
import * as CollisionManager from '../../managers/CollisionManager.ts';


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
    consumableGroup: Group;
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
    syncedConsumables: Map<string, any> = new Map();  // Track network-synced consumables
    areaBoundaries: any[] = [];  // Static area zones with effects (no network sync)
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

            // Create all game object groups BEFORE using them in Level Manager
            this.enemyGroup = this.add.group();
            this.enemyBulletGroup = this.add.group();
            this.playerBulletGroup = this.add.group();
            this.enemyBulletDestroyersGroup = this.add.group();
            this.wallGroup = this.add.group();
            this.consumableGroup = this.add.group();

            // Set up physics collisions after groups are created
            this.initPhysics();

            // Set up multiplayer wall collisions after physics is initialized
            if (this.networkEnabled) {
                this.setupMultiplayerWallCollisions();
            }

            this.initSpawners();  // Initialize enemy spawners from map config
            this.initWalls();     // Initialize walls from map config
            this.initConsumables(); // Initialize consumable items from map config
            this.initAreaBoundaries(); // Initialize area effect zones from map config

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
        const characterType = getCharacterType(characterId);

        // Use default spawn point from current map
        const spawn = this.currentMap.spawnPoints.default;

        // Create character using factory
        this.player = createCharacter(this, characterType, spawn.x, spawn.y);
        (this.player as any).isLocal = true;
        this.playerManager = null;
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
                characterType = CHARACTER_ID_MAP[selection.characterId];
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
        CollisionManager.setupMultiplayerWallCollisions(this);
    }

    setupNetworkHandlers() {
        console.info('[NETWORK] Setting up network handlers, isHost:', this.isHost);

        // Listen for storage updates to sync state from host
        NetworkManager.onStorageUpdate((storage: any) => {
            if (storage?.lastStateDelta && !this.isHost) {
                console.debug('[NETWORK] Applying state delta, tick:', storage.lastStateDelta.tick);
                applyDeltaState(this, storage.lastStateDelta);
            }
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
        this.updateAreaBoundaries();
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



    // Note: initGameUi and initAnimations are handled by init.ts functions

    initPhysics() {
        // Set up collisions based on game mode
        if (!this.networkEnabled && this.player) {
            CollisionManager.setupSinglePlayerCollisions(this);
        } else if (this.networkEnabled && this.playerManager) {
            // Set up multiplayer damage collisions (player bullets vs enemies, etc.)
            CollisionManager.setupMultiplayerCollisions(this);
        }

        // Set up common collisions for both modes
        CollisionManager.setupCommonCollisions(this);
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
     * Initialize consumables from current map configuration
     * Delegates to LevelManager
     */
    initConsumables(): void {
        LevelManager.initConsumables(this);
    }

    /**
     * Initialize area boundaries from current map configuration
     * Delegates to LevelManager
     */
    initAreaBoundaries(): void {
        LevelManager.initAreaBoundaries(this);
    }

    /**
     * Update all active spawners 
     * Called every frame from updateHost()
     * Delegates to LevelManager
     */
    updateSpawners(): void {
        LevelManager.updateSpawners(this);
    }

    /**
     * Update all area boundaries
     * Called every frame to handle periodic effects
     * Delegates to LevelManager
     */
    updateAreaBoundaries(): void {
        LevelManager.updateAreaBoundaries(this);
    }

    // Note: initInput is handled by init.ts
    // Note: Old tilemap scrolling system (initMap/updateMap) has been removed
    // Maps are now static and loaded from MapRegistry

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

    addEnemyBulletDestroyer(destroyer: Phaser.GameObjects.GameObject) {
        LevelManager.addEnemyBulletDestroyer(this, destroyer);
    }

    removeEnemyBulletDestroyer(destroyer: Phaser.GameObjects.GameObject) {
        LevelManager.removeEnemyBulletDestroyer(this, destroyer);
    }

    addEnemy(shipId: number, pathId: number, speed: number, power: number) {
        return LevelManager.addEnemy(this, shipId, pathId, speed, power);
    }

    addLizardWizardEnemy(x: number, y: number) {
        return LevelManager.addLizardWizardEnemy(this, x, y);
    }
    addSlimeEnemy(x: number, y: number) {
        return LevelManager.addSlimeEnemy(this, x, y);
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

    pickupConsumable(player: any, consumableView: any) {
        LevelManager.pickupConsumable(this, player, consumableView);
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
