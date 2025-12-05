import { Behavior } from './Behavior';
import type { EnemyController } from '../../../../managers/EnemyController';

/**
 * IdleBehavior - NPC stands still and does nothing.
 *
 * Behavior pattern:
 * - No wandering
 * - No fleeing
 * - No attacking
 * - Does not modify movement or velocity
 * - Pure passive idle
 */
export class IdleBehavior extends Behavior {

    constructor() {
        super();
    }

    /**
     * Called every update tick.
     * This implementation does nothing, leaving the NPC idle.
     */
    update(_npc: EnemyController, _time: number, _delta: number): void {
        // Intentionally empty
    }

    /**
     * Initialize behavior when assigned to an NPC.
     * Clears movement so the NPC remains fully idle.
     */
    initialize(npc: EnemyController): void {
        // Stop movement.
        npc.setVelocity(0, 0);
    }

    /**
     * Cleanup when behavior is removed.
     * No special cleanup needed.
     */
    cleanup(): void {
        // Nothing to clean.
    }
}
