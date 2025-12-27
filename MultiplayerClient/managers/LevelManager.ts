/**
 * LevelManager.ts
 * Manages all level/game object initialization, creation, and destruction
 * Separates game object lifecycle from scene management
 */

import type { GameScene } from '../src/scenes/GameScene.ts';
import Projectile from '../src/gameObjects/Projectile/Projectile';
import Explosion from '../src/gameObjects/Explosion';
import EnemySlime from '../src/gameObjects/NPC/EnemySlime.ts';
import EnemyLizardWizard from '../src/gameObjects/NPC/EnemyLizardWizard';
import { MagicMissile } from '../src/gameObjects/Projectile/MagicMissile.ts';
import Wall from '../src/gameObjects/Wall.ts';
import { Spawner } from '../src/gameObjects/Spawner';
import { AggressiveBehavior } from '../src/behaviorScripts/Aggressive';
import { TerritorialBehavior } from '../src/behaviorScripts/Territorial';
import { PacifistBehavior } from '../src/behaviorScripts/Pacifist';
import type { IBehavior } from '../src/behaviorScripts/Behavior';
import { HealthPack } from '../src/gameObjects/Consumable/HealthPack';
import { SpeedBoost } from '../src/gameObjects/Consumable/SpeedBoost';
import { Consumable } from '../src/gameObjects/Consumable/Consumable';
import { AreaBoundary, AreaBoundaryConfig } from '../src/gameObjects/AreaBoundary';

/**
 * Initialize spawners from map data
 * Sets up enemy spawn points with behaviors
 */
export function initSpawners(scene: GameScene): void {
    try {
        if (!scene.currentMap?.spawners) {
            console.log('[LEVEL] No spawners defined for current map');
            return;
        }

        // Create spawner instances from map config
        scene.currentMap.spawners.forEach((config: any) => {
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
                scene,
                config.x,
                config.y,
                config.totalEnemies,
                config.spawnRate,
                config.timeOffset,
                config.enemyType,
                behavior
            );

            scene.spawners.push(spawner);
        });

        console.log(`[LEVEL] Initialized ${scene.spawners.length} spawner(s)`);
    } catch (err) {
        console.error('[LEVEL] Error initializing spawners:', err);
    }
}

/**
 * Initialize walls from map data
 * Creates wall entities with health tracking
 */
export function initWalls(scene: GameScene): void {
    try {
        if (!scene.currentMap?.walls) {
            console.log('[LEVEL] No walls defined for current map');
            return;
        }

        // Create wall instances from map config
        scene.currentMap.walls.forEach((wallData: any) => {
            const wall = new Wall(
                scene,
                wallData.x,
                wallData.y,
                wallData.spriteKey,
                wallData.frame || 0,
                wallData.health
            );

            addWall(scene, wall);

            // Track destructible walls for network sync
            if (!wall.isIndestructible) {
                scene.syncedWalls.set(wall.wallId, wall);
            }
        });

        console.log(`[LEVEL] Initialized ${scene.currentMap.walls.length} wall(s)`);
    } catch (err) {
        console.error('[LEVEL] Error initializing walls:', err);
    }
}

/**
 * Initialize consumables from map data
 * Creates consumable items that can be picked up by players
 */
export function initConsumables(scene: GameScene): void {
    try {
        if (!scene.currentMap?.consumables) {
            console.log('[LEVEL] No consumables defined for current map');
            return;
        }

        // Create consumable instances from map config
        scene.currentMap.consumables.forEach((consumableData: any) => {
            let consumable: Consumable;

            switch (consumableData.type) {
                case 'HealthPack':
                    consumable = new HealthPack(
                        consumableData.x,
                        consumableData.y,
                        consumableData.value || 1,
                        consumableData.lifetime
                    );
                    break;
                case 'SpeedBoost':
                    consumable = new SpeedBoost(
                        consumableData.x,
                        consumableData.y,
                        consumableData.value || 1.5,
                        consumableData.lifetime
                    );
                    break;
                default:
                    console.warn(`[LEVEL] Unknown consumable type: ${consumableData.type}`);
                    return;
            }

            addConsumable(scene, consumable);
        });

        console.log(`[LEVEL] Initialized ${scene.currentMap.consumables.length} consumable(s)`);
    } catch (err) {
        console.error('[LEVEL] Error initializing consumables:', err);
    }
}

/**
 * Initialize area boundaries from map data
 * Creates static zones with effects (speed modifiers, damage, etc.)
 */
export function initAreaBoundaries(scene: GameScene): void {
    try {
        if (!scene.currentMap?.areaBoundaries) {
            console.log('[LEVEL] No area boundaries defined for current map');
            return;
        }

        // Create area boundary instances from map config
        scene.currentMap.areaBoundaries.forEach((boundaryData: any) => {
            const boundary = new AreaBoundary(scene, boundaryData as AreaBoundaryConfig);
            addAreaBoundary(scene, boundary);
        });

        console.log(`[LEVEL] Initialized ${scene.currentMap.areaBoundaries.length} area boundaries`);
    } catch (err) {
        console.error('[LEVEL] Error initializing area boundaries:', err);
    }
}

/**
 * Update all area boundaries
 * Called every frame to handle periodic effects
 */
export function updateAreaBoundaries(scene: GameScene): void {
    try {
        if (!scene.areaBoundaries) return;

        scene.areaBoundaries.forEach(boundary => {
            boundary.update();
        });
    } catch (err) {
        console.error('[LEVEL] Error updating area boundaries:', err);
    }
}

/**
 * Update all active spawners
 * Called every frame from updateHost()
 */
export function updateSpawners(scene: GameScene): void {
    try {
        // Only host updates spawners (clients receive enemies via network sync)
        if (!scene.isHost && scene.networkEnabled) return;

        // Update all active spawners
        for (let i = 0; i < scene.spawners.length; i++) {
            scene.spawners[i].update();
        }
    } catch (err) {
        console.error('[LEVEL] Error updating spawners:', err);
    }
}

/**
 * Create enemy projectile
 */
export function fireEnemyBullet(scene: GameScene, x: number, y: number, power: number, targetX?: number, targetY?: number): void {
    try {
        // Calculate target if not provided (shoot at player)
        let finalTargetX = targetX;
        let finalTargetY = targetY;
        if (finalTargetX === undefined || finalTargetY === undefined) {
            const player = scene.player || scene.playerManager?.getLocalPlayer();
            if (player) {
                finalTargetX = player.x;
                finalTargetY = player.y;
            } else {
                finalTargetX = x;
                finalTargetY = y + 100; // Default downward
            }
        }
        
        const bullet = new MagicMissile(scene, x, y, finalTargetX, finalTargetY, power);
        bullet.team = 'enemy'; // Set team for future collision filtering
        scene.enemyBulletGroup.add(bullet);
    } catch (err) {
        console.error('[LEVEL] Error firing enemy bullet:', err);
    }
}

/**
 * Create lizard wizard enemy
 */
export function addLizardWizardEnemy(scene: GameScene, x: number, y: number): EnemyLizardWizard {
    try {
        const enemy = new EnemyLizardWizard(scene, x, y);
        scene.enemyGroup.add(enemy);
        return enemy;
    } catch (err) {
        console.error('[LEVEL] Error adding lizard wizard enemy:', err);
        return null as any;
    }
}

/**
 * Create slime enemy
 */
export function addSlimeEnemy(scene: GameScene, x: number, y: number): EnemySlime {
    try {
        const enemy = new EnemySlime(scene, x, y);
        scene.enemyGroup.add(enemy);
        return enemy;
    } catch (err) {
        console.error('[LEVEL] Error adding slime enemy:', err);
        return null as any;
    }
}

/**
 * Remove enemy
 */
export function removeEnemy(scene: GameScene, enemy: any): void {
    try {
        scene.enemyGroup.remove(enemy, true, true);
    } catch (err) {
        console.error('[LEVEL] Error removing enemy:', err);
    }
}

/**
 * Add wall to scene
 */
export function addWall(scene: GameScene, wall: Wall): void {
    try {
        scene.wallGroup.add(wall);
    } catch (err) {
        console.error('[LEVEL] Error adding wall:', err);
    }
}

/**
 * Remove wall from scene
 */
export function removeWall(scene: GameScene, wall: Wall): void {
    try {
        scene.wallGroup.remove(wall, true, true);
    } catch (err) {
        console.error('[LEVEL] Error removing wall:', err);
    }
}

/**
 * Add consumable to scene
 */
export function addConsumable(scene: GameScene, consumable: Consumable): void {
    try {
        consumable.createView(scene);
        if (!scene.consumableGroup) {
            scene.consumableGroup = scene.physics.add.group();
        }
        scene.consumableGroup.add(consumable.view);
        scene.syncedConsumables.set(consumable.id, consumable);
    } catch (err) {
        console.error('[LEVEL] Error adding consumable:', err);
    }
}

/**
 * Remove consumable from scene
 */
export function removeConsumable(scene: GameScene, consumable: Consumable): void {
    try {
        if (consumable.view) {
            scene.consumableGroup.remove(consumable.view, true, true);
        }
        scene.syncedConsumables.delete(consumable.id);
    } catch (err) {
        console.error('[LEVEL] Error removing consumable:', err);
    }
}

/**
 * Add area boundary to scene
 */
export function addAreaBoundary(scene: GameScene, boundary: AreaBoundary): void {
    try {
        if (!scene.areaBoundaries) {
            scene.areaBoundaries = [];
        }
        scene.areaBoundaries.push(boundary);

        // Setup overlap detection with players and enemies
        // Players
        if (scene.player) {
            scene.physics.add.overlap(scene.player, boundary.getZone(), () => {
                boundary.applyEffect(scene.player);
            });
        }

        // Multiplayer players
        if (scene.playerManager) {
            scene.playerManager.getAllPlayers().forEach(player => {
                scene.physics.add.overlap(player, boundary.getZone(), () => {
                    boundary.applyEffect(player);
                });
            });
        }

        // Enemies
        scene.physics.add.overlap(scene.enemyGroup, boundary.getZone(), (enemy: any) => {
            boundary.applyEffect(enemy);
        });

    } catch (err) {
        console.error('[LEVEL] Error adding area boundary:', err);
    }
}

/**
 * Remove area boundary from scene
 */
export function removeAreaBoundary(scene: GameScene, boundary: AreaBoundary): void {
    try {
        if (scene.areaBoundaries) {
            const index = scene.areaBoundaries.indexOf(boundary);
            if (index > -1) {
                scene.areaBoundaries.splice(index, 1);
            }
        }
        boundary.destroy();
    } catch (err) {
        console.error('[LEVEL] Error removing area boundary:', err);
    }
}

/**
 * Create explosion effect
 */
export function addExplosion(scene: GameScene, x: number, y: number): void {
    try {
        new Explosion(scene, x, y);
    } catch (err) {
        console.error('[LEVEL] Error creating explosion:', err);
    }
}

/**
 * Remove enemy bullet
 */
export function removeEnemyBullet(scene: GameScene, bullet: Projectile): void {
    try {
        scene.enemyBulletGroup.remove(bullet, true, true);
    } catch (err) {
        console.error('[LEVEL] Error removing enemy bullet:', err);
    }
}

/**
 * Add enemy bullet destroyer (used for player collision areas)
 */
export function addEnemyBulletDestroyer(scene: GameScene, destroyer: Phaser.GameObjects.GameObject): void {
    try {
        scene.enemyBulletDestroyersGroup.add(destroyer);
    } catch (err) {
        console.error('[LEVEL] Error adding bullet destroyer:', err);
    }
}

/**
 * Remove enemy bullet destroyer
 */
export function removeEnemyBulletDestroyer(scene: GameScene, destroyer: Phaser.GameObjects.GameObject): void {
    try {
        scene.enemyBulletDestroyersGroup.remove(destroyer, true, true);
    } catch (err) {
        console.error('[LEVEL] Error removing bullet destroyer:', err);
    }
}
