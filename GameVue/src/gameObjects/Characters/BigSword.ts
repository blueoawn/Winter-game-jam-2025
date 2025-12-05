import { PlayerController } from '../../../managers/PlayerController';
import { GameScene } from '../../scenes/Game';
import { Depth } from '../../constants';
import Graphics = Phaser.GameObjects.Graphics;
import TimerEvent = Phaser.Time.TimerEvent;

export class BigSword extends PlayerController {
    // Ability 1 - Heavy Slash config
    slashDamage = 2;
    slashWidth = 60;
    slashHeight = 15;
    slashOffset = 50;
    slashDuration = 250;
    slashArc = Math.PI * 0.8;

    // Ability 2 - Piercing Strike config
    dashDamage = 3;
    dashDistance = 200;
    dashSpeed = 800;
    dashChargeTime = 500;
    dashHitboxWidth = 60;
    dashHitboxHeight = 30;

    // Runtime state
    private slashGraphics: Graphics | null = null;
    private dashGraphics: Graphics | null = null;
    private arrowGraphics: Graphics | null = null;
    private isCharging = false;
    private isDashing = false;
    private isSlashing = false;
    private isInvulnerable = false;
    private chargeTimer: TimerEvent | null = null;
    private slashStartTime = 0;
    private slashBaseAngle = 0;
    private hitEnemiesSlash: Set<any> = new Set();
    private dashStartX = 0;
    private dashStartY = 0;
    private dashTargetX = 0;
    private dashTargetY = 0;
    private dashProgress = 0;
    private hitEnemies: Set<any> = new Set();

    constructor(scene: GameScene, x: number, y: number) {
        super(scene, x, y, 3);

        this.characterSpeed = 650;
        this.velocityMax = 380;
        this.maxHealth = 5;
        this.health = this.maxHealth;
        this.ability1Rate = 40;
        this.ability2Rate = 180;

        this.on('destroy', () => {
            this.cleanupGraphics();
        });
    }

    public preUpdate(time: number, delta: number) {
        super.preUpdate(time, delta);

        if (this.isSlashing) {
            this.updateSlash(time);
        }

        if (this.isCharging) {
            this.updateChargeArrow();
            this.setVelocity(0, 0);
        }

        if (this.isDashing) {
            this.updateDash(delta);
        }
    }

    protected ability1(): void {
        if (!this.canUseAbility1()) return;
        if (this.isDashing || this.isCharging || this.isSlashing) return;

        this.startSlash();
        this.startAbility1Cooldown();
    }

    protected ability2(): void {
        if (!this.canUseAbility2()) return;
        if (this.isDashing || this.isCharging || this.isSlashing) return;

        this.startCharge();
        this.startAbility2Cooldown();
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

    startCharge(): void {
        this.isCharging = true;
        this.isInvulnerable = true;

        this.arrowGraphics = this.gameScene.add.graphics();
        this.arrowGraphics.setDepth(Depth.ABILITIES);

        this.gameScene.tweens.add({
            targets: this,
            x: this.x + Phaser.Math.Between(-3, 3),
            y: this.y + Phaser.Math.Between(-3, 3),
            duration: 50,
            yoyo: true,
            repeat: Math.floor(this.dashChargeTime / 100),
        });

        this.chargeTimer = this.gameScene.time.delayedCall(this.dashChargeTime, () => {
            this.executeDash();
        });
    }

    updateChargeArrow(): void {
        if (!this.arrowGraphics) return;

        this.arrowGraphics.clear();

        const angle = this.rotation - Math.PI / 2;
        const arrowLength = this.dashDistance;
        const startX = this.x + Math.cos(angle) * 40;
        const startY = this.y + Math.sin(angle) * 40;
        const endX = this.x + Math.cos(angle) * arrowLength;
        const endY = this.y + Math.sin(angle) * arrowLength;

        this.arrowGraphics.lineStyle(4, 0xff4444, 0.6);
        this.arrowGraphics.beginPath();
        this.arrowGraphics.moveTo(startX, startY);
        this.arrowGraphics.lineTo(endX, endY);
        this.arrowGraphics.strokePath();

        const headLength = 20;
        const headAngle = Math.PI / 6;
        this.arrowGraphics.fillStyle(0xff4444, 0.8);
        this.arrowGraphics.fillTriangle(
            endX,
            endY,
            endX - Math.cos(angle - headAngle) * headLength,
            endY - Math.sin(angle - headAngle) * headLength,
            endX - Math.cos(angle + headAngle) * headLength,
            endY - Math.sin(angle + headAngle) * headLength
        );
    }

    executeDash(): void {
        this.isCharging = false;

        if (this.arrowGraphics) {
            this.arrowGraphics.destroy();
            this.arrowGraphics = null;
        }

        const angle = this.rotation - Math.PI / 2;
        this.dashStartX = this.x;
        this.dashStartY = this.y;
        this.dashTargetX = this.x + Math.cos(angle) * this.dashDistance;
        this.dashTargetY = this.y + Math.sin(angle) * this.dashDistance;
        this.dashProgress = 0;
        this.hitEnemies.clear();

        this.isDashing = true;

        this.dashGraphics = this.gameScene.add.graphics();
        this.dashGraphics.setDepth(Depth.ABILITIES);
    }

    updateDash(delta: number): void {
        const dashDuration = (this.dashDistance / this.dashSpeed) * 1000;
        this.dashProgress += delta / dashDuration;

        if (this.dashProgress >= 1) {
            this.dashProgress = 1;
            this.endDash();
        }

        const newX = Phaser.Math.Linear(this.dashStartX, this.dashTargetX, this.dashProgress);
        const newY = Phaser.Math.Linear(this.dashStartY, this.dashTargetY, this.dashProgress);
        this.setPosition(newX, newY);

        this.drawDashTrail();
        this.checkDashHits();
    }

    drawDashTrail(): void {
        if (!this.dashGraphics) return;

        this.dashGraphics.clear();

        const angle = this.rotation - Math.PI / 2;

        for (let i = 0; i < 5; i++) {
            const alpha = 0.6 - i * 0.1;
            const offset = i * 10;
            const trailX = this.x - Math.cos(angle) * offset;
            const trailY = this.y - Math.sin(angle) * offset;

            this.dashGraphics.fillStyle(0x88ccff, alpha);
            this.dashGraphics.fillCircle(trailX, trailY, 15 - i * 2);
        }

        this.dashGraphics.lineStyle(3, 0xffffff, 0.8);
        this.dashGraphics.strokeRect(
            this.x - this.dashHitboxWidth / 2,
            this.y - this.dashHitboxHeight / 2,
            this.dashHitboxWidth,
            this.dashHitboxHeight
        );
    }

    checkDashHits(): void {
        // Check walls
        const walls = this.gameScene.wallGroup.getChildren();
        for (const wall of walls) {
            const w = wall as any;
            if (!w.active || this.hitEnemies.has(w)) continue;

            const dx = Math.abs(w.x - this.x);
            const dy = Math.abs(w.y - this.y);

            if (dx < this.dashHitboxWidth / 2 + 20 && dy < this.dashHitboxHeight / 2 + 20) {
                if (w.hit && !w.isIndestructible) {
                    w.hit(this.dashDamage);
                    this.hitEnemies.add(w);
                }
            }
        }

        // Check enemies
        const enemies = this.gameScene.enemyGroup.getChildren();

        for (const enemy of enemies) {
            const e = enemy as Phaser.Physics.Arcade.Sprite;
            if (!e.active || this.hitEnemies.has(e)) continue;

            const dx = Math.abs(e.x - this.x);
            const dy = Math.abs(e.y - this.y);

            if (dx < this.dashHitboxWidth / 2 + 20 && dy < this.dashHitboxHeight / 2 + 20) {
                if ((e as any).hit) {
                    (e as any).hit(this.dashDamage);
                    this.hitEnemies.add(e);
                }
            }
        }
    }

    endDash(): void {
        this.isDashing = false;
        this.isInvulnerable = false;
        this.hitEnemies.clear();

        if (this.dashGraphics) {
            this.dashGraphics.destroy();
            this.dashGraphics = null;
        }
    }

    hit(damage: number): void {
        if (this.isInvulnerable) return;
        super.hit(damage);
    }

    cleanupGraphics(): void {
        if (this.slashGraphics) {
            this.slashGraphics.destroy();
            this.slashGraphics = null;
        }
        if (this.dashGraphics) {
            this.dashGraphics.destroy();
            this.dashGraphics = null;
        }
        if (this.arrowGraphics) {
            this.arrowGraphics.destroy();
            this.arrowGraphics = null;
        }
        if (this.chargeTimer) {
            this.chargeTimer.destroy();
            this.chargeTimer = null;
        }
    }

    updateAI(): void {
    }
}
