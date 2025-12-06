import Phaser from 'phaser';
import type { GameScene } from '../../scenes/GameScene';
import { Depth } from '../../constants';
import ASSETS from '../../assets';
import { EntityState } from '../../../network/SyncableEntity';
import Projectile from './Projectile';

/**
 * MagicMissile - LizardWizard's primary projectile
 *
 * A purple glowing magic missile with particle trail effect
 */
export class MagicMissile extends Projectile {
    private static nextId = 0;

    id: string;
    damage: number;
    private createdTime: number;
    private maxLifetime: number = 3000; // 3 seconds
    private particleTrail: Phaser.GameObjects.Graphics | null = null;

    constructor(
        scene: GameScene,
        x: number,
        y: number,
        targetX: number,
        targetY: number,
        damage: number = 1
    ) {
        // Use a purple/magic-looking frame from tiles spritesheet
        super(scene, x, y, ASSETS.spritesheet.tiles.key, 3); // Frame 3 for magic

        this.id = `magic_missile_${Date.now()}_${MagicMissile.nextId++}`;
        this.damage = damage;
        this.createdTime = Date.now();

        // Configure sprite
        this.setTint(0x9966ff);
        this.setScale(0.8);
        // Calculate velocity
        const dx = targetX - x;
        const dy = targetY - y;
        const angle = Math.atan2(dy, dx);
        const speed = 800;

        this.setVelocity(Math.cos(angle) * speed, Math.sin(angle) * speed);
        this.rotation = angle + Math.PI / 2;

        // Create particle trail effect
        this.createParticleTrail();

        // Cleanup on destroy
        this.on('destroy', () => {
            if (this.particleTrail) {
                this.particleTrail.destroy();
                this.particleTrail = null;
            }
        });
    }

    private createParticleTrail(): void {
        if (!this.gameScene) {
            console.warn('MagicMissile: gameScene not initialized');
            return;
        }
        this.particleTrail = this.gameScene.add.graphics();
        this.particleTrail.setDepth(Depth.BULLETS - 1);
    }

    preUpdate(time: number, delta: number): void {
        super.preUpdate(time, delta);

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

        // Update particle trail
        this.updateParticleTrail();
    }

    private updateParticleTrail(): void {
        if (!this.particleTrail || !this.active) return;

        this.particleTrail.clear();

        // Draw glowing trail behind missile
        const trailLength = 5;
        for (let i = 0; i < trailLength; i++) {
            const progress = i / trailLength;
            const alpha = 0.6 - (progress * 0.5);
            const size = 8 - (progress * 4);

            // Calculate trail position
            const trailX = this.x - (this.body!.velocity.x * progress * 0.05);
            const trailY = this.y - (this.body!.velocity.y * progress * 0.05);

            this.particleTrail.fillStyle(0x9966ff, alpha);
            this.particleTrail.fillCircle(trailX, trailY, size);
        }
    }

    /**
     * Get the damage value of this missile (for collision detection)
     */
    getDamage(): number {
        return this.damage;
    }

    /**
     * Get the power of this missile (compatibility with PlayerBullet interface)
     */
    getPower(): number {
        return this.damage;
    }

    /**
     * Remove this missile from the scene
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
            type: 'MagicMissile',
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
