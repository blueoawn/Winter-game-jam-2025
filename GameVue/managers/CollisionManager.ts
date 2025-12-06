/**
 * CollisionManager
 * Centralized collision setup for singleplayer and multiplayer modes
 */

import type { GameScene } from "../src/scenes/GameScene.ts";

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
        scene.hitPlayer as () => void,
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
            scene.hitPlayer as () => void,
            undefined,
            scene
        );
    });

    console.log(`[COLLISION] Multiplayer collisions set up for ${allPlayers.length} players`);
}
