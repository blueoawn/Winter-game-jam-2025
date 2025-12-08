import Phaser from 'phaser';
import type { GameScene } from '../scenes/GameScene';
import { Depth } from '../constants';
import { SyncableEntity, EntityState, EntityDelta } from '../../network/SyncableEntity';

/**
 * Wall - Static obstacle entity with optional destructibility
 *
 * Features:
 * - Non-moving entity that blocks player/enemy movement
 * - Always requires a sprite (for invisible walls, use AreaBoundary instead)
 * - Collision body automatically matches sprite dimensions
 * - Health parameter of -1 indicates indestructible (no network sync needed)
 * - Any positive health value makes wall destructible (automatic network sync)
 * - Indestructible walls don't waste network bandwidth
 */
export default class Wall extends Phaser.Physics.Arcade.Sprite implements SyncableEntity {
    private static nextId = 0;

    id: string; // Implements SyncableEntity.id
    wallId: string; // Alias for id (backwards compatibility)
    wallType: string = 'Wall';
    gameScene: GameScene;

    health: number;
    maxHealth: number;
    isIndestructible: boolean;

    private healthBarContainer: Phaser.GameObjects.Container | null = null;

    // Sync-related
    protected lastSyncedState: EntityState | null = null;
    public view: any = null;

    /**
     * Creates a new Wall instance
     *
     * @param scene - The game scene
     * @param x - X position
     * @param y - Y position
     * @param spriteKey - Sprite sheet key (optional, defaults to invisible wall)
     * @param frame - Sprite frame (defaults to 0)
     * @param health - Health value (-1 for indestructible, any positive number for destructible)
     */
    constructor(
        scene: GameScene,
        x: number,
        y: number,
        spriteKey: string,
        frame: number = 0,
        health: number = -1
    ) {
        super(scene, x, y, spriteKey, frame);

        this.gameScene = scene;

        // Initialize health system
        this.health = health;
        this.maxHealth = health;
        this.isIndestructible = health === -1;

        // Only generate network ID for destructible walls
        if (!this.isIndestructible) {
            this.id = `wall_${Date.now()}_${Wall.nextId++}`;
            this.wallId = this.id; // Alias for backwards compatibility
        } else {
            this.id = ''; // Indestructible walls don't need network tracking
            this.wallId = '';
        }

        // Add to scene
        scene.add.existing(this);
        scene.physics.add.existing(this, true); // true = static body (immovable)

        // Auto-size collision body to match sprite dimensions
        this.body!.setSize(this.width, this.height);
        this.setImmovable(true);

        // Initialize lastSyncedState for network sync (only for destructible walls)
        const initialNetState = this.getNetworkState();
        if (initialNetState) {
            this.lastSyncedState = this.cloneState(initialNetState);
        } else {
            // Provide a safe default state when there's no network state (indestructible walls)
            this.lastSyncedState = {
                id: this.id || '',
                type: this.wallType,
                x: Math.round(this.x),
                y: Math.round(this.y),
                health: this.health,
                maxHealth: this.maxHealth,
                netVersion: 0,
                isDead: false
            };
        }

        // Create health bar for destructible walls only
        if (!this.isIndestructible && this.health > 0) {
            this.createHealthBar();
        }

        // Setup destruction handler for cleanup
        this.handleDestruction();
    }

    /**
     * Utility: clone an EntityState (or return null)
     */
    private cloneState(state: EntityState | null): EntityState | null {
        return state ? { ...state } : null;
    }
    // lastSyncedState is always initialized; compare directly against it
    public getDelta(): EntityDelta | null {
        if (this.isIndestructible) return null;

        const current = this.getNetworkState();
        if (!current) return null;

        // If we have never synced, send full state
        if (!this.lastSyncedState) {
            this.lastSyncedState = this.cloneState(current);
            return { ...current } as EntityDelta;
        }

        const delta: Partial<EntityState> & { id: string } = { id: current.id };
        let changed = false;

        const keysToCheck: (keyof EntityState)[] = ['x', 'y', 'health', 'maxHealth', 'netVersion', 'isDead'];
        for (const key of keysToCheck) {
            if ((current as any)[key] !== (this.lastSyncedState as any)[key]) {
                (delta as any)[key] = (current as any)[key];
                changed = true;
            }
        }

        if (!changed) return null;

        // Update lastSyncedState to current full state
        this.lastSyncedState = this.cloneState(current);
        return delta as EntityDelta;
    }

    /**
     * Apply a delta from the network to this local instance.
     */
    public applyDelta(delta: EntityDelta): void {
        if (this.isIndestructible) return;
        if (!delta || (delta as any).id && (delta as any).id !== this.id) {
            // If the delta is for another entity, ignore it.
            if ((delta as any).id && (delta as any).id !== this.id) return;
        }

        // Apply fields present in delta
        const postNetState = this.getNetworkState();
        if (postNetState) {
            this.lastSyncedState = this.cloneState(postNetState);
        } else {
            this.lastSyncedState = {
                id: this.id || '',
                type: this.wallType,
                x: Math.round(this.x),
                y: Math.round(this.y),
                health: this.health,
                maxHealth: this.maxHealth,
                netVersion: 0,
                isDead: false
            };
        }
        if ((delta as any).y !== undefined) this.y = (delta as any).y;
        if ((delta as any).health !== undefined) this.health = (delta as any).health;
        if ((delta as any).maxHealth !== undefined) this.maxHealth = (delta as any).maxHealth;

        // Update visuals
        this.updateHealthBarValue();
        if (this.health <= 0) {
            this.die();
        }

        // Refresh lastSyncedState to reflect applied state
        this.lastSyncedState = this.getNetworkState() ? { ...(this.getNetworkState() as EntityState) } : null;
    }

    /**
     * Reconcile authoritative server state: overwrite local state with server-provided state.
     */
    public reconcile(serverState: EntityState): void {
        if (this.isIndestructible) return;

        if (serverState.x !== undefined) this.x = serverState.x;
        if (serverState.y !== undefined) this.y = serverState.y;
        if (serverState.health !== undefined) this.health = serverState.health;
        if (serverState.maxHealth !== undefined) this.maxHealth = serverState.maxHealth;

        this.updateHealthBarValue();
        if (this.health <= 0) {
            this.die();
        }

        this.lastSyncedState = this.cloneState(serverState);
    }

    /**
     * Create a client-side view representation for this entity.
     * For this class we typically use the sprite itself as the view, but this method
     * allows a distinct view to be created if needed by the networking system.
     */
    public createView(scene: any): void {
        // By default use the sprite itself as the view
        this.view = this;

        // Ensure health bar exists for view if applicable
        if (!this.healthBarContainer && !this.isIndestructible && this.health > 0) {
            this.createHealthBar();
        }
    }

    /**
     * Sync visual representation from current authoritative fields.
     */
    public syncView(): void {
        if (!this.view) return;

        // Ensure sprite is positioned at authoritative coordinates
        this.setPosition(this.x, this.y);

        // Move health bar container if present
        if (this.healthBarContainer) {
            const offsetY = this.displayHeight / 2 + 10;
            this.healthBarContainer.setPosition(this.x, this.y - offsetY);
            this.updateHealthBarValue();
        }
    }

    /**
     * Creates a health bar container above the wall
     */
    private createHealthBar(): void {
        const barWidth = this.displayWidth;
        const barHeight = 6;
        const offsetY = this.displayHeight / 2 + 10;

        // Background (red) - shows maximum health
        const healthBarBottom = this.scene.add.rectangle(
            0,
            0,
            barWidth,
            barHeight,
            0xff0000
        );

        // Foreground (green) - shows current health
        const healthBarTop = this.scene.add.rectangle(
            0,
            0,
            barWidth,
            barHeight,
            0x08ff00
        );

        // Create container positioned above the wall
        this.healthBarContainer = this.scene.add.container(
            this.x,
            this.y - offsetY,
            [healthBarBottom, healthBarTop]
        );

        this.healthBarContainer.setDepth(Depth.PLAYER_UI);
    }

    /**
     * Updates the health bar to reflect current health
     */
    private updateHealthBarValue(): void {
        if (!this.healthBarContainer || this.isIndestructible) return;

        // Avoid division by zero
        const max = this.maxHealth > 0 ? this.maxHealth : 1;
        const remainingHealthRatio = Math.max(0, this.health) / max;
        const fullHealthWidth = (this.healthBarContainer.list[0] as Phaser.GameObjects.Rectangle).width;
        const remainingHealthWidth = fullHealthWidth * remainingHealthRatio;

        (this.healthBarContainer.list[1] as Phaser.GameObjects.Rectangle).width = remainingHealthWidth;
    }

    /**
     * Applies damage to the wall
     *
     * @param damage - Amount of damage to apply
     */
    hit(damage: number): void {
        // Indestructible walls cannot be damaged
        if (this.isIndestructible) {
            return;
        }

        this.health -= damage;
        this.updateHealthBarValue();

        if (this.health <= 0) {
            this.die();
        }
    }

    /**
     * Destroys the wall and notifies the game scene
     */
    die(): void {
        // Create explosion or destruction effect
        this.gameScene.addExplosion(this.x, this.y);

        // Remove from scene (will trigger network sync in multiplayer)
        this.gameScene.removeWall(this);
    }

    /**
     * Sets up destruction event handler for cleanup
     */
    private handleDestruction(): void {
        this.once(Phaser.GameObjects.Events.DESTROY, () => {
            // Clean up health bar
            if (this.healthBarContainer) {
                this.healthBarContainer.destroy();
                this.healthBarContainer = null;
            }
        });
    }

    /**
     * Gets the wall data for network serialization (SyncableEntity interface)
     * Only destructible walls need network sync
     *
     * @returns Object containing wall state for network sync, or null if indestructible
     */
    getNetworkState(): EntityState | null {
        // Indestructible walls don't need network sync
        if (this.isIndestructible) {
            return null;
        }

        return {
    id: this.id,
    type: this.wallType,
    x: Math.round(this.x),
    y: Math.round(this.y),
    health: this.health,
    maxHealth: this.maxHealth,
    netVersion: 0,
    isDead: false
};
    }

    /**
     * Updates wall state from network data (SyncableEntity interface)
     *
     * @param state - Network state data
     */
    updateFromNetworkState(state: EntityState): void {
        if (this.isIndestructible) return;

        // Update position (shouldn't change for static walls, but included for completeness)
        if (state.x !== undefined) this.x = state.x;
        if (state.y !== undefined) this.y = state.y;

        // Update health
        const oldHealth = this.health;
        if (state.health !== undefined) {
            this.health = state.health;
        }

        if (oldHealth !== this.health) {
            this.updateHealthBarValue();

            if (this.health <= 0) {
                this.die();
            }
        }

        // Keep lastSyncedState in sync with authoritative update
        this.lastSyncedState = this.cloneState(state);
    }
}
