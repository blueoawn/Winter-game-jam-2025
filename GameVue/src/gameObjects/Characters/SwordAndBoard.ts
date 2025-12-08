import { PlayerController } from './PlayerController';
import { GameScene } from '../../scenes/GameScene';
import { Depth } from '../../constants';
import ASSETS from '../../assets';
import Image = Phaser.GameObjects.Image;
import Graphics = Phaser.GameObjects.Graphics;
import TimerEvent = Phaser.Time.TimerEvent;
import { NinjaStar } from '../Projectile/NinjaStar';
import { Slash } from '../Projectile/Slash';
import { audioManager } from '../../../managers/AudioManager';

export class SwordAndBoard extends PlayerController {
    private slashes: Set<NinjaStar> = new Set();
    shield: Image | null;
    shieldTimer: TimerEvent | null;

    // Ability 1 - Heavy Slash config
    slashDamage = 2;
    slashWidth = 60;
    slashHeight = 15;
    slashOffset = 50;
    slashDuration = 250;
    slashArc = Math.PI * 0.8;

    // Runtime state
    private currentSlash: Slash | null = null;
    private isSlashing = false;

    constructor(scene: GameScene, x: number, y: number) {
        super(scene, x, y, 3);

        this.characterSpeed = 600;
        this.velocityMax = 350;
        this.maxHealth = 3;
        this.health = this.maxHealth;
        this.ability1Rate = 20;
        this.ability2Rate = 180;

        // Use playable characters sprite sheet - frame 3 is SwordAndBoard
        this.setAppearance(ASSETS.spritesheet.playableCharacters.key, 3);
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
            this.removeShield();
            this.removeShieldTimer();
            this.slashes.forEach(slash => slash.destroy());
            this.slashes.clear();
        })
    }

    public preUpdate(time: number, delta: number) {
        super.preUpdate(time, delta);
        this.updateShieldPositionAndRotation();

        // Update slash animation if currently slashing
        if (this.isSlashing && this.currentSlash) {
            this.currentSlash.updateOwnerPosition(this.x, this.y);
            this.currentSlash.update(this.gameScene.time.now);
        }
    }

    startSlash(): void {
        this.isSlashing = true;

        // Calculate base angle for slash (facing direction)
        const baseAngle = this.rotation - Math.PI / 2;

        // Create slash entity
        this.currentSlash = new Slash(
            this.gameScene,
            this.x,
            this.y,
            baseAngle,
            this.slashDamage,
            this.slashWidth,
            this.slashHeight,
            this.slashOffset,
            this.slashArc,
            this.slashDuration,
            this.playerId,
            this.team
        );

        // Add to player bullet group for network sync
        this.gameScene.playerBulletGroup.add(this.currentSlash as any);

        // Automatically end slash after duration
        this.gameScene.time.delayedCall(this.slashDuration, () => {
            this.endSlash();
        });
    }

    endSlash(): void {
        this.isSlashing = false;

        if (this.currentSlash) {
            this.currentSlash.destroy();
            this.currentSlash = null;
        }
    }

    protected ability1(): void {
        if (!this.canUseAbility1()) return;
        if (this.isSlashing) return;

        this.startSlash();
        audioManager.play('sword-slash');
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
        this.shield = this.gameScene.add.image(0, 0, ASSETS.image.shield.key);
        this.shield.setOrigin(0.5, 0.5);
        this.shield.setScale(1.5);
        this.shield.setDepth(Depth.ABILITIES);

        this.gameScene.physics.add.existing(this.shield);
        (this.shield.body as Phaser.Physics.Arcade.Body).setAllowGravity(false);
        (this.shield.body as Phaser.Physics.Arcade.Body).setSize(
            this.shield.width * 1.2,
            this.shield.height * 1.2
        );

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

    /**
     * Character-specific AI logic for SwordAndBoard
     * The main AI behavior is handled by the AllyBehavior system
     */
    updateAI(_time: number, _delta: number): void {
        // SwordAndBoard AI is melee-focused and defensive
        // The FollowAndAttackBehavior handles the general logic
    }
}
