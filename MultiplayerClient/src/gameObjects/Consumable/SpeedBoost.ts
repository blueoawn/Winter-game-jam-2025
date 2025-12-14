//TODO - this is a consumable that increases player speed for a duration when picked up
import { Consumable, ConsumableType, ConsumableState } from './Consumable';
import { Depth } from '../../constants';

/**
 * SpeedBoost consumable
 * Increases player speed temporarily when picked up
 */
export class SpeedBoost extends Consumable {
    /**
     * Create a new SpeedBoost
     * @param x World position X
     * @param y World position Y
     * @param speedMultiplier Speed multiplier (e.g., 1.5 = 50% faster)
     * @param lifetime Optional lifetime in ms before the item disappears (default: no decay)
     */
    constructor(x: number, y: number, speedMultiplier: number = 1.5, lifetime?: number) {
        const initialState: ConsumableState = {
            id: '',
            type: 'Consumable',
            consumableType: ConsumableType.SpeedBoost,
            x,
            y,
            frameIndex: 25,  // Frame index for speed boost in tileset
            value: speedMultiplier,
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