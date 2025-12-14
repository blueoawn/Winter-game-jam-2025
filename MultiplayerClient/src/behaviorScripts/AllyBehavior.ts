import type { GameScene } from '../scenes/GameScene';
import type { PlayerController } from '../gameObjects/Characters/PlayerController';

/**
 * Interface for player character AI behaviors
 * Used when a player disconnects or for CPU-controlled allies
 */
export interface IAllyBehavior {
    /**
     * Called every frame to update the character's AI behavior
     * @param player The player character this behavior controls
     * @param time Current game time in milliseconds
     * @param delta Time elapsed since last frame in milliseconds
     */
    update(player: PlayerController, time: number, delta: number): void;

    /**
     * Optional: Called when the behavior is first assigned
     */
    initialize?(player: PlayerController): void;

    /**
     * Optional: Called when the behavior is removed
     */
    cleanup?(player: PlayerController): void;
}

/**
 * Abstract base class for ally behaviors with common helper methods
 */
export abstract class AllyBehavior implements IAllyBehavior {
    abstract update(player: PlayerController, time: number, delta: number): void;

    /**
     * Get the game scene from the player
     */
    protected getScene(player: PlayerController): GameScene {
        return player.gameScene;
    }

    /**
     * Find all other players (allies) in the game
     */
    protected findAllies(player: PlayerController): PlayerController[] {
        const scene = this.getScene(player);
        const allies: PlayerController[] = [];

        // Single player mode - no allies
        if (!scene.playerManager) {
            return allies;
        }

        // Multiplayer - get all players except self
        scene.playerManager.getAllPlayers().forEach(p => {
            if (p !== player && p.active) {
                allies.push(p);
            }
        });

        return allies;
    }

    /**
     * Find the nearest ally to follow
     */
    protected findNearestAlly(player: PlayerController): PlayerController | null {
        const allies = this.findAllies(player);
        if (allies.length === 0) return null;

        let nearest: PlayerController | null = null;
        let nearestDist = Infinity;

        for (const ally of allies) {
            const dist = this.getDistanceTo(player, ally.x, ally.y);
            if (dist < nearestDist) {
                nearestDist = dist;
                nearest = ally;
            }
        }

        return nearest;
    }

    /**
     * Find all enemies in the game
     */
    protected findEnemies(player: PlayerController): Phaser.Physics.Arcade.Sprite[] {
        const scene = this.getScene(player);
        const enemies: Phaser.Physics.Arcade.Sprite[] = [];

        scene.enemyGroup.getChildren().forEach(child => {
            const enemy = child as Phaser.Physics.Arcade.Sprite;
            if (enemy.active) {
                enemies.push(enemy);
            }
        });

        return enemies;
    }

    /**
     * Find the nearest enemy within range
     */
    protected findNearestEnemy(
        player: PlayerController,
        maxRange?: number
    ): Phaser.Physics.Arcade.Sprite | null {
        const enemies = this.findEnemies(player);
        if (enemies.length === 0) return null;

        let nearest: Phaser.Physics.Arcade.Sprite | null = null;
        let nearestDist = maxRange ?? Infinity;

        for (const enemy of enemies) {
            const dist = this.getDistanceTo(player, enemy.x, enemy.y);
            if (dist < nearestDist) {
                nearestDist = dist;
                nearest = enemy;
            }
        }

        return nearest;
    }

    /**
     * Calculate distance from player to a point
     */
    protected getDistanceTo(player: PlayerController, x: number, y: number): number {
        return Phaser.Math.Distance.Between(player.x, player.y, x, y);
    }

    /**
     * Create an input object to make the player move towards a target
     */
    protected createMoveTowardsInput(
        player: PlayerController,
        targetX: number,
        targetY: number
    ): any {
        const dx = targetX - player.x;
        const dy = targetY - player.y;
        const movement = new Phaser.Math.Vector2(dx, dy).normalize();

        return {
            movement,
            aim: new Phaser.Math.Vector2(targetX, targetY),
            ability1: false,
            ability2: false
        };
    }

    /**
     * Create an input object to attack a target
     */
    protected createAttackInput(
        player: PlayerController,
        targetX: number,
        targetY: number,
        useAbility1: boolean = true,
        useAbility2: boolean = false,
        moveWhileAttacking: boolean = false
    ): any {
        let movement = new Phaser.Math.Vector2(0, 0);

        if (moveWhileAttacking) {
            const dx = targetX - player.x;
            const dy = targetY - player.y;
            movement = new Phaser.Math.Vector2(dx, dy).normalize();
        }

        return {
            movement,
            aim: new Phaser.Math.Vector2(targetX, targetY),
            ability1: useAbility1,
            ability2: useAbility2
        };
    }

    /**
     * Create an idle input (no movement, no abilities)
     */
    protected createIdleInput(player: PlayerController): any {
        return {
            movement: new Phaser.Math.Vector2(0, 0),
            aim: new Phaser.Math.Vector2(player.x + 1, player.y),
            ability1: false,
            ability2: false
        };
    }
}
