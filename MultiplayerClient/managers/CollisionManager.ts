/**
 * CollisionManager
 * Centralized collision setup for singleplayer and multiplayer modes
 */

import type { GameScene } from "../src/scenes/GameScene.ts";
import type { PlayerController } from "../src/gameObjects/Characters/PlayerController";
import Projectile from "../src/gameObjects/Projectile/Projectile";
import Wall from "../src/gameObjects/Wall.ts";
import Rectangle = Phaser.GameObjects.Rectangle;
import { addExplosion, removeConsumable, removeEnemyBullet } from './LevelManager';

/**
 * Set up all collisions for singleplayer mode
 */
export function setupSinglePlayerCollisions(scene: GameScene): void {
    if (!scene.player) {
        console.warn('[COLLISION] Cannot setup singleplayer collisions - player not found');
        return;
    }

    // Enemy bullet destroyers (shields, barriers) destroy enemy bullets
    scene.physics.add.overlap(
        scene.enemyBulletDestroyersGroup,
        scene.enemyBulletGroup,
        scene.destroyEnemyBullet as () => void,
        undefined,
        scene
    );

    // Player bullets damage enemies
    scene.physics.add.overlap(
        scene.playerBulletGroup,
        scene.enemyGroup,
        scene.hitEnemy as () => void,
        undefined,
        scene
    );

    // Enemy bullets damage player
    scene.physics.add.overlap(
        scene.player,
        scene.enemyBulletGroup,
        scene.hitPlayer as () => void,
        undefined,
        scene
    );

    // Enemies damage player on contact
    scene.physics.add.overlap(
        scene.player,
        scene.enemyGroup,
        scene.hitPlayerByEnemy as () => void,
        undefined,
        scene
    );

    // Player collides with walls (solid collision)
    scene.physics.add.collider(scene.player, scene.wallGroup);

    // Player bullets can damage destructible walls
    scene.physics.add.overlap(
        scene.playerBulletGroup,
        scene.wallGroup,
        scene.hitWall as () => void,
        undefined,
        scene
    );

    // Player picks up consumables
    scene.physics.add.overlap(
        scene.player,
        scene.consumableGroup,
        scene.pickupConsumable as () => void,
        undefined,
        scene
    );
}

/**
 * Set up common collisions for both singleplayer and multiplayer modes
 */
export function setupCommonCollisions(scene: GameScene): void {
    // Enemies collide with walls (solid collision)
    scene.physics.add.collider(scene.enemyGroup, scene.wallGroup);

    // Enemy bullets collide with walls (both types blocked)
    scene.physics.add.collider(scene.enemyBulletGroup, scene.wallGroup, (bullet: any) => {
        scene.removeEnemyBullet(bullet);
    });
}

/**
 * Set up wall collisions for multiplayer players
 */
export function setupMultiplayerWallCollisions(scene: GameScene): void {
    if (!scene.playerManager) {
        console.warn('[COLLISION] Cannot setup multiplayer collisions - playerManager not found');
        return;
    }

    // Add wall collision for each multiplayer player
    scene.playerManager.getAllPlayers().forEach(player => {
        scene.physics.add.collider(player, scene.wallGroup);
    });
}

/**
 * Set up all damage collisions for multiplayer mode
 * Must be called after players are created
 */
export function setupMultiplayerCollisions(scene: GameScene): void {
    if (!scene.playerManager) {
        console.warn('[COLLISION] Cannot setup multiplayer damage collisions - playerManager not found');
        return;
    }

    const allPlayers = scene.playerManager.getAllPlayers();

    // Player bullets damage enemies
    scene.physics.add.overlap(
        scene.playerBulletGroup,
        scene.enemyGroup,
        scene.hitEnemy as () => void,
        undefined,
        scene
    );

    // Player bullets can damage destructible walls
    scene.physics.add.overlap(
        scene.playerBulletGroup,
        scene.wallGroup,
        scene.hitWall as () => void,
        undefined,
        scene
    );

    // Enemy bullet destroyers (shields, barriers) destroy enemy bullets
    scene.physics.add.overlap(
        scene.enemyBulletDestroyersGroup,
        scene.enemyBulletGroup,
        scene.destroyEnemyBullet as () => void,
        undefined,
        scene
    );

    // Set up collisions for each player
    allPlayers.forEach(player => {
        // Enemy bullets damage players
        scene.physics.add.overlap(
            player,
            scene.enemyBulletGroup,
            scene.hitPlayer as () => void,
            undefined,
            scene
        );

        // Enemies damage players on contact
        scene.physics.add.overlap(
            player,
            scene.enemyGroup,
            scene.hitPlayerByEnemy as () => void,
            undefined,
            scene
        );

        // Player picks up consumables
        scene.physics.add.overlap(
            player,
            scene.consumableGroup,
            scene.pickupConsumable as () => void,
            undefined,
            scene
        );
    });

    console.log(`[COLLISION] Multiplayer collisions set up for ${allPlayers.length} players`);
}

/**
 * Handle player hit by projectile
 */
export function hitPlayer(scene: GameScene, player: PlayerController, projectile: Projectile): void {
    try {
        addExplosion(scene, player.x, player.y);
        player.hit(projectile.getPower());
        projectile.remove();
        
        if (player.health <= 0) {
            console.log('[COLLISION] Player defeated');
            scene.GameOver();
        }
    } catch (err) {
        console.error('[COLLISION] Error handling player hit by projectile:', err);
    }
}

/**
 * Handle player collision with enemy (contact damage with knockback)
 */
export function hitPlayerByEnemy(scene: GameScene, player: PlayerController, enemy: any): void {
    try {
        // Check if either entity is on cooldown - if so, skip this collision
        const playerCanTakeDamage = player.canTakeContactDamage?.() ?? true;
        const enemyCanTakeDamage = enemy.canTakeContactDamage?.() ?? true;

        // If both are on cooldown, skip entirely
        if (!playerCanTakeDamage && !enemyCanTakeDamage) {
            return;
        }

        // Calculate knockback direction (vector from enemy to player)
        const dx = player.x - enemy.x;
        const dy = player.y - enemy.y;
        const distance = Math.sqrt(dx * dx + dy * dy);

        // Normalize direction
        const normalizedX = distance > 0 ? dx / distance : 0;
        const normalizedY = distance > 0 ? dy / distance : 0;

        // Get knockback values (default to 200 if not defined)
        const playerKnockback = player.knockback || 200;
        const enemyKnockback = enemy.knockback || 200;

        // Apply knockback to player using the new method (includes stun state)
        if (playerCanTakeDamage) {
            player.applyKnockback(normalizedX * playerKnockback, normalizedY * playerKnockback);
        }

        // Apply knockback to enemy using the new method (includes stun state)
        if (enemy.applyKnockback && enemyCanTakeDamage) {
            enemy.applyKnockback(-normalizedX * enemyKnockback, -normalizedY * enemyKnockback);
        } else if (enemy.body && enemyCanTakeDamage) {
            // Fallback for enemies without applyKnockback
            enemy.body.velocity.x = -normalizedX * enemyKnockback;
            enemy.body.velocity.y = -normalizedY * enemyKnockback;
        }

        // Apply damage and mark cooldowns
        const playerDamage = 1;  // Fixed damage to player on contact
        const enemyDamage = 1;  // Fixed damage to enemy on contact

        if (playerCanTakeDamage) {
            player.hit(playerDamage);
            player.markContactDamage?.();
        }

        if (enemyCanTakeDamage) {
            enemy.hit(enemyDamage);
            enemy.markContactDamage?.();
        }

        // Small explosion effects at collision point
        const collisionX = (player.x + enemy.x) / 2;
        const collisionY = (player.y + enemy.y) / 2;
        addExplosion(scene, collisionX, collisionY);

        if (player.health <= 0) {
            console.log('[COLLISION] Player defeated by enemy contact');
            scene.GameOver();
        }
    } catch (err) {
        console.error('[COLLISION] Error handling player-enemy collision:', err);
    }
}

/**
 * Handle enemy hit by player bullet
 */
export function hitEnemy(scene: GameScene, bullet: any, enemy: any): void {
    try {
        scene.updateScore(10);
        bullet.remove();
        enemy.hit(bullet.getPower());
    } catch (err) {
        console.error('[COLLISION] Error handling enemy hit:', err);
    }
}

/**
 * Handle wall hit by bullet
 */
export function hitWall(_scene: GameScene, bullet: any, wall: Wall): void {
    try {
        // Only damage destructible walls
        if (!wall.isIndestructible) {
            wall.hit(bullet.getPower());
        }
        bullet.remove();
    } catch (err) {
        console.error('[COLLISION] Error handling wall hit:', err);
    }
}

/**
 * Handle player picking up consumable
 */
export function pickupConsumable(scene: GameScene, player: any, consumableView: any): void {
    try {
        // Find the consumable instance from the view
        for (const [, consumable] of scene.syncedConsumables.entries()) {
            if (consumable.view === consumableView) {
                // Apply effect to player
                consumable.applyEffect(player);
                
                // Remove consumable
                removeConsumable(scene, consumable);
                break;
            }
        }
    } catch (err) {
        console.error('[COLLISION] Error handling consumable pickup:', err);
    }
}

/**
 * Destroy enemy bullet when it hits a bullet destroyer (e.g., shield)
 */
export function destroyEnemyBullet(scene: GameScene, _bulletDestroyer: Rectangle, projectile: Projectile): void {
    try {
        removeEnemyBullet(scene, projectile);
    } catch (err) {
        console.error('[COLLISION] Error destroying enemy bullet:', err);
    }
}
