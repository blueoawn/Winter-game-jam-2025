import { PlayerController } from '../../../managers/PlayerController';
import { GameScene } from '../../scenes/Game';
import { Depth } from '../../constants';
import Graphics = Phaser.GameObjects.Graphics;
import { ShotgunPellet } from '../Projectile/ShotgunPellet';

export class BoomStick extends PlayerController {
    private pellets: Set<ShotgunPellet> = new Set();
    // Ability 1 - Boomstick Blast config
    spreadAngle = Math.PI / 4;
    pelletCount = 7;
    maxRange = 250;

    // Damage falloff config
    baseDamage = 3;
    minDamageMultiplier = 0.2;
    falloffStart = 80;
    falloffEnd = 220;

    // Ability 2 - Burst Movement config
    burstSpeed = 1200;
    burstDuration = 150;

    // Runtime state
    private isBursting = false;
    private burstStartTime = 0;
    private burstDirX = 0;
    private burstDirY = 0;
    private muzzleFlash: Graphics | null = null;

    constructor(scene: GameScene, x: number, y: number) {
        super(scene, x, y, 4);

        this.characterSpeed = 720;
        this.velocityMax = 420;
        this.maxHealth = 2;
        this.health = this.maxHealth;
        this.ability1Rate = 80;
        this.ability2Rate = 90;

        this.on('destroy', () => {
            if (this.muzzleFlash) {
                this.muzzleFlash.destroy();
                this.muzzleFlash = null;
            }
            this.pellets.forEach(pellet => pellet.destroy());
            this.pellets.clear();
        });
    }

    public preUpdate(time: number, delta: number) {
        super.preUpdate(time, delta);

        if (this.isBursting) {
            this.updateBurst(time);
        }
    }

    protected ability1(): void {
        if (!this.canUseAbility1()) return;

        this.fireShotgunBlast();
        this.startAbility1Cooldown();
    }

    protected ability2(): void {
        if (!this.canUseAbility2()) return;
        if (this.isBursting) return;

        this.startBurst();
        this.startAbility2Cooldown();
    }

    fireShotgunBlast(): void {
        const dx = this.currentAim.x - this.x;
        const dy = this.currentAim.y - this.y;
        const baseAngle = Math.atan2(dy, dx);

        const startAngle = baseAngle - this.spreadAngle / 2;
        const angleStep = this.spreadAngle / (this.pelletCount - 1);

        for (let i = 0; i < this.pelletCount; i++) {
            const angle = startAngle + (i * angleStep);
            const targetX = this.x + Math.cos(angle) * this.maxRange;
            const targetY = this.y + Math.sin(angle) * this.maxRange;

            const pellet = new ShotgunPellet(
                this.gameScene,
                this.x,
                this.y,
                targetX,
                targetY,
                this.baseDamage,
                this.minDamageMultiplier,
                this.falloffStart,
                this.falloffEnd
            );

            this.pellets.add(pellet);

            // Remove from set when destroyed
            pellet.once('destroy', () => {
                this.pellets.delete(pellet);
            });

            // Add to player bullet group for collision detection
            this.gameScene.playerBulletGroup.add(pellet);
        }

        this.showMuzzleFlash(baseAngle);
        this.applyRecoil(baseAngle);
    }

    showMuzzleFlash(angle: number): void {
        this.muzzleFlash = this.gameScene.add.graphics();
        this.muzzleFlash.setDepth(Depth.ABILITIES);

        const flashX = this.x + Math.cos(angle) * 30;
        const flashY = this.y + Math.sin(angle) * 30;

        this.muzzleFlash.fillStyle(0xffaa00, 0.9);
        this.muzzleFlash.fillCircle(flashX, flashY, 20);
        this.muzzleFlash.fillStyle(0xffff00, 0.7);
        this.muzzleFlash.fillCircle(flashX, flashY, 12);

        this.gameScene.time.delayedCall(50, () => {
            if (this.muzzleFlash) {
                this.muzzleFlash.destroy();
                this.muzzleFlash = null;
            }
        });
    }

    applyRecoil(angle: number): void {
        const recoilForce = 300;
        const recoilX = -Math.cos(angle) * recoilForce;
        const recoilY = -Math.sin(angle) * recoilForce;
        this.setVelocity(
            (this.body?.velocity.x || 0) + recoilX,
            (this.body?.velocity.y || 0) + recoilY
        );
    }

    startBurst(): void {
        this.isBursting = true;
        this.burstStartTime = this.gameScene.time.now;

        if (this.body) {
            const dx = this.body?.velocity.x;
            const dy = this.body?.velocity.y;

            this.burstDirX = dx;
            this.burstDirY = dy;
            this.setMaxVelocity(this.burstSpeed);
        }
    }

    updateBurst(time: number): void {
        const elapsed = time - this.burstStartTime;

        if (elapsed >= this.burstDuration) {
            this.endBurst();
            return;
        }

        this.setVelocity(
            this.burstDirX * this.burstSpeed,
            this.burstDirY * this.burstSpeed
        );
    }

    endBurst(): void {
        this.isBursting = false;
        this.setMaxVelocity(this.velocityMax);
    }

    updateAI(): void {
    }
}
