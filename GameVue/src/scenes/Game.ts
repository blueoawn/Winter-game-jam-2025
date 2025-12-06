import { Scene } from 'phaser';
import { PlayerController } from "../../managers/PlayerController.ts";
import { EnemyController } from "../../managers/EnemyController.ts";
import { LizardWizard } from "../gameObjects/Characters/LizardWizard.ts";
import { SwordAndBoard } from "../gameObjects/Characters/SwordAndBoard.ts";
import { CheeseTouch } from "../gameObjects/Characters/CheeseTouch.ts";
import { BigSword } from "../gameObjects/Characters/BigSword.ts";
import { BoomStick } from "../gameObjects/Characters/BoomStick.ts";
import { ButtonMapper } from "../../managers/ButtonMapper.ts";
import Tilemap = Phaser.Tilemaps.Tilemap;
import Sprite = Phaser.GameObjects.Sprite;
import TilemapLayer = Phaser.Tilemaps.TilemapLayer;
import Text = Phaser.GameObjects.Text;
import Group = Phaser.GameObjects.Group;
import CursorKeys = Phaser.Types.Input.Keyboard.CursorKeys;

import ANIMATION from '../animation.ts';
import ASSETS from '../assets.ts';
import EnemyBullet from "../gameObjects/EnemyBullet.ts";
import Wall from "../gameObjects/Wall.ts";
import { MagicMissile } from "../gameObjects/Projectile/MagicMissile.ts";
import { ShotgunPellet } from "../gameObjects/Projectile/ShotgunPellet.ts";
import { NinjaStar } from "../gameObjects/Projectile/NinjaStar.ts";
import TimerEvent = Phaser.Time.TimerEvent;
import EnemyFlying from "../gameObjects/EnemyFlying.ts";
import EnemyLizardWizard from "../gameObjects/NPC/EnemyLizardWizard.ts";
import Explosion from "../gameObjects/Explosion.ts";
import { Spawner } from "../gameObjects/Spawner.ts";
import NetworkManager from '../../network/NetworkManager';
import { DeltaSerializer } from '../../network/StateSerializer';
import { DeltaDeserializer } from '../../network/DeltaDeserializer';
import { PlayerManager } from '../../managers/MultiplayerManager.ts';
import Rectangle = Phaser.GameObjects.Rectangle;
import { MapData } from '../maps/SummonerRift';
import { getDefaultMap, getMapById } from '../maps/MapRegistry';
import { audioManager } from '../../managers/AudioManager';
import { CharacterIdsEnum, CharacterNamesEnum } from "../gameObjects/Characters/CharactersEnum.ts";


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
        // Initialize audio manager
        audioManager.init(this);

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

        // Set up multiplayer wall collisions after physics is initialized
        if (this.networkEnabled) {
            this.setupMultiplayerWallCollisions();
        }

        this.initSpawners();  // Initialize enemy spawners from map config
        this.initWalls();     // Initialize walls from map config
        // this.initMap();  // DEPRECATED: Tilemap system replaced by image-based background

        // Setup camera after players are created
        this.initCamera();

        // Auto-start for now
        this.startGame();
    }

    update() {
        if (!this.gameStarted) return;

        if (this.networkEnabled) {
            this.updateMultiplayer();
        } else {
            this.updateSinglePlayer();
        }

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
        this.players.forEach((playerId, index) => {
            const isLocal = (playerId === localPlayerId);
            const characterType = Object.values(CharacterNamesEnum)[index];
            this.playerManager!.createPlayer(playerId, isLocal, characterType, index);
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
        // Clients receive delta updates via volatile channel
        NetworkManager.onState((delta: any) => {
            if (!this.isHost) {
                this.applyDeltaState(delta);
            }
        });

        // Host listens for player inputs via storage
        NetworkManager.onStorageKey('inputs', (inputs: any) => {
            if (this.isHost) {
                // Host processes remote player inputs
                Object.entries(inputs || {}).forEach(([playerId, inputData]: [string, any]) => {
                    if (playerId !== NetworkManager.getPlayerId()) {
                        this.playerManager?.applyInput(playerId, inputData);
                    }
                });
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

        // Update spawners (host-only)
        this.updateSpawners();

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
        const allProjectiles = this.playerBulletGroup.getChildren();

        // Limit enemies to 30 max (should be enough for multiplayer)
        const enemies = allEnemies.length > 30 ? allEnemies.slice(0, 30) : allEnemies;

        // Limit enemy bullets to 50 max (prevent packet overflow)
        const enemyBullets = allEnemyBullets.length > 50 ? allEnemyBullets.slice(0, 50) : allEnemyBullets;

        // Limit projectiles to 100 max (character-specific projectiles)
        const projectiles = allProjectiles.length > 100 ? allProjectiles.slice(0, 100) : allProjectiles;

        // Get destructible walls from synced walls map
        const walls = Array.from(this.syncedWalls.values());

        // Use delta serialization for bandwidth optimization
        const delta = DeltaSerializer.serializeDelta({
            tick: this.tick,
            players: this.playerManager.collectPlayerStates().reduce((acc: any, p: any) => {
                acc[p.id] = p;
                return acc;
            }, {}),
            enemies: enemies.reduce((acc: any, e: any) => {
                const enemyState = {
                    id: (e as any).enemyId || `enemy_${e.x}_${e.y}`,
                    x: Math.round(e.x),
                    y: Math.round(e.y),
                    health: (e as any).health || 1,
                    enemyType: e.constructor.name,
                    shipId: (e as any).shipId || 0,
                    pathId: (e as any).pathIndex || 0,
                    power: (e as any).power || 1
                };
                acc[enemyState.id] = enemyState;
                return acc;
            }, {}),
            projectiles: projectiles.filter((p: any) => p.getNetworkState).map((p: any) => p) as any,
            walls: walls as any,
            score: this.score,
            scrollMovement: this.scrollMovement,
            spawnEnemyCounter: this.spawnEnemyCounter,
            gameStarted: this.gameStarted
        });

        // Send delta via volatile channel (not storage - much faster)
        NetworkManager.sendVolatileState(delta);
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

        // Send input to host
        NetworkManager.sendInput(inputState);
    }
    
    // Apply delta state updates from host
    applyDeltaState(delta: any) {
        // Detect missing packets (desync detection)
        const tickDiff = delta.tick - this.lastReceivedTick;

        if (tickDiff > 5 && this.lastReceivedTick > 0) {
            // Missing more than 5 ticks = desync
            console.warn(`⚠️ Desync detected: missing ${tickDiff} ticks`);
            NetworkManager.sendRequest('snapshot');
            return;
        }

        this.lastReceivedTick = delta.tick;

        // Reconstruct full state from delta
        const fullState = this.deltaDeserializer.applyDelta(delta);

        // Apply player states
        if (fullState.players) {
            this.playerManager?.applyPlayerState(Object.values(fullState.players));
        }

        // Apply meta state
        if (fullState.meta) {
            if (fullState.meta.score !== undefined) {
                this.score = fullState.meta.score;
                this.scoreText.setText(`Score: ${this.score}`);
            }
            if (fullState.meta.scrollMovement !== undefined) {
                this.scrollMovement = fullState.meta.scrollMovement;
            }
            if (fullState.meta.spawnEnemyCounter !== undefined) {
                this.spawnEnemyCounter = fullState.meta.spawnEnemyCounter;
            }
            if (fullState.meta.gameStarted !== undefined) {
                this.gameStarted = fullState.meta.gameStarted;
            }
        }

        // Sync enemies
        if (fullState.enemies) {
            this.syncEnemies(fullState.enemies);
        }

        // Sync projectiles
        if (fullState.projectiles) {
            this.syncProjectiles(fullState.projectiles);
        }

        // Sync walls
        if (fullState.walls) {
            this.syncWalls(fullState.walls);
        }
    }

    // Helper method to sync enemies
    private syncEnemies(enemies: Record<string, any>) {
        this.enemyIdCache.clear();

        Object.entries(enemies).forEach(([id, enemyState]) => {
            if (enemyState === null) return; // Removed enemy

            this.enemyIdCache.add(id);

            let enemy = this.syncedEnemies.get(id);

            if (!enemy) {
                // Create correct enemy type
                if (enemyState.enemyType === 'EnemyLizardWizard') {
                    const lizardEnemy = this.addLizardWizardEnemy(enemyState.x, enemyState.y);
                    (lizardEnemy as any).enemyId = id;
                    // Cast to EnemyFlying for storage (type mismatch handled)
                    this.syncedEnemies.set(id, lizardEnemy as any);
                } else {
                    enemy = new EnemyFlying(
                        this,
                        enemyState.shipId,
                        0,
                        0,
                        enemyState.power
                    );
                    (enemy as any).enemyId = id;
                    (enemy as any).pathIndex = 999; // Disable path following
                    enemy.setPosition(enemyState.x, enemyState.y);
                    this.enemyGroup.add(enemy);
                    this.syncedEnemies.set(id, enemy);
                }
            } else {
                // Update existing enemy
                enemy.setPosition(enemyState.x, enemyState.y);
                (enemy as any).health = enemyState.health;
            }
        });

        // Remove enemies no longer in state
        this.syncedEnemies.forEach((enemy, id) => {
            if (!this.enemyIdCache.has(id)) {
                if (enemy) {
                    enemy.destroy();
                }
                this.syncedEnemies.delete(id);
            }
        });
    }

    // Helper method to sync projectiles
    private syncProjectiles(projectiles: Record<string, any>) {
        const projectileIdCache = new Set<string>();

        Object.entries(projectiles).forEach(([id, projState]) => {
            if (projState === null) return; // Removed projectile

            projectileIdCache.add(id);

            const existing = this.playerBulletGroup.getChildren().find((p: any) => p.id === id);

            if (!existing) {
                const projectile = this.createProjectileFromState(projState);
                if (projectile) {
                    this.playerBulletGroup.add(projectile);
                }
            } else {
                if ((existing as any).updateFromNetworkState) {
                    (existing as any).updateFromNetworkState(projState);
                }
            }
        });

        // Remove projectiles no longer in state
        this.playerBulletGroup.getChildren().forEach((projectile: any) => {
            if (projectile.id && !projectileIdCache.has(projectile.id)) {
                projectile.destroy();
            }
        });
    }

    // Helper method to sync walls
    private syncWalls(walls: Record<string, any>) {
        Object.entries(walls).forEach(([id, wallState]) => {
            if (wallState === null) return; // Removed wall

            const wall = this.syncedWalls.get(id);
            if (wall) {
                wall.updateFromNetworkState(wallState);
            }
        });
    }

    // Legacy method - kept for backwards compatibility
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
                    // Create correct enemy type based on network state
                    if (enemyState.enemyType === 'EnemyLizardWizard') {
                        // Create EnemyLizardWizard
                        enemy = this.addLizardWizardEnemy(enemyState.x, enemyState.y);

                        // Set ID for tracking
                        (enemy as any).enemyId = enemyState.id;
                    } else {
                        // Create EnemyFlying (default/fallback)
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
                    }

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

        // Sync projectiles from host (character-specific: MagicMissile, ShotgunPellet, NinjaStar)
        if (state.projectiles && Array.isArray(state.projectiles)) {
            const projectileIdCache: Set<string> = new Set();

            state.projectiles.forEach((projState: any) => {
                projectileIdCache.add(projState.id);

                // Check if projectile already exists in playerBulletGroup
                const existing = this.playerBulletGroup.getChildren().find((p: any) => p.id === projState.id);

                if (!existing) {
                    // Create new projectile based on type
                    const projectile = this.createProjectileFromState(projState);
                    if (projectile) {
                        this.playerBulletGroup.add(projectile);
                    }
                } else {
                    // Update existing projectile
                    if ((existing as any).updateFromNetworkState) {
                        (existing as any).updateFromNetworkState(projState);
                    }
                }
            });

            // Remove projectiles that are no longer in the state
            this.playerBulletGroup.getChildren().forEach((projectile: any) => {
                if (projectile.id && !projectileIdCache.has(projectile.id)) {
                    projectile.destroy();
                }
            });
        }

        // Sync walls from host
        if (state.walls && Array.isArray(state.walls)) {
            state.walls.forEach((wallState: any) => {
                // Check if wall already exists
                let wall = this.syncedWalls.get(wallState.id);

                if (wall) {
                    // Update existing wall
                    wall.updateFromNetworkState(wallState);
                }
                // Note: Walls are created from map data, not network state
                // So we only update existing walls, never create new ones here
            });
        }
    }

    // Helper method to create projectiles from network state
    private createProjectileFromState(state: any): any {
        let projectile: any = null;

        switch (state.type) {
            case 'MagicMissile':
                projectile = new MagicMissile(
                    this,
                    state.x,
                    state.y,
                    state.x + (state.velocityX || 0),
                    state.y + (state.velocityY || 0),
                    state.damage || 1
                );
                break;
            case 'ShotgunPellet':
                projectile = new ShotgunPellet(
                    this,
                    state.x,
                    state.y,
                    state.x + (state.velocityX || 0),
                    state.y + (state.velocityY || 0),
                    state.baseDamage || 3,
                    state.minDamageMultiplier || 0.2,
                    state.falloffStart || 80,
                    state.falloffEnd || 220
                );
                // Set start position for damage falloff
                if (state.startX !== undefined) (projectile as any).startX = state.startX;
                if (state.startY !== undefined) (projectile as any).startY = state.startY;
                break;
            case 'NinjaStar':
                projectile = new NinjaStar(
                    this,
                    state.x,
                    state.y,
                    state.x + (state.velocityX || 0),
                    state.y + (state.velocityY || 0),
                    state.damage || 2
                );
                break;
            default:
                console.warn(`Unknown projectile type: ${state.type}`);
                return null;
        }

        if (projectile) {
            // Override generated ID with network ID
            projectile.id = state.id;

            // Apply full network state
            projectile.updateFromNetworkState(state);
        }

        return projectile;
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
        this.enemyGroup = this.add.group();
        this.enemyBulletGroup = this.add.group();
        this.playerBulletGroup = this.add.group();
        this.enemyBulletDestroyersGroup = this.add.group();
        this.wallGroup = this.add.group();

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
     * Creates Spawner instances based on map's spawners array
     */
    initSpawners(): void {
        if (!this.currentMap.spawners) {
            console.log('No spawners defined for current map');
            return;
        }

        // Create spawner instances from map config
        this.currentMap.spawners.forEach(config => {
            // Create behavior if specified
            let behavior: IBehavior | undefined;

            if (config.behaviorType) {
                switch (config.behaviorType) {
                    case 'Aggressive':
                        behavior = new AggressiveBehavior(config.behaviorOptions);
                        break;
                    case 'Territorial':
                        behavior = new TerritorialBehavior(
                            config.x,
                            config.y,
                            config.behaviorOptions
                        );
                        break;
                    case 'Pacifist':
                        behavior = new PacifistBehavior(
                            config.x,
                            config.y,
                            config.behaviorOptions
                        );
                        break;
                }
            }

            const spawner = new Spawner(
                this,
                config.x,
                config.y,
                config.totalEnemies,
                config.spawnRate,
                config.timeOffset,
                config.enemyType,
                behavior
            );

            this.spawners.push(spawner);
        });

        console.log(`Initialized ${this.spawners.length} spawner(s)`);
    }

    /**
     * Initialize walls from current map configuration
     * Creates Wall instances based on map's walls array
     */
    initWalls(): void {
        if (!this.currentMap.walls) {
            console.log('No walls defined for current map');
            return;
        }

        // Create wall instances from map config
        this.currentMap.walls.forEach(wallData => {
            const wall = new Wall(
                this,
                wallData.x,
                wallData.y,
                wallData.spriteKey,
                wallData.frame || 0,
                wallData.health
            );

            this.addWall(wall);

            // Track destructible walls for network sync
            if (!wall.isIndestructible) {
                this.syncedWalls.set(wall.wallId, wall);
            }
        });

        console.log(`Initialized ${this.currentMap.walls.length} wall(s)`);
    }

    /**
     * Update all active spawners (host-only)
     * Called every frame from updateHost()
     */
    updateSpawners(): void {
        // Only host updates spawners (clients receive enemies via network sync)
        if (!this.isHost && this.networkEnabled) return;

        // Update all active spawners
        for (let i = 0; i < this.spawners.length; i++) {
            this.spawners[i].update();
        }
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
        // Prevent double-spawning if startGame is called multiple times
        if (this.gameStarted) return;

        this.gameStarted = true;
        this.tutorialText.setVisible(false);

        // Enemies will now spawn based off of data in the map. 

    }

    fireEnemyBullet(x: number, y: number, power: number, targetX?: number, targetY?: number) {
        const bullet = new EnemyBullet(this, x, y, power, targetX, targetY);
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

    addLizardWizardEnemy(x: number, y: number) {
        const enemy = new EnemyLizardWizard(this, x, y);
        this.enemyGroup.add(enemy);
        return enemy;
    }

    removeEnemy(enemy: EnemyController) {
        this.enemyGroup.remove(enemy, true, true);
    }

    addWall(wall: Wall) {
        this.wallGroup.add(wall);
    }

    removeWall(wall: Wall) {
        this.wallGroup.remove(wall, true, true);
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

    hitWall(bullet: PlayerBullet, wall: Wall) {
        // Only damage destructible walls
        if (!wall.isIndestructible) {
            wall.hit(bullet.getPower());
        }
        bullet.remove();
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
        this.cameras.main.fade(1000, 0, 0, 0, false, (_camera: Phaser.Cameras.Scene2D.Camera, progress: number) => {
            if (progress === 1) {
                this.scene.start('GameOver');
            }
        });
    }
}
