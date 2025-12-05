import Phaser from 'phaser';
import type { GameScene } from '../scenes/Game';
import { Depth } from '../constants';
import { SyncableEntity, EntityState } from '../../network/SyncableEntity';

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

    id: string;  // Implements SyncableEntity.id
    wallId: string;  // Alias for id (backwards compatibility)
    wallType: string = 'Wall';
    gameScene: GameScene;

    health: number;
    maxHealth: number;
    isIndestructible: boolean;

    private healthBarContainer: Phaser.GameObjects.Container | null = null;

    /**
     * Creates a new Wall instance
     *
     * @param scene - The game scene
     * @param x - X position
     * @param y - Y position
     * @param spriteKey - Sprite sheet key (required)
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

        // Set rendering depth
        this.setDepth(Depth.TILES);

        // Create health bar for destructible walls only
        if (!this.isIndestructible && this.health > 0) {
            this.createHealthBar();
        }

        // Handle cleanup when wall is destroyed
        this.handleDestruction();
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

        const remainingHealthRatio = Math.max(0, this.health) / this.maxHealth;
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
            maxHealth: this.maxHealth
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
    }
}
