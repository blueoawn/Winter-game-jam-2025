import { PlayerController } from './PlayerController';
import { GameScene } from '../../scenes/Game';
import { Depth } from '../../constants';
import Rectangle = Phaser.GameObjects.Rectangle;
import Graphics = Phaser.GameObjects.Graphics;
import TimerEvent = Phaser.Time.TimerEvent;
import { NinjaStar } from '../Projectile/NinjaStar'; // TODO - Depricate this

export class SwordAndBoard extends PlayerController {
    private slashes: Set<NinjaStar> = new Set();
    shield: Rectangle | null;
    shieldTimer: TimerEvent | null;

    // Ability 1 - Heavy Slash config
    slashDamage = 2;
    slashWidth = 60;
    slashHeight = 15;
    slashOffset = 50;
    slashDuration = 250;
    slashArc = Math.PI * 0.8;

    // Runtime state
    private slashGraphics: Graphics | null = null;
    private slashStartTime = 0;
    private slashBaseAngle = 0;
    private isSlashing = false;
    private hitEnemiesSlash: Set<any> = new Set();

    constructor(scene: GameScene, x: number, y: number) {
        super(scene, x, y, 1);  // Frame 1 for SwordAndBoard

        // Override stats - slow but tanky
        this.characterSpeed = 600;
        this.velocityMax = 350;
        this.maxHealth = 3;  // More health
        this.health = this.maxHealth;
        this.ability1Rate = 20;   // Slower attack
        this.ability2Rate = 180;  // Shield every 3 seconds

        this.on('destroy', () => {
            this.removeShield();
            this.removeShieldTimer();
            this.slashes.forEach(slash => slash.destroy());
            this.slashes.clear();
        })
    }

    public preUpdate(time: number, delta: number) {
        super.preUpdate(time, delta);
        this.updateShieldPositionAndRotation();
    }
    
    startSlash(): void {
            this.isSlashing = true;
            this.slashStartTime = this.gameScene.time.now;
            this.slashBaseAngle = this.rotation - Math.PI / 2;
            this.hitEnemiesSlash.clear();
    
            this.slashGraphics = this.gameScene.add.graphics();
            this.slashGraphics.setDepth(Depth.ABILITIES);
        }
    
        updateSlash(time: number): void {
            if (!this.slashGraphics) return;
    
            const elapsed = time - this.slashStartTime;
            const progress = Math.min(elapsed / this.slashDuration, 1);
    
            this.slashGraphics.clear();
    
            const startAngle = this.slashBaseAngle - this.slashArc / 2;
            const currentAngle = startAngle + this.slashArc * progress;
    
            const slashX = this.x + Math.cos(currentAngle) * this.slashOffset;
            const slashY = this.y + Math.sin(currentAngle) * this.slashOffset;
    
            this.slashGraphics.fillStyle(0xffffff, 0.9);
            this.slashGraphics.save();
            this.slashGraphics.translateCanvas(slashX, slashY);
            this.slashGraphics.rotateCanvas(currentAngle);
            this.slashGraphics.fillRect(-this.slashWidth / 2, -this.slashHeight / 2, this.slashWidth, this.slashHeight);
            this.slashGraphics.restore();
    
            // Draw trail
            this.slashGraphics.lineStyle(3, 0xffffff, 0.4);
            this.slashGraphics.beginPath();
            this.slashGraphics.arc(this.x, this.y, this.slashOffset, startAngle, currentAngle);
            this.slashGraphics.strokePath();
    
            this.checkSlashHits(slashX, slashY, currentAngle);
    
            if (progress >= 1) {
                this.endSlash();
            }
        }
    
        endSlash(): void {
            this.isSlashing = false;
            this.hitEnemiesSlash.clear();
    
            if (this.slashGraphics) {
                this.slashGraphics.destroy();
                this.slashGraphics = null;
            }
        }
    
        checkSlashHits(slashX: number, slashY: number, slashAngle: number): void {
            // Check walls
            const walls = this.gameScene.wallGroup.getChildren();
            for (const wall of walls) {
                const w = wall as any;
                if (!w.active || this.hitEnemiesSlash.has(w)) continue;
    
                const dx = w.x - slashX;
                const dy = w.y - slashY;
    
                const cos = Math.cos(-slashAngle);
                const sin = Math.sin(-slashAngle);
                const localX = dx * cos - dy * sin;
                const localY = dx * sin + dy * cos;
    
                if (Math.abs(localX) < this.slashWidth / 2 + 20 &&
                    Math.abs(localY) < this.slashHeight / 2 + 20) {
                    if (w.hit && !w.isIndestructible) {
                        w.hit(this.slashDamage);
                        this.hitEnemiesSlash.add(w);
                    }
                }
            }
    
            // Check enemies
            const enemies = this.gameScene.enemyGroup.getChildren();
    
            for (const enemy of enemies) {
                const e = enemy as Phaser.Physics.Arcade.Sprite;
                if (!e.active || this.hitEnemiesSlash.has(e)) continue;
    
                const dx = e.x - slashX;
                const dy = e.y - slashY;
    
                const cos = Math.cos(-slashAngle);
                const sin = Math.sin(-slashAngle);
                const localX = dx * cos - dy * sin;
                const localY = dx * sin + dy * cos;
    
                if (Math.abs(localX) < this.slashWidth / 2 + 20 &&
                    Math.abs(localY) < this.slashHeight / 2 + 20) {
                    if ((e as any).hit) {
                        (e as any).hit(this.slashDamage);
                        this.hitEnemiesSlash.add(e);
                    }
                }
            }
        }

    protected ability1(): void {
        if (!this.canUseAbility1()) return;
        if (this.isSlashing) return;

        this.startSlash();
        this.startAbility1Cooldown();
    }

    protected ability2(): void {
        if (!this.canUseAbility2()) return;
        this.removeShield();
        this.spawnShield();
        this.updateShieldPositionAndRotation();

        this.shieldTimer = this.gameScene.time.delayedCall(2000, () => {
            this.removeShield();
        });

        this.startAbility2Cooldown();
    }

    spawnShield(): void {
        // TODO Use a proper shield graphic
        this.shield = this.gameScene.add.rectangle(0, 0, 100, 10, 0x4c4c4c);
        this.gameScene.physics.add.existing(this.shield);
        // Make it a dynamic body
        (this.shield.body as Phaser.Physics.Arcade.Body).setAllowGravity(false);
        // Make collision body bigger to catch fast bullets
        (this.shield.body as Phaser.Physics.Arcade.Body).setSize(120, 30);
        this.gameScene.addEnemyBulletDestroyer(this.shield);
    }

    removeShield(): void {
        if (this.shield) {
            this.gameScene.removeEnemyBulletDestroyer(this.shield);
            this.shield.destroy();
            this.shield = null;
        }
    }

    removeShieldTimer(): void {
        if (this.shieldTimer) {
            this.shieldTimer.remove();
        }
    }

    updateShieldPositionAndRotation(): void {
        if (this.shield) {
            const x = this.x + (30 * Math.cos(this.rotation - Math.PI / 2));
            const y = this.y + (30 * Math.sin(this.rotation - Math.PI / 2));
            this.shield.x = x;
            this.shield.y = y;
            this.shield.rotation = this.rotation;
        }
    }

    // Optional: Override to be tankier
    protected getMaxSpeed(): number {
        return this.velocityMax;
    }

    // TODO
    updateAI(): void {
        // For CPU-controlled characters
        // Not implemented in this phase
    }
}
