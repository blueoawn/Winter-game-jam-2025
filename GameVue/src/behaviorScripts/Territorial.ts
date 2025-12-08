import { Behavior } from './Behavior';
import type { EnemyController } from '../gameObjects/NPC/EnemyController';

/**
 * Territorial behavior - Defends a specific area
 *
 * Behavior pattern:
 * - Patrols or idles within home territory
 * - Attacks players that enter territory
 * - Returns to home position when threat leaves
 * - Won't chase players beyond territory boundaries
 */
export class TerritorialBehavior extends Behavior {
    // Territory configuration
    homeX: number;
    homeY: number;
    territoryRadius: number = 300;  // Radius of defended area
    returnThreshold: number = 50;   // How close to home before stopping return

    // Combat configuration
    moveSpeed: number = 150;
    attackRange: number = 350;
    ability1Rate: number = 1200;
    ability2Rate: number = 3500;

    // Tracking
    private targetPlayer: Phaser.Physics.Arcade.Sprite | null = null;
    private lastAbility1Time: number = 0;
    private lastAbility2Time: number = 0;

    constructor(
        homeX: number,
        homeY: number,
        options?: {
            territoryRadius?: number;
            moveSpeed?: number;
            attackRange?: number;
            ability1Rate?: number;
            ability2Rate?: number;
        }
    ) {
        super();

        this.homeX = homeX;
        this.homeY = homeY;

        if (options) {
            this.territoryRadius = options.territoryRadius ?? this.territoryRadius;
            this.moveSpeed = options.moveSpeed ?? this.moveSpeed;
            this.attackRange = options.attackRange ?? this.attackRange;
            this.ability1Rate = options.ability1Rate ?? this.ability1Rate;
            this.ability2Rate = options.ability2Rate ?? this.ability2Rate;
        }
    }

    update(npc: EnemyController, time: number, _delta: number): void {
        // Find nearest player
        const player = this.findNearestPlayer(npc);

        if (!player) {
            this.returnToHome(npc);
            return;
        }

        // Check if player is in territory
        const distanceToHome = Phaser.Math.Distance.Between(
            player.x,
            player.y,
            this.homeX,
            this.homeY
        );

        const playerInTerritory = distanceToHome <= this.territoryRadius;

        if (playerInTerritory) {
            // Player in territory - engage
            this.targetPlayer = player;
            this.engageTarget(npc, time);
        } else {
            // Player outside territory - return home
            this.targetPlayer = null;
            this.returnToHome(npc);
        }
    }

    private engageTarget(npc: EnemyController, time: number): void {
        if (!this.targetPlayer) return;

        const distanceToPlayer = this.getDistanceToTarget(npc, this.targetPlayer);

        // Don't chase outside territory
        const npcDistanceFromHome = Phaser.Math.Distance.Between(
            npc.x,
            npc.y,
            this.homeX,
            this.homeY
        );

        if (npcDistanceFromHome > this.territoryRadius) {
            // Outside territory - return home
            this.returnToHome(npc);
            return;
        }

        // Move towards player if out of attack range
        if (distanceToPlayer > this.attackRange * 0.7) {
            this.moveTowards(npc, this.targetPlayer.x, this.targetPlayer.y, this.moveSpeed);
        } else {
            this.stopMovement(npc);
        }

        // Attack if in range
        if (distanceToPlayer <= this.attackRange) {
            this.tryAttack(npc, time);
        }
    }

    private returnToHome(npc: EnemyController): void {
        const distanceToHome = Phaser.Math.Distance.Between(
            npc.x,
            npc.y,
            this.homeX,
            this.homeY
        );

        // If far from home, move towards it
        if (distanceToHome > this.returnThreshold) {
            this.moveTowards(npc, this.homeX, this.homeY, this.moveSpeed * 0.8);
        } else {
            // Close enough to home - stop
            this.stopMovement(npc);
        }
    }

    private tryAttack(npc: EnemyController, time: number): void {
        if (!this.targetPlayer) return;

        // Prioritize spread shot (ability 2) if available
        if (time - this.lastAbility2Time >= this.ability2Rate) {
            this.fireSpreadShot(npc, this.targetPlayer, npc.power);
            this.lastAbility2Time = time;
        }
        // Fall back to single shot (ability 1)
        else if (time - this.lastAbility1Time >= this.ability1Rate) {
            this.fireSingleShot(npc, this.targetPlayer, npc.power);
            this.lastAbility1Time = time;
        }
    }

    initialize(npc: EnemyController): void {
        // Store initial position as home if not set
        if (this.homeX === undefined || this.homeY === undefined) {
            this.homeX = npc.x;
            this.homeY = npc.y;
        }
    }

    cleanup(): void {
        this.targetPlayer = null;
        this.lastAbility1Time = 0;
        this.lastAbility2Time = 0;
    }
}
