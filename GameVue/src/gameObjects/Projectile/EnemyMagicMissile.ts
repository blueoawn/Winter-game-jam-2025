import Phaser from 'phaser';
import type { GameScene } from '../../scenes/GameScene';
import { Depth } from '../../constants';
import ASSETS from '../../assets';

/**
 * EnemyMagicMissile - Enemy version of LizardWizard's magic missile
 * Used by enemy Lizard Wizard boss
 */
export class EnemyMagicMissile extends Phaser.Physics.Arcade.Sprite {
    private static nextId = 0;

    id: string;
    damage: number;
    private createdTime: number;
    private maxLifetime: number = 3000; // 3 seconds
    private particleTrail: Phaser.GameObjects.Graphics | null = null;
    gameScene: GameScene;

    constructor(
        scene: GameScene,
        x: number,
        y: number,
        targetX: number,
        targetY: number,
        damage: number = 1
    ) {
        super(scene, x, y, ASSETS.spritesheet.tiles.key, 3);

        this.id = `enemy_magic_missile_${Date.now()}_${EnemyMagicMissile.nextId++}`;
        this.damage = damage;
        this.createdTime = Date.now();
        this.gameScene = scene;

        scene.add.existing(this);
        scene.physics.add.existing(this);

        this.setTint(0xff3300);
        this.setScale(0.8);
        this.setDepth(Depth.PROJECTILE);

        const dx = targetX - x;
        const dy = targetY - y;
        const angle = Math.atan2(dy, dx);
        const speed = 600;

        this.setVelocity(Math.cos(angle) * speed, Math.sin(angle) * speed);
        this.rotation = angle + Math.PI / 2;

        this.createParticleTrail();

        this.on('destroy', () => {
            if (this.particleTrail) {
                this.particleTrail.destroy();
                this.particleTrail = null;
            }
        });
    }

    private createParticleTrail(): void {
        // Create simple graphics-based particle trail
        this.particleTrail = this.scene.add.graphics();
        this.particleTrail.setDepth(Depth.PROJECTILE - 1);
    }

    preUpdate(time: number, delta: number): void {
        super.preUpdate(time, delta);

        // Update particle trail
        if (this.particleTrail) {
            this.particleTrail.clear();
            this.particleTrail.fillStyle(0xff3300, 0.3);
            this.particleTrail.fillCircle(this.x, this.y, 8);
        }

        // Destroy after lifetime expires
        if (time - this.createdTime > this.maxLifetime) {
            this.destroy();
        }
    }

    destroy(fromScene?: boolean): void {
        if (this.particleTrail) {
            this.particleTrail.destroy();
            this.particleTrail = null;
        }
        super.destroy(fromScene);
    }
}

