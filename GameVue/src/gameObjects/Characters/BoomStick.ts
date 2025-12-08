import { PlayerController } from './PlayerController';
import { GameScene } from '../../scenes/GameScene';
import { Depth } from '../../constants';
import ASSETS from '../../assets';
import Graphics = Phaser.GameObjects.Graphics;
import { ShotgunPellet } from '../Projectile/ShotgunPellet';
import { audioManager } from '../../../managers/AudioManager';

export class BoomStick extends PlayerController {
    private pellets: Set<ShotgunPellet> = new Set();
    // Ability 1 - Boomstick Blast config
    spreadAngle = Math.PI / 4;
    pelletCount = 7;
    maxRange = 250;

    // Barrel offset config (adjust these to position the shot origin)
    barrelOffsetForward = 50;  // Distance in front of character
    barrelOffsetRight = 16;     // Offset to the right (negative = left)
    barrelOffsetUp = 5;        // Vertical offset (negative = down)

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
        super(scene, x, y, 1);

        this.characterSpeed = 720;
        this.velocityMax = 420;
        this.maxHealth = 20;
        this.health = this.maxHealth;
        this.ability1Rate = 80;
        this.ability2Rate = 90;

        // Use playable characters sprite sheet - frame 1 is BoomStick
        this.setAppearance(ASSETS.spritesheet.playableCharacters.key, 1);
        this.setOrigin(0.5, 0.5);
        this.setScale(1.5, 1.5);

        const frameWidth = 60;
        const frameHeight = 77;

        const bodyWidth = frameWidth * 0.7;
        const bodyHeight = frameHeight * 0.7;

        this.setBodySize(bodyWidth, bodyHeight);

        const offsetX = (frameWidth - bodyWidth) / 2;
        const offsetY = (frameHeight - bodyHeight) / 2 + frameHeight * 0.1;
        this.setOffset(offsetX, offsetY);

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

        audioManager.play('shotgun-fire');

        // Calculate barrel position with configurable offsets
        const cos = Math.cos(baseAngle);
        const sin = Math.sin(baseAngle);

        // Forward offset (in the direction of aim)
        const forwardX = cos * this.barrelOffsetForward;
        const forwardY = sin * this.barrelOffsetForward;

        // Right offset (perpendicular to aim direction)
        const rightX = -sin * this.barrelOffsetRight;
        const rightY = cos * this.barrelOffsetRight;

        // Combine all offsets to get barrel position
        const barrelX = this.x + forwardX + rightX;
        const barrelY = this.y + forwardY + rightY + this.barrelOffsetUp;

        const startAngle = baseAngle - this.spreadAngle / 2;
        const angleStep = this.spreadAngle / (this.pelletCount - 1);

        for (let i = 0; i < this.pelletCount; i++) {
            const angle = startAngle + (i * angleStep);
            const targetX = barrelX + Math.cos(angle) * this.maxRange;
            const targetY = barrelY + Math.sin(angle) * this.maxRange;

            const pellet = new ShotgunPellet(
                this.gameScene,
                barrelX,
                barrelY,
                targetX,
                targetY,
                this.baseDamage,
                this.minDamageMultiplier,
                this.falloffStart,
                this.falloffEnd,
                this.playerId,
                this.team
            );

            this.pellets.add(pellet);

            pellet.once('destroy', () => {
                this.pellets.delete(pellet);
            });

            this.gameScene.playerBulletGroup.add(pellet);
        }

        this.showMuzzleFlash(baseAngle, barrelX, barrelY);
        this.applyRecoil(baseAngle);
    }

    showMuzzleFlash(angle: number, barrelX: number, barrelY: number): void {
        this.muzzleFlash = this.gameScene.add.graphics();
        this.muzzleFlash.setDepth(Depth.ABILITIES);

        // Muzzle flash appears slightly in front of barrel
        const flashX = barrelX + Math.cos(angle) * 15;
        const flashY = barrelY + Math.sin(angle) * 15;

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

            // Temporarily override max velocity for burst
            // Store current modifiers and apply burst speed directly
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
        // Restore max velocity considering all active modifiers (area, speed boosts)
        this.updateMaxVelocity();
    }

    /**
     * Character-specific AI logic for BoomStick
     * The main AI behavior is handled by the AllyBehavior system
     */
    updateAI(_time: number, _delta: number): void {
        // BoomStick AI is close-range shotgun focused
        // The FollowAndAttackBehavior handles the general logic
    }
}
