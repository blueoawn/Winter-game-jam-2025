import { Behavior } from './Behavior';
import type { EnemyController } from '../gameObjects/NPC/EnemyController';

/**
 * Aggressive behavior - Actively hunts and attacks players
 *
 * Behavior pattern:
 * - Continuously seeks nearest player
 * - Chases player when out of range
 * - Stops and fires when in attack range
 * - Prioritizes spread shot over single shot
 */
export class AggressiveBehavior extends Behavior {
    // Configurable parameters
    moveSpeed: number = 200;
    attackRange: number = 400;
    chaseThreshold: number = 0.7;  // Start chasing when distance > attackRange * threshold

    // Ability cooldowns (in milliseconds)
    ability1Rate: number = 1000;  // Single shot cooldown
    ability2Rate: number = 3000;  // Spread shot cooldown

    // Tracking
    private targetPlayer: Phaser.Physics.Arcade.Sprite | null = null;
    private lastAbility1Time: number = 0;
    private lastAbility2Time: number = 0;

    constructor(options?: {
        moveSpeed?: number;
        attackRange?: number;
        ability1Rate?: number;
        ability2Rate?: number;
    }) {
        super();

        if (options) {
            this.moveSpeed = options.moveSpeed ?? this.moveSpeed;
            this.attackRange = options.attackRange ?? this.attackRange;
            this.ability1Rate = options.ability1Rate ?? this.ability1Rate;
            this.ability2Rate = options.ability2Rate ?? this.ability2Rate;
        }
    }

    update(npc: EnemyController, time: number, _delta: number): void {
        // Find target player if we don't have one
        if (!this.targetPlayer) {
            this.targetPlayer = this.findNearestPlayer(npc);
        }

        // No target found, stop
        if (!this.targetPlayer) {
            this.stopMovement(npc);
            return;
        }

        // Calculate distance to player
        const distance = this.getDistanceToTarget(npc, this.targetPlayer);

        // Movement logic: chase if too far, stop if in range
        if (distance > this.attackRange * this.chaseThreshold) {
            this.moveTowards(npc, this.targetPlayer.x, this.targetPlayer.y, this.moveSpeed);
        } else {
            this.stopMovement(npc);
        }

        // Attack if in range
        if (distance <= this.attackRange) {
            this.tryAttack(npc, time);
        }
    }

    private tryAttack(npc: EnemyController, time: number): void {
        if (!this.targetPlayer) return;

        // Prioritize spread shot (ability 2) if available
        if (time - this.lastAbility2Time >= this.ability2Rate) {
            this.fireSpreadShot(npc, this.targetPlayer, npc.power);
            this.lastAbility2Time = time;
        }
        // Fall back to single shot (ability 1) if spread is on cooldown
        else if (time - this.lastAbility1Time >= this.ability1Rate) {
            this.fireSingleShot(npc, this.targetPlayer, npc.power);
            this.lastAbility1Time = time;
        }
    }

    cleanup(npc: EnemyController): void {
        // Reset tracking when behavior is removed
        this.targetPlayer = null;
        this.lastAbility1Time = 0;
        this.lastAbility2Time = 0;
    }
}
