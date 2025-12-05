import Phaser from 'phaser';
import type { GameScene } from '../../scenes/Game';
import { Depth } from '../../constants';
import ASSETS from '../../assets';

/**
 * MagicMissile - LizardWizard's primary projectile
 *
 * A purple glowing magic missile with particle trail effect
 */
export class MagicMissile extends Phaser.Physics.Arcade.Sprite {
    private static nextId = 0;

    id: string;
    damage: number;
    gameScene: GameScene;
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
        this.gameScene = scene;
        this.createdTime = Date.now();

        // Add to scene
        scene.add.existing(this);
        scene.physics.add.existing(this);

        // Configure sprite
        this.setTint(0x9966ff); // Purple tint for magic
        this.setScale(0.8);
        this.setDepth(Depth.BULLETS);

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
}
