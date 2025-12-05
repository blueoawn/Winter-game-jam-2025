import { GameScene } from '../../../scenes/Game';
import type { EnemyController } from '../../../../managers/EnemyController';

/**
 * Base interface for NPC behaviors
 * Behaviors define how NPCs act and react to their environment
 */

export interface IBehavior {
    /**
     * Called every frame to update the NPC's behavior
     * @param npc The NPC entity this behavior controls
     * @param time Current game time in milliseconds
     * @param delta Time elapsed since last frame in milliseconds
     */
    update(npc: EnemyController, time: number, delta: number): void;

    /**
     * Optional: Called when the behavior is first assigned to an NPC
     * @param npc The NPC entity this behavior will control
     */
    initialize?(npc: EnemyController): void;

    /**
     * Optional: Called when the behavior is removed from an NPC
     * @param npc The NPC entity this behavior was controlling
     */
    cleanup?(npc: EnemyController): void;
}

/**
 * Abstract base class for behaviors with common helper methods
 */
export abstract class Behavior implements IBehavior {
    abstract update(npc: EnemyController, time: number, delta: number): void;

    /**
     * Find the nearest player to the NPC
     */
    protected findNearestPlayer(npc: EnemyController): Phaser.Physics.Arcade.Sprite | null {
        const scene = npc.gameScene;

        // In single player mode
        if (scene.player) {
            return scene.player as any;
        }

        // In multiplayer mode - find local player
        if (scene.playerManager) {
            const localPlayer = scene.playerManager.getLocalPlayer();
            if (localPlayer) {
                return localPlayer as any;
            }
        }

        return null;
    }

    /**
     * Calculate distance between NPC and target
     */
    protected getDistanceToTarget(
        npc: EnemyController,
        target: Phaser.Physics.Arcade.Sprite
    ): number {
        return Phaser.Math.Distance.Between(npc.x, npc.y, target.x, target.y);
    }

    /**
     * Move NPC towards a target position
     */
    protected moveTowards(
        npc: EnemyController,
        targetX: number,
        targetY: number,
        speed: number
    ): void {
        const angle = Phaser.Math.Angle.Between(npc.x, npc.y, targetX, targetY);
        npc.setVelocity(Math.cos(angle) * speed, Math.sin(angle) * speed);
    }

    /**
     * Move NPC away from a target position
     */
    protected moveAwayFrom(
        npc: EnemyController,
        targetX: number,
        targetY: number,
        speed: number
    ): void {
        const angle = Phaser.Math.Angle.Between(npc.x, npc.y, targetX, targetY);
        // Move in opposite direction (add PI to angle)
        npc.setVelocity(
            Math.cos(angle + Math.PI) * speed,
            Math.sin(angle + Math.PI) * speed
        );
    }

    /**
     * Stop NPC movement
     */
    protected stopMovement(npc: EnemyController): void {
        npc.setVelocity(0, 0);
    }

    /**
     * Fire a single projectile at target
     */
    protected fireSingleShot(
        npc: EnemyController,
        target: Phaser.Physics.Arcade.Sprite,
        power: number = 1
    ): void {
        npc.gameScene.fireEnemyBullet(npc.x, npc.y, power, target.x, target.y);
    }

    /**
     * Fire a spread of projectiles
     */
    protected fireSpreadShot(
        npc: EnemyController,
        target: Phaser.Physics.Arcade.Sprite,
        power: number = 1,
        spread: number = 6,
        projectileCount: number = 3
    ): void {
        const yDiff = target.y - npc.y;
        const xDiff = target.x - npc.x;
        const distance = Math.sqrt(xDiff * xDiff + yDiff * yDiff);
        const baseAngle = Math.atan2(yDiff, xDiff);

        const totalSpreadAngle = Math.PI / spread;
        const anglePerProjectile = totalSpreadAngle / (projectileCount - 1);
        const startAngle = baseAngle - totalSpreadAngle / 2;

        for (let i = 0; i < projectileCount; i++) {
            const currentAngle = startAngle + i * anglePerProjectile;
            const targetX = npc.x + distance * Math.cos(currentAngle);
            const targetY = npc.y + distance * Math.sin(currentAngle);

            npc.gameScene.fireEnemyBullet(npc.x, npc.y, power, targetX, targetY);
        }
    }
}
