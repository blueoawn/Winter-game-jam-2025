import { AllyBehavior } from './AllyBehavior';
import type { PlayerController } from '../gameObjects/Characters/PlayerController';

/**
 * Default AI behavior for CPU-controlled player characters
 *
 * Behavior pattern:
 * - Follows the nearest ally (other player) at a comfortable distance
 * - When enemies are in range, attacks them using abilities
 * - Prioritizes attacking over following when enemies are close
 * - Falls back to wandering if no allies exist
 */
export class FollowAndAttackBehavior extends AllyBehavior {
    // Configuration
    followDistance: number = 150;      // Ideal distance to maintain from ally
    followThreshold: number = 250;     // Start following if further than this
    attackRange: number = 350;         // Range to detect and attack enemies
    ability1Interval: number = 500;    // Ms between ability 1 uses
    ability2Interval: number = 3000;   // Ms between ability 2 uses

    // State tracking
    private lastAbility1Time: number = 0;
    private lastAbility2Time: number = 0;
    private targetEnemy: Phaser.Physics.Arcade.Sprite | null = null;
    private followTarget: PlayerController | null = null;

    constructor(options?: {
        followDistance?: number;
        followThreshold?: number;
        attackRange?: number;
        ability1Interval?: number;
        ability2Interval?: number;
    }) {
        super();

        if (options) {
            this.followDistance = options.followDistance ?? this.followDistance;
            this.followThreshold = options.followThreshold ?? this.followThreshold;
            this.attackRange = options.attackRange ?? this.attackRange;
            this.ability1Interval = options.ability1Interval ?? this.ability1Interval;
            this.ability2Interval = options.ability2Interval ?? this.ability2Interval;
        }
    }

    initialize(player: PlayerController): void {
        this.lastAbility1Time = 0;
        this.lastAbility2Time = 0;
        this.targetEnemy = null;
        this.followTarget = null;
    }

    cleanup(player: PlayerController): void {
        this.targetEnemy = null;
        this.followTarget = null;
    }

    update(player: PlayerController, time: number, delta: number): void {
        // Priority 1: Attack nearby enemies
        const enemy = this.findNearestEnemy(player, this.attackRange);

        if (enemy) {
            this.targetEnemy = enemy;
            this.attackEnemy(player, enemy, time);
            return;
        }

        this.targetEnemy = null;

        // Priority 2: Follow nearest ally
        const ally = this.findNearestAlly(player);

        if (ally) {
            this.followTarget = ally;
            this.followAlly(player, ally);
            return;
        }

        this.followTarget = null;

        // Priority 3: Idle (no allies, no enemies)
        this.idle(player);
    }

    private attackEnemy(
        player: PlayerController,
        enemy: Phaser.Physics.Arcade.Sprite,
        time: number
    ): void {
        const distance = this.getDistanceTo(player, enemy.x, enemy.y);

        // Determine which abilities to use
        const useAbility2 = time - this.lastAbility2Time >= this.ability2Interval;
        const useAbility1 = time - this.lastAbility1Time >= this.ability1Interval;

        // Create attack input
        const input = this.createAttackInput(
            player,
            enemy.x,
            enemy.y,
            useAbility1,
            useAbility2,
            distance > this.attackRange * 0.5  // Move closer if far
        );

        // Track cooldowns
        if (useAbility1) this.lastAbility1Time = time;
        if (useAbility2) this.lastAbility2Time = time;

        // Process the input
        player.processInput(input);
    }

    private followAlly(player: PlayerController, ally: PlayerController): void {
        const distance = this.getDistanceTo(player, ally.x, ally.y);

        if (distance > this.followThreshold) {
            // Too far - move towards ally
            const input = this.createMoveTowardsInput(player, ally.x, ally.y);
            player.processInput(input);
        } else if (distance < this.followDistance * 0.5) {
            // Too close - back off slightly (don't crowd the ally)
            // Just idle for now, could add backing off logic later
            const input = this.createIdleInput(player);
            player.processInput(input);
        } else {
            // Good distance - match ally's general movement direction
            const input = this.createIdleInput(player);
            player.processInput(input);
        }
    }

    private idle(player: PlayerController): void {
        const input = this.createIdleInput(player);
        player.processInput(input);
    }
}
