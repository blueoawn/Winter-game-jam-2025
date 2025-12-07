import { SyncableEntity, EntityState, EntityDelta } from '../../../network/SyncableEntity';
import Sprite = Phaser.Physics.Arcade.Sprite;
// import { v4 as uuidv4 } from 'uuid'; // TODO: Install uuid package or use crypto.randomUUID()

/**
 * Consumable types enumeration
 */
export enum ConsumableType {
    HealthPack = 'health_pack',
    SpeedBoost = 'speed_boost',
    InvincibilityGem = 'invincibility_gem'
}

/**
 * Consumable state interface extending EntityState
 */
export interface ConsumableState extends EntityState {
    consumableType: ConsumableType;
    frameIndex: number;  // Frame index in the tileset
    lifetime?: number;   // Optional lifetime in ms (for decay)
    value: number;       // Effect value (health amount, speed multiplier, etc.)
}

/**
 * Helper class for consumable items that can be picked up by players
 * Implements SyncableEntity for network synchronization
 */
export class Consumable implements SyncableEntity {
    public id: string;
    // Override the state type for type safety
    public state: ConsumableState;
    // The view will be a Phaser Sprite with a physics body on the host/client
    public view: Sprite | null = null;
    public lastSyncedState: ConsumableState | null = null;

    constructor(initialState: ConsumableState) {
        this.id = initialState.id || crypto.randomUUID();
        this.state = initialState;
        this.state.id = this.id;
        this.state.type = 'Consumable';
        this.state.netVersion = this.state.netVersion || 0;
        this.state.isDead = this.state.isDead || false;
    }

    /**
     * Get the current state for network synchronization
     */
    public getNetworkState(): ConsumableState {
        return { ...this.state };
    }

    /**
     * Apply a delta update from the network
     */
    public applyDelta(delta: EntityDelta): void {
        Object.assign(this.state, delta);
        this.state.netVersion = (this.state.netVersion || 0) + 1;
        this.syncView();
    }

    /**
     * Client/Host: Creates the visual sprite and physics body.
     */
    public createView(scene: Phaser.Scene): void {
        // Create the Sprite. The frame is provided in the state.
        // Health Pack example: (See sprite tiles.png row3,col1) - Assuming frame index 21 for a 7x4 sheet.
        const sprite = scene.physics.add.sprite(
            this.state.x, 
            this.state.y, 
            'tiles', // Assuming a tileset key named 'tiles'
            this.state.frameIndex
        );

        // Make the consumable slightly smaller and static
        sprite.body.setImmovable(true);
        sprite.setCircle(sprite.width / 2); // Set circular hit area

        this.view = sprite;
        this.syncView();
    }

    /**
     * Client/Host: Aligns the visual view with the synced state data.
     */
    public syncView(): void {
        if (!this.view) return;

        // Position sync (Important for non-host clients)
        this.view.setPosition(this.state.x, this.state.y);

        // Visibility sync (Ensures consumed entities disappear immediately)
        this.view.setVisible(!this.state.isDead);

        // Check for state changes like frame index if the item type could change
        // Frame update handled by setFrame
        if (this.view.displayOriginX !== this.state.frameIndex) {
            this.view.setFrame(this.state.frameIndex);
        }
    }

    /**
     * Host/Server: Update method for decay logic.
     * Only runs on the host (source of truth) to modify state.
     * @param delta Time since last update in ms.
     */
    public update(delta: number): void {
        if (this.state.isDead) return;

        // Optional Decay Logic
        if (this.state.lifetime && this.state.lifetime > 0) {
            this.state.lifetime -= delta;

            if (this.state.lifetime <= 0) {
                console.log(`Consumable ${this.id} decayed.`);
                // Set isDead=true to flag for network sync and subsequent destruction
                this.state.isDead = true;
            }
        }
    }

    /**
     * Host/Server: Applies the statistical effect to the player.
     * This method is triggered by the **Game Scene/Manager** when an overlap is detected.
     * @param playerController The PlayerController instance that consumed the item.
     */
    public applyEffect(playerController: any): void {
        if (this.state.isDead) return;
        
        console.log(`Applying effect: ${this.state.consumableType} for ${this.state.value}`);

        switch (this.state.consumableType) {
            case ConsumableType.HealthPack:
                // Example: Restore player to full health
                if (playerController.health !== playerController.maxHealth) {
                    playerController.health = playerController.maxHealth;
                    playerController.updateHealthBarValue(); // Assumes method exists
                }
                break;
            case ConsumableType.SpeedBoost:
                // Example: Temporarily increase speed (requires timer management on the player)
                playerController.applyTemporarySpeedBoost(this.state.value, 5000); // 5 seconds
                break;
            default:
                console.warn(`Unknown consumable type: ${this.state.consumableType}`);
        }

        // Mark as consumed for network synchronization
        this.state.isDead = true;
    }
}