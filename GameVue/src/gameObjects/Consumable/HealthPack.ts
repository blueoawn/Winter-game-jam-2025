import { Consumable, ConsumableType, ConsumableState } from './Consumable';
import { Depth } from '../../constants';

/**
 * HealthPack consumable
 * Restores player health when picked up
 */
export class HealthPack extends Consumable {
    /**
     * Create a new HealthPack
     * @param x World position X
     * @param y World position Y
     * @param healAmount How much health to restore (default: full health)
     * @param lifetime Optional lifetime in ms before the item disappears (default: no decay)
     */
    constructor(x: number, y: number, healAmount: number = 1, lifetime?: number) {
        const initialState: ConsumableState = {
            id: '',
            type: 'Consumable',
            consumableType: ConsumableType.HealthPack,
            x,
            y,
            frameIndex: 24,  // Frame index for health pack in tileset (row 3, col 1 in 7x4 sheet)
            value: healAmount,
            lifetime,
            netVersion: 0,
            isDead: false
        };

        super(initialState);
    }

    /**
     * Override createView to set custom depth for consumables
     */
    public createView(scene: Phaser.Scene): void {
        super.createView(scene);
        if (this.view) {
            this.view.setDepth(Depth.GROUND_EFFECTS);
        }
    }
} 