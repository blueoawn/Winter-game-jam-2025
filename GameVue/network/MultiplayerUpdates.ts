/**
 * MultiplayerUpdates.ts
 * Centralized module for multiplayer game loop updates
 * Handles host and client state synchronization, input transmission, and state broadcasting
 */

import NetworkManager from '../managers/NetworkManager';
import { DeltaSerializer } from './StateSerializer';
import type { GameScene } from '../src/scenes/GameScene';
import type { PlayerManager } from '../managers/MultiplayerManager';
import type { ButtonMapper } from '../managers/ButtonMapper';
import type { PlayerController } from '../src/gameObjects/Characters/PlayerController';

/**
 * Host-side game loop update
 * Responsible for: local input processing, remote input application, all player updates, spawner management, state broadcasting
 */
export function updateHost(
    scene: GameScene,
    playerManager: PlayerManager | null,
    buttonMapper: ButtonMapper | null
): void {
    // Process local player input from ButtonMapper
    if (buttonMapper && playerManager) {
        const localPlayer = playerManager.getLocalPlayer();
        if (localPlayer) {
            const input = buttonMapper.getInput();
            (localPlayer as PlayerController).processInput(input);
            (localPlayer as PlayerController).storeInputForNetwork(input);
        }
    }

    // Apply remote player inputs from storage (host reads all player inputs)
    if (playerManager) {
        applyRemoteInputs(playerManager);
    }

    // Update all players
    playerManager?.update();

    // Update spawners (host-only logic)
    scene.updateSpawners?.();

    // Broadcast state to server at configured rate
    const now = Date.now();
    if (now - scene.lastStateSyncTime >= scene.stateSyncRate) {
        broadcastState(scene, playerManager);
        scene.lastStateSyncTime = now;
    }
}

/**
 * Apply remote player inputs from storage
 * Host reads inputs.{playerId} from storage and applies them to remote player objects
 *
 * Note: PlaySocketJS stores "inputs.{playerId}" as flat top-level keys, not nested under inputs
 */
let hasLoggedPlayerMapping = false;
function applyRemoteInputs(playerManager: PlayerManager): void {
    const storage = NetworkManager.getStorage();
    if (!storage) return;

    const localPlayerId = NetworkManager.getPlayerId();
    const allPlayerIds = playerManager.getAllPlayerIds();

    // Find all input keys by looking for keys that start with "inputs."
    const inputKeyPrefix = 'inputs.';
    const storageInputKeys = Object.keys(storage)
        .filter(key => key.startsWith(inputKeyPrefix))
        .map(key => key.slice(inputKeyPrefix.length));

    // Log player mapping once at startup (info level - useful for debugging)
    if (!hasLoggedPlayerMapping && storageInputKeys.length > 0) {
        console.info('[HOST-INPUT] Player mapping - Local:', localPlayerId, 'All:', allPlayerIds, 'Inputs:', storageInputKeys);
        hasLoggedPlayerMapping = true;
    }

    for (const playerId of allPlayerIds) {
        // Skip local player (already processed via ButtonMapper)
        if (playerId === localPlayerId) continue;

        // Read from flat key "inputs.{playerId}"
        const inputData = storage[`inputs.${playerId}`];
        if (!inputData) continue;

        const player = playerManager.getPlayer(playerId);
        if (!player) continue;

        // Convert stored input to the format expected by processInput
        const input = {
            velocity: inputData.velocity || { x: 0, y: 0 },
            movementSpeed: inputData.movementSpeed,
            aim: inputData.aim || { x: 0, y: 0 },
            ability1: inputData.ability1 || false,
            ability2: inputData.ability2 || false
        };

        (player as PlayerController).processInput(input);
    }
}

/**
 * Client-side game loop update
 * Responsible for: local input processing, client-side prediction, input transmission
 */
export function updateClient(
    scene: GameScene,
    playerManager: PlayerManager | null,
    buttonMapper: ButtonMapper | null
): void {
    // Process local player input from ButtonMapper (client-side prediction)
    if (buttonMapper && playerManager) {
        const localPlayer = playerManager.getLocalPlayer();
        if (localPlayer) {
            const input = buttonMapper.getInput();
            (localPlayer as PlayerController).processInput(input);
            (localPlayer as PlayerController).storeInputForNetwork(input);
        }
    }

    // Update all players (will be overridden by server deltas)
    playerManager?.update();

    // Send local input to server at configured rate
    const now = Date.now();
    if (now - scene.lastInputSendTime >= scene.inputSendRate) {
        sendInputToServer(scene, playerManager, buttonMapper);
        scene.lastInputSendTime = now;
    }
}

/**
 * Serialize and broadcast full game state to server
 * Uses delta compression to minimize bandwidth
 * Server validates and broadcasts to all clients
 */
function broadcastState(scene: GameScene, playerManager: PlayerManager | null): void {
    if (!playerManager) {
        console.warn('[MULTIPLAYER] broadcastState: no playerManager');
        return;
    }

    const allEnemies = scene.enemyGroup.getChildren();
    const allProjectiles = scene.playerBulletGroup.getChildren();

    // Limit enemies to 30 max (bandwidth optimization)
    const enemies = allEnemies.length > 30 ? allEnemies.slice(0, 30) : allEnemies;

    // Limit projectiles to 100 max (bandwidth optimization)
    const projectiles = allProjectiles.length > 100 ? allProjectiles.slice(0, 100) : allProjectiles;

    // Get destructible walls from synced walls map
    const walls = Array.from(scene.syncedWalls.values());

    // Use delta serialization for bandwidth optimization
    const delta = DeltaSerializer.serializeDelta({
        tick: scene.tick,
        players: playerManager.collectPlayerStates().reduce((acc: any, p: any) => {
            acc[p.id] = p;
            return acc;
        }, {}),
        enemies: enemies.reduce((acc: any, e: any) => {
            const body = e.body as Phaser.Physics.Arcade.Body | null;
            const enemyState = {
                id: (e as any).enemyId || `enemy_${e.x}_${e.y}`,
                x: Math.round(e.x),
                y: Math.round(e.y),
                vx: body?.velocity?.x ? Math.round(body.velocity.x) : 0,
                vy: body?.velocity?.y ? Math.round(body.velocity.y) : 0,
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
        score: scene.score,
        scrollMovement: scene.scrollMovement,
        spawnEnemyCounter: scene.spawnEnemyCounter,
        gameStarted: scene.gameStarted
    });

    // Send delta to server (server validates tick and broadcasts to all clients)
    console.debug('[HOST] Broadcasting state, tick:', delta.tick, 'enemies:', Object.keys(delta.enemies || {}).length, 'players:', Object.keys(delta.players || {}).length);
    NetworkManager.sendRequest('state', delta);
}

/**
 * Send local player input to server
 * Called by clients to transmit movement, aim, and ability input
 */
function sendInputToServer(
    _scene: GameScene,
    playerManager: PlayerManager | null,
    buttonMapper: ButtonMapper | null
): void {
    if (!playerManager || !buttonMapper) {
        console.warn('[MULTIPLAYER] sendInputToServer: missing playerManager or buttonMapper');
        return;
    }

    const localPlayer = playerManager.getLocalPlayer();
    if (!localPlayer) {
        console.warn('[MULTIPLAYER] sendInputToServer: no local player found');
        return;
    }

    // Get abstract input from ButtonMapper
    const abstractInput = buttonMapper.getInput();

    // Convert to network InputState
    const inputState = {
        movementSpeed: (localPlayer as any).characterSpeed,
        velocity: abstractInput.movement,
        rotation: localPlayer.rotation,
        aim: abstractInput.aim, // Include aim position for firing bullets
        ability1: abstractInput.ability1,
        ability2: abstractInput.ability2
    };

    // Send input to server via storage update (path-based for sequence tracking)
    NetworkManager.sendInput(inputState);
}
