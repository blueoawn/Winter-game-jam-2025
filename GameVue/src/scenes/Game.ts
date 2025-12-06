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
import { MagicMissile } from "../gameObjects/Projectile/MagicMissile.ts";
import { ShotgunPellet } from "../gameObjects/Projectile/ShotgunPellet.ts";
import { NinjaStar } from "../gameObjects/Projectile/NinjaStar.ts";
import TimerEvent = Phaser.Time.TimerEvent;
import EnemyFlying from "../gameObjects/NPC/EnemyFlying.ts";
import EnemyLizardWizard from "../gameObjects/NPC/EnemyLizardWizard.ts";
import Explosion from "../gameObjects/Explosion.ts";
import { Spawner } from "../gameObjects/Spawner.ts";
import NetworkManager from '../../network/NetworkManager';
import { DeltaDeserializer } from '../../network/DeltaDeserializer';
import { updateHost, updateClient } from '../../network/MultiplayerUpdates';
import { PlayerManager } from '../../managers/MultiplayerManager.ts';
import Rectangle = Phaser.GameObjects.Rectangle;
import { MapData } from '../maps/SummonerRift';
import { getDefaultMap, getMapById } from '../maps/MapRegistry';
import { audioManager } from '../../managers/AudioManager';
import { CharacterIdsEnum, CharacterNamesEnum } from "../gameObjects/Characters/CharactersEnum.ts";
import { AggressiveBehavior } from "../behaviorScripts/Aggressive.ts";
import { IBehavior } from "../behaviorScripts/Behavior.ts";
import { TerritorialBehavior } from "../behaviorScripts/Territorial.ts";
import { PacifistBehavior } from "../behaviorScripts/Pacifist.ts";
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
                try {
                    this.applyDeltaState(delta);
                } catch (err) {
                    console.error('[NETWORK] Error applying delta state:', err);
                }
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

    // Apply delta state updates from host
    applyDeltaState(delta: any) {
        //console.log(`[CLIENT] Received delta tick ${delta.tick}`); //Debug
        
        try {
            if (!delta || typeof delta.tick !== 'number') {
                console.error('[NETWORK] Invalid delta received:', delta);
                return;
            }

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
            
            // Debug: Log player state structure once per 5 ticks
            if (this.tick % 5 === 0 && Object.keys(fullState.players).length > 0) {
                console.log('[DEBUG] Player state structure:', Object.entries(fullState.players).slice(0, 1).map(([id, state]) => ({ id, ...state })));
            }

            // Apply player states
            if (fullState.players && Object.keys(fullState.players).length > 0) {
                this.playerManager?.applyPlayerState(Object.values(fullState.players));
            }
            // Apply meta state
            if (fullState.meta) {
                try {
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
                } catch (err) {
                    console.error('[NETWORK] Error applying meta state:', err);
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
        } catch (err) {
            console.error('[NETWORK] Error in applyDeltaState:', err);
        }
    }

    // Helper method to sync enemies
    private syncEnemies(enemies: Record<string, any>) {
        try {
            this.enemyIdCache.clear();

            Object.entries(enemies).forEach(([id, enemyState]) => {
                if (enemyState === null) return; // Removed enemy

                if (!id || typeof id !== 'string') {
                    console.warn('[NETWORK] Invalid enemy ID:', id);
                    return;
                }

                this.enemyIdCache.add(id);

                let enemy = this.syncedEnemies.get(id);

                if (!enemy) {
                    // Create correct enemy type
                    try {
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
                    } catch (err) {
                        console.error(`[NETWORK] Error creating enemy ${id}:`, err);
                    }
                } else {
                    // Update existing enemy
                    try {
                        if (typeof enemyState.x === 'number' && typeof enemyState.y === 'number') {
                            enemy.setPosition(enemyState.x, enemyState.y);
                        }
                        if (typeof enemyState.health === 'number') {
                            (enemy as any).health = enemyState.health;
                        }
                    } catch (err) {
                        console.error(`[NETWORK] Error updating enemy ${id}:`, err);
                    }
                }
            });
        } catch (err) {
            console.error('[NETWORK] Error in syncEnemies:', err);
        }

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
        try {
            const projectileIdCache = new Set<string>();

            Object.entries(projectiles).forEach(([id, projState]) => {
                if (projState === null) return; // Removed projectile

                if (!id || typeof id !== 'string') {
                    console.warn('[NETWORK] Invalid projectile ID:', id);
                    return;
                }

                projectileIdCache.add(id);

                try {
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
                } catch (err) {
                    console.error(`[NETWORK] Error syncing projectile ${id}:`, err);
                }
            });

            // Remove projectiles no longer in state
            this.playerBulletGroup.getChildren().forEach((projectile: any) => {
                if (projectile.id && !projectileIdCache.has(projectile.id)) {
                    projectile.destroy();
                }
            });
        } catch (err) {
            console.error('[NETWORK] Error in syncProjectiles:', err);
        }
    }

    // Helper method to sync walls
    private syncWalls(walls: Record<string, any>) {
        try {
            Object.entries(walls).forEach(([id, wallState]) => {
                if (wallState === null) return; // Removed wall

                if (!id || typeof id !== 'string') {
                    console.warn('[NETWORK] Invalid wall ID:', id);
                    return;
                }

                try {
                    const wall = this.syncedWalls.get(id);
                    if (wall && wall.updateFromNetworkState) {
                        wall.updateFromNetworkState(wallState);
                    }
                } catch (err) {
                    console.error(`[NETWORK] Error syncing wall ${id}:`, err);
                }
            });
        } catch (err) {
            console.error('[NETWORK] Error in syncWalls:', err);
        }
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

        // Sync enemy bullets from server
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

        // Sync enemies from Server
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
                        const lizardWizard = this.addLizardWizardEnemy(enemyState.x, enemyState.y);

                        // Set ID for tracking
                        (lizardWizard as any).enemyId = enemyState.id;

                        // Cast to common type for storage
                        enemy = lizardWizard as any as EnemyFlying;
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

                    if (enemy) {
                        this.syncedEnemies.set(enemyState.id, enemy);
                    }
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
                const behaviorType = String(config.behaviorType);
                switch (behaviorType) {
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

    // Probably still keep this for client prediction, but needs refactoring
    /**
     * Update all active spawners 
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
        
        // Safely hide tutorial text if it exists
        if (this.tutorialText) {
            this.tutorialText.setVisible(false);
        }

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

    hitEnemy(bullet: any, enemy: EnemyFlying) {
        this.updateScore(10);
        bullet.remove();
        enemy.hit(bullet.getPower());
    }

    hitWall(bullet: any, wall: Wall) {
        // Only damage destructible walls
        if (!wall.isIndestructible) {
            wall.hit(bullet.getPower());
        }
        bullet.remove();
    }

    destroyEnemyBullet(_bulletDestroyer: Rectangle, enemyBullet: EnemyBullet) {
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
