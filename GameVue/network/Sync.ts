/**
 * Sync.ts
 * Centralized network synchronization module
 * Handles all state synchronization, delta application, and entity syncing
 * Separates sync logic from main game scene
 */

import type { GameScene } from '../src/scenes/GameScene';
import NetworkManager from '../managers/NetworkManager';
import EnemyBullet from '../src/gameObjects/Projectile/EnemyBullet';
import EnemyFlying from '../src/gameObjects/NPC/EnemyFlying';
import EnemySlime from '../src/gameObjects/NPC/EnemySlime';
import { MagicMissile } from '../src/gameObjects/Projectile/MagicMissile';
import { ShotgunPellet } from '../src/gameObjects/Projectile/ShotgunPellet';
import { NinjaStar } from '../src/gameObjects/Projectile/NinjaStar';

/**
 * Apply delta state updates from server
 * Reconstructs full game state from delta packets
 * Applies changes to players, enemies, projectiles, and walls
 */
export function applyDeltaState(scene: GameScene, delta: any): void {
    try {
        // Host should NOT apply delta state - they are the source of truth
        if (scene.isHost) {
            return;
        }

        if (!delta || typeof delta.tick !== 'number') {
            console.error('[SYNC] Invalid delta received:', delta);
            return;
        }

        // Skip stale updates (we already have newer data)
        if (delta.tick <= scene.lastReceivedTick) {
            return;
        }

        // Detect large gaps (potential desync) - use larger threshold since ticks jump ~6 per update
        const tickDiff = delta.tick - scene.lastReceivedTick;
        if (tickDiff > 60 && scene.lastReceivedTick > 0) {
            // Missing more than 60 ticks (~1 second) = potential desync, request snapshot
            console.warn(`⚠️ Large tick gap: ${tickDiff} ticks (requesting snapshot)`);
            NetworkManager.sendRequest('snapshot');
            // Don't return - still apply the state we have
        }

        scene.lastReceivedTick = delta.tick;

        // Reconstruct full state from delta
        const fullState = scene.deltaDeserializer.applyDelta(delta);

        // Apply player states
        if (fullState.players && Object.keys(fullState.players).length > 0) {
            scene.playerManager?.applyPlayerState(Object.values(fullState.players));
        }

        // Apply meta state
        if (fullState.meta) {
            applyMetaState(scene, fullState.meta);
        }

        // Sync entities
        if (fullState.enemies && Object.keys(fullState.enemies).length > 0) {
            console.log('[SYNC] Syncing', Object.keys(fullState.enemies).length, 'enemies');
            syncEnemies(scene, fullState.enemies);
        }

        if (fullState.projectiles) {
            syncProjectiles(scene, fullState.projectiles);
        }

        if (fullState.walls) {
            syncWalls(scene, fullState.walls);
        }
    } catch (err) {
        console.error('[NETWORK] Error in applyDeltaState:', err);
    }
}

/**
 * Apply meta state (score, spawners, game state)
 */
function applyMetaState(scene: GameScene, meta: Record<string, any>): void {
    try {
        if (meta.score !== undefined) {
            scene.score = meta.score;
            scene.scoreText.setText(`Score: ${scene.score}`);
        }
        if (meta.scrollMovement !== undefined) {
            scene.scrollMovement = meta.scrollMovement;
        }
        if (meta.spawnEnemyCounter !== undefined) {
            scene.spawnEnemyCounter = meta.spawnEnemyCounter;
        }
        if (meta.gameStarted !== undefined) {
            scene.gameStarted = meta.gameStarted;
        }
    } catch (err) {
        console.error('[NETWORK] Error applying meta state:', err);
    }
}

/**
 * Synchronize enemies from server state
 * Creates new enemies, updates positions/health, removes deleted enemies
 */
function syncEnemies(scene: GameScene, enemies: Record<string, any>): void {
    try {
        scene.enemyIdCache.clear();

        Object.entries(enemies).forEach(([id, enemyState]) => {
            if (enemyState === null) return; // Removed enemy

            if (!id || typeof id !== 'string') {
                console.warn('[NETWORK] Invalid enemy ID:', id);
                return;
            }

            scene.enemyIdCache.add(id);

            let enemy = scene.syncedEnemies.get(id);

            if (!enemy) {
                // Create correct enemy type
                try {
                    if (enemyState.enemyType === 'EnemyLizardWizard') {
                        const lizardEnemy = scene.addLizardWizardEnemy(enemyState.x, enemyState.y);
                        (lizardEnemy as any).enemyId = id;
                        scene.syncedEnemies.set(id, lizardEnemy as any);
                    } else if (enemyState.enemyType === 'EnemySlime') {
                        const slimeEnemy = scene.addSlimeEnemy(enemyState.x, enemyState.y);
                        (slimeEnemy as any).enemyId = id;
                        scene.syncedEnemies.set(id, slimeEnemy as any);
                    } else {
                        enemy = new EnemyFlying(
                            scene,
                            enemyState.shipId,
                            0,
                            0,
                            enemyState.power
                        );
                        (enemy as any).enemyId = id;
                        (enemy as any).pathIndex = 999; // Disable path following
                        enemy.setPosition(enemyState.x, enemyState.y);
                        scene.enemyGroup.add(enemy);
                        scene.syncedEnemies.set(id, enemy);
                    }
                } catch (err) {
                    console.error(`[NETWORK] Error creating enemy ${id}:`, err);
                }
            } else {
                // Update existing enemy with position and velocity for smooth prediction
                try {
                    if (typeof enemyState.x === 'number' && typeof enemyState.y === 'number') {
                        enemy.setPosition(enemyState.x, enemyState.y);
                    }
                    // Apply velocity so enemy continues moving between sync updates
                    if (enemy.body && typeof enemyState.vx === 'number' && typeof enemyState.vy === 'number') {
                        (enemy.body as Phaser.Physics.Arcade.Body).setVelocity(enemyState.vx, enemyState.vy);
                    }
                    if (typeof enemyState.health === 'number') {
                        (enemy as any).health = enemyState.health;
                    }
                } catch (err) {
                    console.error(`[NETWORK] Error updating enemy ${id}:`, err);
                }
            }
        });

        // Remove enemies no longer in state
        scene.syncedEnemies.forEach((enemy, id) => {
            if (!scene.enemyIdCache.has(id)) {
                if (enemy) {
                    enemy.destroy();
                }
                scene.syncedEnemies.delete(id);
            }
        });
    } catch (err) {
        console.error('[NETWORK] Error in syncEnemies:', err);
    }
}

/**
 * Synchronize projectiles from server state
 * Creates new projectiles, updates state, removes deleted projectiles
 */
function syncProjectiles(scene: GameScene, projectiles: Record<string, any>): void {
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
                const existing = scene.playerBulletGroup.getChildren().find((p: any) => p.id === id);

                if (!existing) {
                    const projectile = createProjectileFromState(scene, projState);
                    if (projectile) {
                        scene.playerBulletGroup.add(projectile);
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
        scene.playerBulletGroup.getChildren().forEach((projectile: any) => {
            if (projectile.id && !projectileIdCache.has(projectile.id)) {
                projectile.destroy();
            }
        });
    } catch (err) {
        console.error('[NETWORK] Error in syncProjectiles:', err);
    }
}

/**
 * Synchronize walls from server state
 * Updates wall states from network
 */
function syncWalls(scene: GameScene, walls: Record<string, any>): void {
    try {
        Object.entries(walls).forEach(([id, wallState]) => {
            if (wallState === null) return; // Removed wall

            if (!id || typeof id !== 'string') {
                console.warn('[NETWORK] Invalid wall ID:', id);
                return;
            }

            try {
                const wall = scene.syncedWalls.get(id);
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

/**
 * Legacy: Apply full network state (deprecated)
 * Kept for backwards compatibility
 */
export function applyNetworkState(scene: GameScene, state: any): void {
    // Apply player states
    if (state.players && scene.playerManager) {
        scene.playerManager.applyPlayerState(state.players);
    }

    // Apply game state
    if (state.gameState) {
        scene.score = state.gameState.score;
        scene.scrollMovement = state.gameState.scrollMovement;
        scene.spawnEnemyCounter = state.gameState.spawnEnemyCounter;
        scene.gameStarted = state.gameState.gameStarted;

        scene.scoreText.setText(`Score: ${scene.score}`);
    }

    // Sync enemy bullets from server
    if (state.enemyBullets && Array.isArray(state.enemyBullets)) {
        scene.enemyBulletIdCache.clear();

        state.enemyBullets.forEach((bulletState: any) => {
            scene.enemyBulletIdCache.add(bulletState.id);

            // Check if enemy bullet already exists
            let bullet = scene.syncedEnemyBullets.get(bulletState.id);

            if (!bullet) {
                // Create new enemy bullet
                bullet = new EnemyBullet(
                    scene,
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

                scene.enemyBulletGroup.add(bullet);
                scene.syncedEnemyBullets.set(bulletState.id, bullet);
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
        scene.syncedEnemyBullets.forEach((bullet, id) => {
            if (!scene.enemyBulletIdCache.has(id)) {
                scene.enemyBulletGroup.remove(bullet, true, true);
                scene.syncedEnemyBullets.delete(id);
            }
        });
    }

    // Sync enemies from Server
    if (state.enemies && Array.isArray(state.enemies)) {
        scene.enemyIdCache.clear();

        state.enemies.forEach((enemyState: any) => {
            scene.enemyIdCache.add(enemyState.id);

            // Check if enemy already exists
            let enemy = scene.syncedEnemies.get(enemyState.id);

            if (!enemy) {
                // Create correct enemy type based on network state
                if (enemyState.enemyType === 'EnemyLizardWizard') {
                    // Create EnemyLizardWizard
                    const lizardWizard = scene.addLizardWizardEnemy(enemyState.x, enemyState.y);

                    // Set ID for tracking
                    (lizardWizard as any).enemyId = enemyState.id;

                    // Cast to common type for storage
                    enemy = lizardWizard as any as EnemyFlying;
                } else {
                    // Create EnemyFlying (default/fallback)
                    enemy = new EnemyFlying(
                        scene,
                        enemyState.shipId,
                        0,
                        0,
                        enemyState.power
                    );

                    // Set ID for tracking
                    (enemy as any).enemyId = enemyState.id;

                    // Disable path following for network-synced enemies
                    (enemy as any).pathIndex = 999;

                    // Set initial position from network state
                    enemy.setPosition(enemyState.x, enemyState.y);

                    scene.enemyGroup.add(enemy);
                }

                if (enemy) {
                    scene.syncedEnemies.set(enemyState.id, enemy);
                }
            } else {
                // Enemy exists - update position and health
                try {
                    if (typeof enemyState.x === 'number' && typeof enemyState.y === 'number') {
                        enemy.setPosition(enemyState.x, enemyState.y);
                    }

                    if (typeof enemyState.health === 'number') {
                        (enemy as any).health = enemyState.health;
                    }
                } catch (err) {
                    console.error('[NETWORK] Error updating enemy:', err);
                }
            }
        });

        // Remove enemies no longer in state
        scene.syncedEnemies.forEach((enemy, id) => {
            if (!scene.enemyIdCache.has(id)) {
                if (enemy) {
                    enemy.destroy();
                }
                scene.syncedEnemies.delete(id);
            }
        });
    }
}

/**
 * Helper method to create projectiles from network state
 * Supports MagicMissile, ShotgunPellet, and NinjaStar
 */
function createProjectileFromState(scene: GameScene, state: any): any {
    let projectile: any = null;

    switch (state.type) {
        case 'MagicMissile':
            projectile = new MagicMissile(
                scene,
                state.x,
                state.y,
                state.x + (state.velocityX || 0),
                state.y + (state.velocityY || 0),
                state.damage || 1
            );
            break;
        case 'ShotgunPellet':
            projectile = new ShotgunPellet(
                scene,
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
                scene,
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