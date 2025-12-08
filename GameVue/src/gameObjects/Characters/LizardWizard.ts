import { PlayerController } from './PlayerController';
import { GameScene } from '../../scenes/GameScene.ts';
import { MagicMissile } from '../Projectile/MagicMissile';
import ASSETS from "../../assets.ts";

export class LizardWizard extends PlayerController {
    private missiles: Set<MagicMissile> = new Set();
    private ability2SpawnDistance: number = 40;

    // Animation keys
    static readonly ANIM_ABILITY1 = 'lizard_ability1';
    static readonly ANIM_ABILITY2 = 'lizard_ability2';

    constructor(scene: GameScene, x: number, y: number) {
        super(scene, x, y, 0);

        this.characterSpeed = 800;
        this.velocityMax = 450;
        this.maxHealth = 20;
        this.health = this.maxHealth;
        this.ability1Rate = 60;
        this.ability2Rate = 60*2;

        this.setAppearance(ASSETS.spritesheet.lizardWizardAttack.key, 0);
        this.setOrigin(0.5, 0.5);
        this.setScale(1.5, 1.5);

        const frameWidth = 30;
        const frameHeight = 106;

        const bodyWidth = frameWidth * 0.6;
        const bodyHeight = frameHeight * 0.4;

        this.setBodySize(bodyWidth, bodyHeight);

        const offsetX = (frameWidth - bodyWidth) / 2;
        const offsetY = (frameHeight - bodyHeight) / 2 + frameHeight * 0.15;
        this.setOffset(offsetX, offsetY);

        this.createAnimations();

        // Listen for animation frame updates to fire projectiles
        this.on('animationupdate', (_anim: any, frame: Phaser.Animations.AnimationFrame) => {
            // Only fire on ability1 animation frames 1 and 2 (when hands are up)
            if (_anim.key === LizardWizard.ANIM_ABILITY1 && (frame.index === 3 || frame.index === 4)) {
                // console.log(frame);
                this.fireProjectileFromHand(frame.index);
            }
        });

        this.on('destroy', () => {
            this.missiles.forEach(missile => missile.destroy());
            this.missiles.clear();
        });
    }

    private createAnimations(): void {
        const anims = this.scene.anims;

        // Ability 1 animation: frames 0-3 (first row) with custom delays
        if (!anims.exists(LizardWizard.ANIM_ABILITY1)) {
            const frames = anims.generateFrameNumbers(ASSETS.spritesheet.lizardWizardAttack.key, { start: 0, end: 3 });

            // Add custom duration to each frame (in milliseconds)
            frames[0].duration = 0;  // Frame 0: normal
            frames[1].duration = 0;  // Frame 1: longer delay before next frame
            frames[2].duration = 200;  // Frame 2: normal
            frames[3].duration = 100;  // Frame 3: normal

            anims.create({
                key: LizardWizard.ANIM_ABILITY1,
                frames: frames,
                repeat: 0
            });
        }

        // Ability 2 animation: frames 4-6 (second row)
        if (!anims.exists(LizardWizard.ANIM_ABILITY2)) {
            anims.create({
                key: LizardWizard.ANIM_ABILITY2,
                frames: anims.generateFrameNumbers(ASSETS.spritesheet.lizardWizardAttack.key, { start: 4, end: 6 }),
                frameRate: 10,
                repeat: 0
            });
        }
    }

    protected ability1(): void {
        if (!this.canUseAbility1()) {
            return;
        }

        // Play ability 1 animation - projectiles will fire automatically on frames 1 and 2
        this.play(LizardWizard.ANIM_ABILITY1);
        this.startAbility1Cooldown();
    }

    private fireProjectileFromHand(frameIndex: number): void {
        let handOffsetX = 0;
        let handOffsetY = -15;

        if (frameIndex === 3) {
            // Right hand (frame 1)
            handOffsetX = 20;
        } else if (frameIndex === 4) {
            // Left hand (frame 2)
            handOffsetX = -20;
        }

        // Calculate direction from character to aim point
        const dirX = this.currentAim.x - this.x;
        const dirY = this.currentAim.y - this.y;
        const dirLength = Math.sqrt(dirX * dirX + dirY * dirY);
        const normalizedDirX = dirX / dirLength;
        const normalizedDirY = dirY / dirLength;

        // Add forward offset (spawn projectile in front of character)
        const forwardDistance = 35;
        const forwardOffsetX = normalizedDirX * forwardDistance;
        const forwardOffsetY = normalizedDirY * forwardDistance;

        // Rotate hand offset based on character rotation
        const cos = Math.cos(this.rotation);
        const sin = Math.sin(this.rotation);
        const rotatedHandOffsetX = handOffsetX * cos - handOffsetY * sin;
        const rotatedHandOffsetY = handOffsetX * sin + handOffsetY * cos;

        // Combine hand offset and forward offset
        const spawnX = this.x + rotatedHandOffsetX + forwardOffsetX;
        const spawnY = this.y + rotatedHandOffsetY + forwardOffsetY;

        const missile = new MagicMissile(
            this.gameScene,
            spawnX,
            spawnY,
            this.currentAim.x,
            this.currentAim.y,
            1,
            this.playerId,
            this.team
        );

        this.missiles.add(missile);

        missile.once('destroy', () => {
            this.missiles.delete(missile);
        });

        this.gameScene.playerBulletGroup.add(missile);
    }


    protected ability2(spread = 6, amountOfProjectiles = 3): void {
        if (!this.canUseAbility2()) return;

        // Play ability 2 animation
        this.play(LizardWizard.ANIM_ABILITY2);

        // Calculate direction from character to aim point
        const dirX = this.currentAim.x - this.x;
        const dirY = this.currentAim.y - this.y;
        const dirLength = Math.sqrt(dirX * dirX + dirY * dirY);
        const normalizedDirX = dirX / dirLength;
        const normalizedDirY = dirY / dirLength;

        // Spawn projectiles in front of character, in the direction they're aiming
        const spawnX = this.x + normalizedDirX * this.ability2SpawnDistance;
        const spawnY = this.y + normalizedDirY * this.ability2SpawnDistance;

        const yDifference = this.currentAim.y - spawnY;
        const xDifference = this.currentAim.x - spawnX;
        const distance = Math.sqrt(Math.pow(xDifference, 2) + Math.pow(yDifference, 2));
        const rotation = Math.atan2(yDifference, xDifference);

        const totalSpreadAngle = Math.PI / spread;
        const anglePerProjectile = totalSpreadAngle / (amountOfProjectiles - 1);
        const startAngle = rotation - (totalSpreadAngle / 2);

        for(let i = 0; i < amountOfProjectiles; i++) {
            const currentAngle = startAngle + (i * anglePerProjectile);
            const xLeftTo = spawnX + (distance * Math.cos(currentAngle));
            const yLeftTo = spawnY + (distance * Math.sin(currentAngle));

            const missile = new MagicMissile(
                this.gameScene,
                spawnX,
                spawnY,
                xLeftTo,
                yLeftTo,
                1,
                this.playerId,
                this.team
            );

            this.missiles.add(missile);

            missile.once('destroy', () => {
                this.missiles.delete(missile);
            });

            this.gameScene.playerBulletGroup.add(missile);
        }

        this.startAbility2Cooldown();
    }
    
    /**
     * Character-specific AI logic for LizardWizard
     * The main AI behavior is handled by the AllyBehavior system
     * This method can be used for character-specific adjustments
     */
    updateAI(_time: number, _delta: number): void {
        // LizardWizard AI is ranged-focused
        // The FollowAndAttackBehavior handles the general logic
        // Character-specific tweaks can be added here if needed
    }
}
