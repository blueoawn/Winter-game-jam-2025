import { Behavior } from './Behavior';
import type { EnemyController } from '../../../../managers/EnemyController';

/**
 * Pacifist behavior - Non-aggressive wandering
 *
 * Behavior pattern:
 * - Wanders randomly within an area
 * - Flees from nearby players
 * - Never attacks
 * - Peaceful exploration
 */
export class PacifistBehavior extends Behavior {
    // Movement configuration
    wanderSpeed: number = 100;
    fleeSpeed: number = 250;
    fleeDistance: number = 200;  // Start fleeing when player is this close
    safeDistance: number = 400;  // Stop fleeing when player is this far

    // Wander configuration
    wanderRadius: number = 200;  // How far from center to wander
    centerX: number;
    centerY: number;

    // Wander state
    private wanderTargetX: number = 0;
    private wanderTargetY: number = 0;
    private wanderCooldown: number = 0;
    private wanderCooldownMax: number = 2000;  // Pick new wander target every 2 seconds

    constructor(
        centerX: number,
        centerY: number,
        options?: {
            wanderSpeed?: number;
            fleeSpeed?: number;
            fleeDistance?: number;
            wanderRadius?: number;
        }
    ) {
        super();

        this.centerX = centerX;
        this.centerY = centerY;

        if (options) {
            this.wanderSpeed = options.wanderSpeed ?? this.wanderSpeed;
            this.fleeSpeed = options.fleeSpeed ?? this.fleeSpeed;
            this.fleeDistance = options.fleeDistance ?? this.fleeDistance;
            this.wanderRadius = options.wanderRadius ?? this.wanderRadius;
        }

        // Initialize first wander target
        this.pickNewWanderTarget();
    }

    update(npc: EnemyController, _time: number, delta: number): void {
        const player = this.findNearestPlayer(npc);

        // Check if player is nearby and we should flee
        if (player) {
            const distanceToPlayer = this.getDistanceToTarget(npc, player);

            if (distanceToPlayer < this.fleeDistance) {
                // Too close - flee!
                this.flee(npc, player);
                return;
            } else if (distanceToPlayer < this.safeDistance) {
                // Within awareness range but not threatening - slow down wandering
                this.wander(npc, delta, true);
                return;
            }
        }

        // No threat nearby - normal wandering
        this.wander(npc, delta, false);
    }

    private flee(npc: EnemyController, player: Phaser.Physics.Arcade.Sprite): void {
        // Move away from player
        this.moveAwayFrom(npc, player.x, player.y, this.fleeSpeed);

        // Reset wander cooldown so we pick a new target after fleeing
        this.wanderCooldown = 0;
    }

    private wander(npc: EnemyController, delta: number, cautious: boolean): void {
        // Update wander cooldown
        this.wanderCooldown -= delta;

        // Check if we need a new wander target
        if (this.wanderCooldown <= 0) {
            this.pickNewWanderTarget();
            this.wanderCooldown = this.wanderCooldownMax;
        }

        // Check if we've reached the wander target
        const distanceToTarget = Phaser.Math.Distance.Between(
            npc.x,
            npc.y,
            this.wanderTargetX,
            this.wanderTargetY
        );

        if (distanceToTarget < 20) {
            // Reached target - pick a new one
            this.pickNewWanderTarget();
        } else {
            // Move towards wander target
            const speed = cautious ? this.wanderSpeed * 0.5 : this.wanderSpeed;
            this.moveTowards(npc, this.wanderTargetX, this.wanderTargetY, speed);
        }
    }

    private pickNewWanderTarget(): void {
        // Pick a random point within wander radius
        const angle = Math.random() * Math.PI * 2;
        const distance = Math.random() * this.wanderRadius;

        this.wanderTargetX = this.centerX + Math.cos(angle) * distance;
        this.wanderTargetY = this.centerY + Math.sin(angle) * distance;
    }

    initialize(npc: EnemyController): void {
        // Use NPC's starting position as center if not provided
        if (this.centerX === undefined || this.centerY === undefined) {
            this.centerX = npc.x;
            this.centerY = npc.y;
        }
    }

    cleanup(): void {
        // Reset wander state
        this.wanderCooldown = 0;
    }
}
