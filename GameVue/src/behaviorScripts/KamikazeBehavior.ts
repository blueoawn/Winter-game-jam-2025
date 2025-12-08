import { Behavior } from './Behavior';
import type { EnemyController } from '../gameObjects/NPC/EnemyController';

/**
 * Kamikaze behavior - Chases player relentlessly and explodes on contact
 *
 * Behavior pattern:
 * - Always seeks nearest player (infinite range)
 * - Never stops chasing
 * - Explodes when close enough to player
 * - No shooting, only melee contact damage
 */
export class KamikazeBehavior extends Behavior {
    moveSpeed: number = 120;
    explosionRange: number = 60;  // Distance at which slime explodes
    explosionDamage: number = 1;

    private targetPlayer: Phaser.Physics.Arcade.Sprite | null = null;

    constructor(options?: {
        moveSpeed?: number;
        explosionRange?: number;
        explosionDamage?: number;
    }) {
        super();

        if (options) {
            this.moveSpeed = options.moveSpeed ?? this.moveSpeed;
            this.explosionRange = options.explosionRange ?? this.explosionRange;
            this.explosionDamage = options.explosionDamage ?? this.explosionDamage;
        }
    }

    update(npc: EnemyController, _time: number, _delta: number): void {
        // Always track player
        this.targetPlayer = this.findNearestPlayer(npc);

        if (!this.targetPlayer) {
            this.stopMovement(npc);
            return;
        }

        const distance = this.getDistanceToTarget(npc, this.targetPlayer);

        // Explode if close enough
        if (distance <= this.explosionRange) {
            this.explode(npc);
            return;
        }

        // Always chase player
        this.moveTowards(npc, this.targetPlayer.x, this.targetPlayer.y, this.moveSpeed);
    }

    private explode(npc: EnemyController): void {
        // Create explosion visual
        npc.gameScene.addExplosion(npc.x, npc.y);

        // Deal damage to nearby players
        if (this.targetPlayer && this.targetPlayer.active) {
            const distance = this.getDistanceToTarget(npc, this.targetPlayer);
            if (distance <= this.explosionRange) {
                // Damage player
                if ((this.targetPlayer as any).takeDamage) {
                    (this.targetPlayer as any).takeDamage(this.explosionDamage);
                }
            }
        }

        // Destroy self
        npc.die();
    }

    cleanup(_npc: EnemyController): void {
        this.targetPlayer = null;
    }
}

