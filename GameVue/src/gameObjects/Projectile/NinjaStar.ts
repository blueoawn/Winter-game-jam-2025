import Phaser from 'phaser';
import type { GameScene } from '../../scenes/GameScene';
import { Depth } from '../../constants';
import ASSETS from '../../assets';
import { EntityState } from '../../../network/SyncableEntity';
import Projectile from './Projectile';

/**
 * ninjastar - Right now this is used by Sword and Board, but I think it makes more sense as ability1 of the railgun character
 *
 * A silver/blue spinning blade projectile representing a sword slash attack
 */
export class NinjaStar extends Projectile {
    private static nextId = 0;

    id: string;
    damage: number;
    private createdTime: number;
    private maxLifetime: number = 800; // 0.8 seconds
    private spinSpeed: number = 0.3; // Rotation speed per frame

    constructor(
        scene: GameScene,
        x: number,
        y: number,
        targetX: number,
        targetY: number,
        damage: number = 2
    ) {
        // Use a metallic-looking frame from tiles spritesheet
        super(scene, x, y, ASSETS.spritesheet.tiles.key, 1); // Frame 1 for blade

        this.id = `sword_slash_${Date.now()}_${NinjaStar.nextId++}`;
        this.damage = damage;
        this.createdTime = Date.now();

        // Configure sprite - silver/blue tint for blade
        this.setTint(0xaaccff);
        this.setScale(0.9);

        // Calculate velocity
        const dx = targetX - x;
        const dy = targetY - y;
        const angle = Math.atan2(dy, dx);
        const speed = 600; // Slower than shotgun pellet, but steady

        this.setVelocity(Math.cos(angle) * speed, Math.sin(angle) * speed);
        this.rotation = angle;
    }

    preUpdate(time: number, delta: number): void {
        super.preUpdate(time, delta);

        // Spin the blade
        this.rotation += this.spinSpeed;

        // Auto-destroy after max lifetime
        if (Date.now() - this.createdTime > this.maxLifetime) {
            this.destroy();
            return;
        }

        // Check world bounds
        const bounds = this.gameScene.physics.world.bounds;
        if (this.x < bounds.x || this.x > bounds.x + bounds.width ||
            this.y < bounds.y || this.y > bounds.y + bounds.height) {
            this.destroy();
            return;
        }
    }

    /**
     * Get the damage value of this slash (for collision detection)
     */
    getDamage(): number {
        return this.damage;
    }

    /**
     * Get the power of this slash (compatibility with PlayerBullet interface)
     */
    getPower(): number {
        return this.damage;
    }

    /**
     * Remove this slash from the scene
     */
    remove(): void {
        this.destroy();
    }

    /**
     * Get network state for synchronization (SyncableEntity interface)
     */
    getNetworkState(): EntityState | null {
        if (!this.active) return null;

        return {
            id: this.id,
            type: 'NinjaStar',
            x: Math.round(this.x),
            y: Math.round(this.y),
            velocityX: this.body ? Math.round(this.body.velocity.x) : 0,
            velocityY: this.body ? Math.round(this.body.velocity.y) : 0,
            rotation: this.rotation,
            damage: this.damage
        };
    }

    /**
     * Update from network state (SyncableEntity interface)
     */
    updateFromNetworkState(state: EntityState): void {
        this.setPosition(state.x, state.y);

        if (state.velocityX !== undefined && state.velocityY !== undefined && this.body) {
            this.body.velocity.x = state.velocityX;
            this.body.velocity.y = state.velocityY;
        }

        if (state.rotation !== undefined) {
            this.rotation = state.rotation;
        }

        if (state.damage !== undefined) {
            this.damage = state.damage;
        }
    }
}
