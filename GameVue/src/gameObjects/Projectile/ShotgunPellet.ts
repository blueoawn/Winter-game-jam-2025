import Phaser from 'phaser';
import type { GameScene } from '../../scenes/GameScene';
import { Depth } from '../../constants';
import ASSETS from '../../assets';
import { EntityState } from '../../../network/SyncableEntity';
import Projectile from './Projectile';

/**
 * ShotgunPellet - BoomStick's shotgun projectile
 *
 * A fast-moving pellet with distance-based damage falloff
 * Visual: Orange/yellow tinted sprite representing shotgun scatter
 */
export class ShotgunPellet extends Projectile {
    private static nextId = 0;

    id: string;
    baseDamage: number;
    minDamageMultiplier: number;
    falloffStart: number;
    falloffEnd: number;

    private startX: number;
    private startY: number;
    private distanceTraveled: number = 0;
    private maxLifetime: number = 500; // 0.5 seconds (shorter than magic missile)
    private createdTime: number;

    constructor(
        scene: GameScene,
        x: number,
        y: number,
        targetX: number,
        targetY: number,
        baseDamage: number = 3,
        minDamageMultiplier: number = 0.2,
        falloffStart: number = 80,
        falloffEnd: number = 220
    ) {
        // Use orange/yellow frame from tiles spritesheet
        super(scene, x, y, ASSETS.spritesheet.tiles.key, 2); // Frame 2 for pellet

        this.id = `shotgun_pellet_${Date.now()}_${ShotgunPellet.nextId++}`;
        this.baseDamage = baseDamage;
        this.minDamageMultiplier = minDamageMultiplier;
        this.falloffStart = falloffStart;
        this.falloffEnd = falloffEnd;
        this.createdTime = Date.now();

        // Track starting position for distance calculations
        this.startX = x;
        this.startY = y;

        // Configure sprite - orange/yellow tint for shotgun blast
        this.setTint(0xffaa00);
        this.setScale(0.6);
        // Calculate velocity
        const dx = targetX - x;
        const dy = targetY - y;
        const angle = Math.atan2(dy, dx);
        const speed = 1000; // Faster than magic missile

        this.setVelocity(Math.cos(angle) * speed, Math.sin(angle) * speed);
        this.rotation = angle + Math.PI / 2;
    }

    preUpdate(time: number, delta: number): void {
        super.preUpdate(time, delta);

        // Update distance traveled
        const dx = this.x - this.startX;
        const dy = this.y - this.startY;
        this.distanceTraveled = Math.sqrt(dx * dx + dy * dy);

        // Auto-destroy after max lifetime or max range
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
     * Get the current damage value based on distance traveled
     * Implements linear falloff between falloffStart and falloffEnd
     */
    getDamage(): number {
        if (this.distanceTraveled < this.falloffStart) {
            return this.baseDamage;
        }

        if (this.distanceTraveled > this.falloffEnd) {
            return this.baseDamage * this.minDamageMultiplier;
        }

        // Linear interpolation between falloffStart and falloffEnd
        const falloffRange = this.falloffEnd - this.falloffStart;
        const distanceIntoFalloff = this.distanceTraveled - this.falloffStart;
        const falloffProgress = distanceIntoFalloff / falloffRange;

        const damageMultiplier = 1 - (falloffProgress * (1 - this.minDamageMultiplier));
        return this.baseDamage * damageMultiplier;
    }

    /**
     * Get the power of this pellet (compatibility with PlayerBullet interface)
     */
    getPower(): number {
        return this.getDamage();
    }

    /**
     * Remove this pellet from the scene
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
            type: 'ShotgunPellet',
            x: Math.round(this.x),
            y: Math.round(this.y),
            velocityX: this.body ? Math.round(this.body.velocity.x) : 0,
            velocityY: this.body ? Math.round(this.body.velocity.y) : 0,
            rotation: this.rotation,
            baseDamage: this.baseDamage,
            startX: this.startX,  // Needed for falloff calculation
            startY: this.startY,  // Needed for falloff calculation
            minDamageMultiplier: this.minDamageMultiplier,
            falloffStart: this.falloffStart,
            falloffEnd: this.falloffEnd
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

        // Update damage falloff properties
        if (state.baseDamage !== undefined) this.baseDamage = state.baseDamage;
        if (state.startX !== undefined) this.startX = state.startX;
        if (state.startY !== undefined) this.startY = state.startY;
        if (state.minDamageMultiplier !== undefined) this.minDamageMultiplier = state.minDamageMultiplier;
        if (state.falloffStart !== undefined) this.falloffStart = state.falloffStart;
        if (state.falloffEnd !== undefined) this.falloffEnd = state.falloffEnd;

        // Recalculate distance traveled
        const dx = this.x - this.startX;
        const dy = this.y - this.startY;
        this.distanceTraveled = Math.sqrt(dx * dx + dy * dy);
    }
}
