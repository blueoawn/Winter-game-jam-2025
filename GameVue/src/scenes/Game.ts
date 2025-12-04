import { Scene } from 'phaser';
import { PlayerController } from "../../managers/PlayerController.ts";
import { LizardWizard } from "../gameObjects/Characters/LizardWizard.ts";
import { SwordAndBoard } from "../gameObjects/Characters/SwordAndBoard.ts";
import { ButtonMapper } from "../../managers/ButtonMapper.ts";
import Tilemap = Phaser.Tilemaps.Tilemap;
import Sprite = Phaser.GameObjects.Sprite;
import TilemapLayer = Phaser.Tilemaps.TilemapLayer;
import Text = Phaser.GameObjects.Text;
import Group = Phaser.GameObjects.Group;
import CursorKeys = Phaser.Types.Input.Keyboard.CursorKeys;

import ANIMATION from '../animation.ts';
import ASSETS from '../assets.ts';
import PlayerBullet from "../gameObjects/PlayerBullet.ts";
import EnemyBullet from "../gameObjects/EnemyBullet.ts";
import TimerEvent = Phaser.Time.TimerEvent;
import EnemyFlying from "../gameObjects/EnemyFlying.ts";
import Explosion from "../gameObjects/Explosion.ts";

import NetworkManager from '../../network/NetworkManager';
import { StateSerializer } from '../../network/StateSerializer';
import { PlayerManager } from '../../managers/MultiplayerManager.ts';
import { BulletPool } from '../../managers/BulletPool.ts';
import Rectangle = Phaser.GameObjects.Rectangle;
import { MapData } from '../maps/SummonerRift';
import { getDefaultMap, getMapById } from '../maps/MapRegistry';


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
    syncedBullets: Map<string, PlayerBullet> = new Map();  // Track network-synced player bullets
    syncedEnemyBullets: Map<string, EnemyBullet> = new Map();  // Track network-synced enemy bullets
    syncedEnemies: Map<string, EnemyFlying> = new Map();  // Track network-synced enemies
    bulletIdCache: Set<string> = new Set();  // Reusable Set for player bullet ID tracking
    enemyBulletIdCache: Set<string> = new Set();  // Reusable Set for enemy bullet ID tracking
    enemyIdCache: Set<string> = new Set();  // Reusable Set for enemy ID tracking
    bulletPool: BulletPool;  // Object pool for efficient bullet management (Phase 2 optimization)
    currentMap: MapData;  // Current active map data

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
        this.initVariables();
        this.initBackground();  // Add Summoners Rift map background
        this.initGameUi();
        this.initAnimations();

        // Initialize ButtonMapper for input
        this.buttonMapper = new ButtonMapper(this);

        // Set world bounds before creating players
        this.initWorldBounds();

        if (this.networkEnabled) {
            this.initMultiplayer();
        } else {
            this.initSinglePlayer();
        }

        this.initInput();
        this.initPhysics();
        // this.initMap();  // DEPRECATED: Tilemap system replaced by image-based background

        // Setup camera after players are created
        this.initCamera();

        // Auto-start for now
        this.startGame();
    }

    update() {
        // Feels good to have a nice background while testing
        // this.updateMap();

        if (!this.gameStarted) return;

        if (this.networkEnabled) {
            this.updateMultiplayer();
        } else {
            this.updateSinglePlayer();
        }

        // Limit enemy spawning in multiplayer to avoid overwhelming network
        const maxActiveEnemies = this.networkEnabled ? 30 : 100;  // Cap at 30 enemies in multiplayer
        const canSpawn = this.enemyGroup.getChildren().length < maxActiveEnemies;

        if (this.spawnEnemyCounter > 0) this.spawnEnemyCounter--;
        else if (canSpawn) this.addFlyingGroup();
    }

    initVariables() {
        // Load current map (default to Summoners Rift)
        this.currentMap = getDefaultMap();

        this.score = 0;
        this.centreX = this.scale.width * 0.5;
        this.centreY = this.scale.height * 0.5;

        // list of tile ids in tiles.png
        // items nearer to the beginning of the array have a higher chance of being randomly chosen when using weighted()
        this.tiles = [50, 50, 50, 50, 50, 50, 50, 50, 50, 110, 110, 110, 110, 110, 50, 50, 50, 50, 50, 50, 50, 50, 50, 110, 110, 110, 110, 110, 36, 48, 60, 72, 84];
        this.tileSize = 32; // width and height of a tile in pixels

        this.mapOffset = 10; // offset (in tiles) to move the map above the top of the screen
        this.mapTop = -this.mapOffset * this.tileSize; // offset (in pixels) to move the map above the top of the screen
        this.mapHeight = Math.ceil(this.scale.height / this.tileSize) + this.mapOffset + 1; // height of the tile map (in tiles)
        this.mapWidth = Math.ceil(this.scale.width / this.tileSize); // width of the tile map (in tiles)
        //this.scrollSpeed = 1; // background scrolling speed (in pixels) DISABLED FOR NOW
        // this.scrollMovement = 0; // current scroll amount DISABLED FOR NOW
        this.spawnEnemyCounter = 0; // timer before spawning next group of enemies

        // Network variables
        this.stateSyncRate = 1000 / 15;  // 15 times per second
        this.lastStateSyncTime = 0;
        this.inputSendRate = 1000 / 30;  // 30 times per second (optimized from 60)
        this.lastInputSendTime = 0;
        this.tick = 0;
    }

    initBackground() {
        // Add background image centered in world
        this.add.image(
            this.currentMap.width / 2,
            this.currentMap.height / 2,
            this.currentMap.assetKey
        )
            .setOrigin(0.5, 0.5)
            .setDepth(0);  // Behind all game objects
    }

    initWorldBounds() {
        // Set physics world bounds to map size
        this.physics.world.setBounds(0, 0, this.currentMap.width, this.currentMap.height);
    }

    initCamera() {
        const camera = this.cameras.main;

        // Set camera bounds to prevent showing black areas
        camera.setBounds(0, 0, this.currentMap.width, this.currentMap.height);

        // Determine which player to follow
        let playerToFollow = null;

        if (this.networkEnabled && this.playerManager) {
            // Multiplayer: Follow local player
            playerToFollow = this.playerManager.getLocalPlayer();
        } else if (this.player) {
            // Single player: Follow the player
            playerToFollow = this.player;
        }

        // Start following with smooth camera
        if (playerToFollow) {
            camera.startFollow(playerToFollow, true, 0.1, 0.1);
        }
    }

    initSinglePlayer() {
        // Create single player with selected character
        const characterId = (this as any).selectedCharacterId || 'lizard-wizard';
        const characterType = this.getCharacterType(characterId);

        // Use default spawn point from current map
        const spawn = this.currentMap.spawnPoints.default;

        if (characterType === 'LizardWizard') {
            this.player = new LizardWizard(this, spawn.x, spawn.y);
        } else {
            this.player = new SwordAndBoard(this, spawn.x, spawn.y);
        }
        (this.player as any).isLocal = true;
        this.playerManager = null;
    }


    //TODO refactor as a switch when we have more characters
    getCharacterType(characterId: string): 'LizardWizard' | 'SwordAndBoard' {
        if (characterId === 'lizard-wizard') {
            return 'LizardWizard';
        } else if (characterId === 'sword-and-board') {
            return 'SwordAndBoard';
        }
        // Default to LizardWizard if unknown
        return 'LizardWizard';
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

        // Note: To fully transition to a new map:
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
        const localPlayerId = NetworkManager.getStats().playerId;
        this.players.forEach((playerId, index) => {
            const isLocal = (playerId === localPlayerId);
            // Player 0 = LizardWizard, Player 1 = SwordAndBoard
            const characterType = (index === 0) ? 'LizardWizard' : 'SwordAndBoard';
            this.playerManager!.createPlayer(playerId, isLocal, characterType, index);
        });

        // Set up network message handlers
        this.setupNetworkHandlers();

        console.log(`Multiplayer initialized - Host: ${this.isHost}, Players: ${this.players.length}`);
    }

    setupNetworkHandlers() {
        // Listen for storage updates (both host and clients)
        NetworkManager.onStorageUpdate((storage: any) => {
            if (this.isHost) {
                // Host reads player inputs from storage
                if (storage.playerInputs) {
                    Object.entries(storage.playerInputs).forEach(([playerId, inputData]: [string, any]) => {
                        // Skip own input (already processed locally)
                        const localPlayerId = NetworkManager.getPlayerId();
                        if (playerId !== localPlayerId) {
                            // inputData has inputState properties spread at top level with timestamp
                            this.playerManager?.applyInput(playerId, inputData);
                        }
                    });
                }
            } else {
                // Clients receive game state from host via storage
                if (storage.gameState) {
                    this.applyNetworkState(storage.gameState);
                }
            }
        });
    }

    updateSinglePlayer() {
        if (!this.player || !this.buttonMapper) return;

        // Get input from ButtonMapper
        const input = this.buttonMapper.getInput();

        // Process input
        (this.player as PlayerController).processInput(input);

        // Store for potential network serialization - might use this for debugging
        (this.player as PlayerController).storeInputForNetwork(input);

        if ((this.player as any).update) {
            (this.player as any).update();
        }
    }

    updateMultiplayer() {
        this.tick++;

        if (this.isHost) {
            this.updateHost();
        } else {
            this.updateClient();
        }
    }

    updateHost() {
        // Process local player input from ButtonMapper
        if (this.buttonMapper && this.playerManager) {
            const localPlayer = this.playerManager.getLocalPlayer();
            if (localPlayer) {
                const input = this.buttonMapper.getInput();
                (localPlayer as PlayerController).processInput(input);
                (localPlayer as PlayerController).storeInputForNetwork(input);
            }
        }

        // Update all players
        this.playerManager?.update();

        // Broadcast state to clients
        const now = Date.now();
        if (now - this.lastStateSyncTime >= this.stateSyncRate) {
            this.broadcastState();
            this.lastStateSyncTime = now;
        }
    }

    updateClient() {
        // Process local player input from ButtonMapper (client-side prediction)
        if (this.buttonMapper && this.playerManager) {
            const localPlayer = this.playerManager.getLocalPlayer();
            if (localPlayer) {
                const input = this.buttonMapper.getInput();
                (localPlayer as PlayerController).processInput(input);
                (localPlayer as PlayerController).storeInputForNetwork(input);
            }
        }

        // Update all players (interpolation happens in player update)
        this.playerManager?.update();

        // Send local input to host
        const now = Date.now();
        if (now - this.lastInputSendTime >= this.inputSendRate) {
            this.sendInputToHost();
            this.lastInputSendTime = now;
        }
    }

    broadcastState() {
        if (!this.playerManager) return;

        // Phase 3: Limit entity counts to prevent "Message too big" errors
        const allEnemies = this.enemyGroup.getChildren();
        const allEnemyBullets = this.enemyBulletGroup.getChildren();

        // Limit enemies to 30 max (should be enough for multiplayer)
        const enemies = allEnemies.length > 30 ? allEnemies.slice(0, 30) : allEnemies;

        // Limit enemy bullets to 50 max (prevent packet overflow)
        const enemyBullets = allEnemyBullets.length > 50 ? allEnemyBullets.slice(0, 50) : allEnemyBullets;

        // Reuse timestamp from rate limiting check to avoid redundant Date.now() calls
        const state = StateSerializer.serialize({
            tick: this.tick,
            players: this.playerManager.getAllPlayers() as any,
            enemies: enemies as any,
            bullets: this.playerBulletGroup.getChildren() as any,
            enemyBullets: enemyBullets as any,  // Limited enemy bullets
            score: this.score,
            scrollMovement: this.scrollMovement,
            spawnEnemyCounter: this.spawnEnemyCounter,
            gameStarted: this.gameStarted
        }, this.lastStateSyncTime);  // Pass timestamp to avoid redundant Date.now()

        // Update game state in storage (will sync to all clients)
        NetworkManager.updateGameState(state);
    }

    sendInputToHost() {
        if (!this.playerManager || !this.buttonMapper) return;

        const localPlayer = this.playerManager.getLocalPlayer();
        if (!localPlayer) return;

        // Get abstract input from ButtonMapper
        const abstractInput = this.buttonMapper.getInput();

        // Convert to network InputState
        const inputState = {
            movementSpeed: (localPlayer as any).characterSpeed,
            velocity: abstractInput.movement,
            rotation: localPlayer.rotation,
            aim: abstractInput.aim,  // Include aim position for firing bullets
            ability1: abstractInput.ability1,
            ability2: abstractInput.ability2
        };

        // Update player input in storage (will sync to host)
        NetworkManager.updatePlayerInput(inputState);
    }
    
    // This function is Work in progress
    applyNetworkState(state: any) {
        // Apply player states
        if (state.players && this.playerManager) {
            this.playerManager.applyPlayerState(state.players);
        }

        // Apply game state
        if (state.gameState) {
            this.score = state.gameState.score;
            this.scrollMovement = state.gameState.scrollMovement;
            this.spawnEnemyCounter = state.gameState.spawnEnemyCounter;
            this.gameStarted = state.gameState.gameStarted;

            this.scoreText.setText(`Score: ${this.score}`);
        }

        // Sync bullets from host
        if (state.bullets && Array.isArray(state.bullets)) {
            // Track which bullets we've seen in this update (reuse Set to avoid allocation)
            this.bulletIdCache.clear();

            state.bullets.forEach((bulletState: any) => {
                this.bulletIdCache.add(bulletState.id);

                // Check if bullet already exists
                let bullet = this.syncedBullets.get(bulletState.id);

                if (!bullet) {
                    // Create new bullet using pool (Phase 2 optimization)
                    // Calculate 'to' position from velocity for constructor
                    const to = {
                        x: bulletState.x + bulletState.velocityX,
                        y: bulletState.y + bulletState.velocityY
                    };

                    bullet = this.bulletPool.acquire(
                        { x: bulletState.x, y: bulletState.y },
                        to,
                        bulletState.power
                    );

                    // Override pool-generated ID with network state ID for sync
                    bullet.id = bulletState.id;

                    this.playerBulletGroup.add(bullet);
                    this.syncedBullets.set(bulletState.id, bullet);
                } else {
                    // Update existing bullet position and velocity
                    bullet.setPosition(bulletState.x, bulletState.y);
                    if (bullet.body) {
                        bullet.body.velocity.x = bulletState.velocityX;
                        bullet.body.velocity.y = bulletState.velocityY;
                    }
                }
            });

            // Remove bullets that are no longer in the state
            this.syncedBullets.forEach((bullet, id) => {
                if (!this.bulletIdCache.has(id)) {
                    // Release to pool instead of destroying (Phase 2 optimization)
                    this.playerBulletGroup.remove(bullet, false, false);
                    this.bulletPool.release(bullet);
                    this.syncedBullets.delete(id);
                }
            });
        }

        // Sync enemy bullets from host
        if (state.enemyBullets && Array.isArray(state.enemyBullets)) {
            this.enemyBulletIdCache.clear();

            state.enemyBullets.forEach((bulletState: any) => {
                this.enemyBulletIdCache.add(bulletState.id);

                // Check if enemy bullet already exists
                let bullet = this.syncedEnemyBullets.get(bulletState.id);

                if (!bullet) {
                    // Create new enemy bullet
                    bullet = new EnemyBullet(
                        this,
                        bulletState.x,
                        bulletState.y,
                        bulletState.power
                    );

                    // Override generated ID with network state ID for sync
                    bullet.id = bulletState.id;

                    // Set velocity from network state
                    if (bullet.body) {
                        bullet.body.velocity.x = bulletState.velocityX;
                        bullet.body.velocity.y = bulletState.velocityY;
                    }

                    this.enemyBulletGroup.add(bullet);
                    this.syncedEnemyBullets.set(bulletState.id, bullet);
                } else {
                    // Update existing enemy bullet position and velocity
                    bullet.setPosition(bulletState.x, bulletState.y);
                    if (bullet.body) {
                        bullet.body.velocity.x = bulletState.velocityX;
                        bullet.body.velocity.y = bulletState.velocityY;
                    }
                }
            });

            // Remove enemy bullets that are no longer in the state
            this.syncedEnemyBullets.forEach((bullet, id) => {
                if (!this.enemyBulletIdCache.has(id)) {
                    this.enemyBulletGroup.remove(bullet, true, true);
                    this.syncedEnemyBullets.delete(id);
                }
            });
        }

        // Sync enemies from host
        if (state.enemies && Array.isArray(state.enemies)) {
            this.enemyIdCache.clear();

            state.enemies.forEach((enemyState: any) => {
                this.enemyIdCache.add(enemyState.id);

                // Check if enemy already exists
                let enemy = this.syncedEnemies.get(enemyState.id);

                if (!enemy) {
                    // Create new enemy (network-synced, so we just need a sprite without path logic)
                    // We'll manually update its position from the host
                    enemy = new EnemyFlying(
                        this,
                        enemyState.shipId,
                        0,  // pathId 0 (will be overridden by network position)
                        0,  // speed 0 (not following path, position synced from host)
                        enemyState.power
                    );

                    // Set ID for tracking
                    (enemy as any).enemyId = enemyState.id;

                    // Disable path following for network-synced enemies
                    (enemy as any).pathIndex = 999;  // Set > 1 to stop path updates (see preUpdate line 44)

                    // Set initial position from network state
                    enemy.setPosition(enemyState.x, enemyState.y);

                    this.enemyGroup.add(enemy);
                    this.syncedEnemies.set(enemyState.id, enemy);
                } else {
                    // Update existing enemy position from host
                    enemy.setPosition(enemyState.x, enemyState.y);
                    (enemy as any).health = enemyState.health;
                }
            });

            // Remove enemies that are no longer in the state
            this.syncedEnemies.forEach((enemy, id) => {
                if (!this.enemyIdCache.has(id)) {
                    enemy.destroy();
                    this.syncedEnemies.delete(id);
                }
            });
        }
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
        this.anims.create({
            key: ANIMATION.explosion.key,
            frames: this.anims.generateFrameNumbers(ANIMATION.explosion.texture, ANIMATION.explosion.config),
            frameRate: ANIMATION.explosion.frameRate,
            repeat: ANIMATION.explosion.repeat
        });
    }

    initPhysics() {
        this.enemyGroup = this.add.group();
        this.enemyBulletGroup = this.add.group();
        this.playerBulletGroup = this.add.group();
        this.enemyBulletDestroyersGroup = this.add.group();

        // Initialize bullet pool (Phase 2 optimization)
        this.bulletPool = new BulletPool(this, 200);  // Pool size: 200 bullets

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
        this.gameStarted = true;
        this.tutorialText.setVisible(false);
        
        //TODO This is broken in multiplayer and I'm working on fixing it. 
        // You can comment it out if you want to just see multiple ships flying around without enemies
        //this.addFlyingGroup(); 
    }

    fireBullet(from: {x: number, y: number}, to: {x: number, y: number}) {
        // Use bullet pool instead of creating new bullets
        const bullet = this.bulletPool.acquire(from, to, 1);
        this.playerBulletGroup.add(bullet);
    }

    removeBullet(bullet: PlayerBullet) {
        // Release bullet back to pool instead of destroying 
        this.playerBulletGroup.remove(bullet, false, false);  // Don't destroy, just remove from group
        this.bulletPool.release(bullet);
    }

    fireEnemyBullet(x: number, y: number, power: number) {
        const bullet = new EnemyBullet(this, x, y, power);
        this.enemyBulletGroup.add(bullet);
    }

    removeEnemyBullet(bullet: EnemyBullet) {
        this.enemyBulletGroup.remove(bullet, true, true);
    }

    addEnemyBulletDestroyer(destroyer: Rectangle) {
        this.enemyBulletDestroyersGroup.add(destroyer);
    }

    removeEnemyBulletDestroyer(destroyer: Rectangle) {
        this.playerBulletGroup.remove(destroyer, true, true);
    }

    // add a group of flying enemies
    // TODO FIX for Bluepawn: This function is currently broken in multiplayer mode, will be reworked significantly if not outright removed
    addFlyingGroup() {
        this.spawnEnemyCounter = Phaser.Math.RND.between(5, 8) * 60; // spawn next group after x seconds
        const randomId = Phaser.Math.RND.between(0, 11); // id to choose image in tiles.png

        // Reduce enemy count in multiplayer to avoid network/performance issues
        const maxEnemies = this.networkEnabled ? 8 : 15;  // Limit to 8 in multiplayer, 15 in single player
        const minEnemies = this.networkEnabled ? 3 : 5;   // Reduce minimum in multiplayer
        const randomCount = Phaser.Math.RND.between(minEnemies, maxEnemies);

        const randomInterval = Phaser.Math.RND.between(8, 12) * 100; // delay between spawning of each enemy
        const randomPath = Phaser.Math.RND.between(0, 3); // choose a path, a group follows the same path
        const randomPower = Phaser.Math.RND.between(1, 4); // strength of the enemy to determine damage to inflict and selecting bullet image
        const randomSpeed = Phaser.Math.RND.realInRange(0.0001, 0.001); // increment of pathSpeed in enemy

        this.timedEvent = this.time.addEvent(
            {
                delay: randomInterval,
                callback: this.addEnemy,
                args: [randomId, randomPath, randomSpeed, randomPower], // parameters passed to addEnemy()
                callbackScope: this,
                repeat: randomCount
            }
        );
    }

    addEnemy(shipId: number, pathId: number, speed: number, power: number) {
        const enemy = new EnemyFlying(this, shipId, pathId, speed, power);
        this.enemyGroup.add(enemy);
    }

    removeEnemy(enemy: EnemyFlying) {
        this.enemyGroup.remove(enemy, true, true);
    }

    addExplosion(x: number, y: number) {
        new Explosion(this, x, y);
    }

    hitPlayer(player: PlayerController, obstacle: EnemyBullet) {
        this.addExplosion(player.x, player.y);
        player.hit(obstacle.getPower());
        obstacle.die();
        if (player.health <= 0) {
            this.GameOver();
        }
    }

    hitEnemy(bullet: PlayerBullet, enemy: EnemyFlying) {
        this.updateScore(10);
        bullet.remove();
        enemy.hit(bullet.getPower());
    }

    destroyEnemyBullet(bulletDestroyer: Rectangle, enemyBullet: EnemyBullet) {
        this.removeEnemyBullet(enemyBullet);
    }

    updateScore(points: number) {
        this.score += points;
        this.scoreText.setText(`Score: ${this.score}`);
    }

    GameOver() {
        this.gameStarted = false;
        this.gameOverText.setVisible(true);
    }
}
