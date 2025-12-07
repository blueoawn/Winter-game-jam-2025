import { PlayerController } from './PlayerController';
import { GameScene } from '../../scenes/GameScene';
import { Depth } from '../../constants';
import ASSETS from '../../assets';
import { NinjaStar } from '../Projectile/NinjaStar';

export class Railgun extends PlayerController {
    // Railgun specific properties
    private beamSprite: Phaser.GameObjects.Image | null = null;

    // Beam Stats
    private readonly maxBeamRange = 600;
    private readonly maxBeamWidth = 50;
    private readonly minBeamWidth = 3;
    private readonly maxBeamDamage = 8;

    // Barrel offset config (adjust these to position the beam origin)
    barrelOffsetForward = 40;  // Distance in front of character
    barrelOffsetRight = 10;      // Offset to the right (negative = left)
    barrelOffsetUp = -10;       // Vertical offset (negative = down)

    // Recharge Stats
    private readonly baseRechargeRate = 3; // Per second
    private readonly staticRechargeMultiplier = 10; // 10x speed when standing still

    constructor(scene: GameScene, x: number, y: number) {
        super(scene, x, y, 0);

        this.characterSpeed = 400;
        this.velocityMax = 350;
        this.maxHealth = 25;
        this.health = this.maxHealth;
        this.ability1Rate = 120;
        this.ability2Rate = 120;

        // Use playable characters sprite sheet - frame 0 is Railgun
        this.setAppearance(ASSETS.spritesheet.playableCharacters.key, 0);
        this.setOrigin(0.5, 0.5);
        this.setScale(1.5, 1.5);

        const frameWidth = 60;
        const frameHeight = 77;

        const bodyWidth = frameWidth * 0.5;
        const bodyHeight = frameHeight * 0.5;

        this.setBodySize(bodyWidth, bodyHeight);

        const offsetX = (frameWidth - bodyWidth) / 2;
        const offsetY = (frameHeight - bodyHeight) / 2 + frameHeight * 0.1;
        this.setOffset(offsetX, offsetY);

        // Enable skill bar for Railgun Charge
        this.skillBarEnabled = true;
        this.maxSkillMeter = 100;
        this.skillMeter = 0;
        this.createSkillBar();

        this.on('destroy', () => {
           if (this.beamSprite) {
               this.beamSprite.destroy();
           }
        });
    }

    public preUpdate(time: number, delta: number): void {
        super.preUpdate(time, delta);
        this.handlePassiveRecharge(delta);
    }

    /**
     * Handles the passive charging of the Railgun.
     * Restores charge faster if the player is not moving.
     */
    private handlePassiveRecharge(delta: number): void {
        if (this.skillMeter >= this.maxSkillMeter) return;

        let rechargeAmount = (this.baseRechargeRate * delta) / 1000;

        // "Standing still restores charge significantly faster"
        if (this.body && this.body.velocity.length() < 10) {
            rechargeAmount *= this.staticRechargeMultiplier;
        }

        this.skillMeter = Math.min(this.maxSkillMeter, this.skillMeter + rechargeAmount);
        this.updateSkillBarValue();
    }

    // Ability 1: Ninja Star Spread Attack
    protected ability1(): void {
        if (!this.canUseAbility1()) return;

        // Configuration for the spread shot
        const spreadAngle = 4; // Higher = tighter spread (PI / spread)
        const amountOfProjectiles = 3;
        const baseDamage = 3;

        const yDifference = this.currentAim.y - this.y;
        const xDifference = this.currentAim.x - this.x;
        const distance = Math.sqrt(Math.pow(xDifference, 2) + Math.pow(yDifference, 2));
        const rotation = Math.atan2(yDifference, xDifference);

        const totalSpreadAngle = Math.PI / spreadAngle;
        const anglePerProjectile = totalSpreadAngle / (amountOfProjectiles - 1);
        const startAngle = rotation - (totalSpreadAngle / 2);

        // Fire spread of ninja stars
        for(let i = 0; i < amountOfProjectiles; i++) {
            const currentAngle = startAngle + (i * anglePerProjectile);
            
            // Calculate target point for this specific star
            const xTarget = this.x + (distance * Math.cos(currentAngle));
            const yTarget = this.y + (distance * Math.sin(currentAngle));

            const star = new NinjaStar(
                this.gameScene,
                this.x,
                this.y,
                xTarget,
                yTarget,
                baseDamage
            );

            this.gameScene.playerBulletGroup.add(star);
        }

        // Optional: Play Sound
        // audioManager.playSound('throw');

        this.startAbility1Cooldown();
    }

    // Ability 2: Piercing Railgun Beam
    // Damage and Width scale with skillMeter
    protected ability2(): void {
        if (!this.canUseAbility2()) return;
        
        // Minimum charge required to fire
        if (this.skillMeter < 10) return;

        // Calculate power ratio (0.0 to 1.0)
        const chargeRatio = this.skillMeter / this.maxSkillMeter;

        // Calculate Stats based on charge
        const damage = Math.max(1, Math.floor(this.maxBeamDamage * chargeRatio));
        const width = this.minBeamWidth + ((this.maxBeamWidth - this.minBeamWidth) * chargeRatio);
        
        // Fire Beam
        this.fireBeam(damage, width);

        // Reset Meter
        this.skillMeter = 0;
        this.updateSkillBarValue();
        this.startAbility2Cooldown();
    }

    private fireBeam(damage: number, width: number): void {
        // 1. Calculate Beam Geometry
        const angle = Phaser.Math.Angle.Between(this.x, this.y, this.currentAim.x, this.currentAim.y);

        // Calculate barrel position with configurable offsets
        const cos = Math.cos(angle);
        const sin = Math.sin(angle);

        // Forward offset (in the direction of aim)
        const forwardX = cos * this.barrelOffsetForward;
        const forwardY = sin * this.barrelOffsetForward;

        // Right offset (perpendicular to aim direction)
        const rightX = -sin * this.barrelOffsetRight;
        const rightY = cos * this.barrelOffsetRight;

        // Combine all offsets to get barrel position
        const barrelX = this.x + forwardX + rightX;
        const barrelY = this.y + forwardY + rightY + this.barrelOffsetUp;

        const endX = barrelX + Math.cos(angle) * this.maxBeamRange;
        const endY = barrelY + Math.sin(angle) * this.maxBeamRange;

        // 2. Create Beam Sprite
        if (this.beamSprite) {
            this.beamSprite.destroy();
        }

        this.beamSprite = this.gameScene.add.image(barrelX, barrelY, ASSETS.image.railgunBeam.key);
        this.beamSprite.setOrigin(0.5, 0);
        this.beamSprite.setRotation(angle - Math.PI / 2);
        this.beamSprite.setDepth(Depth.ABILITIES);

        // Scale the beam
        const beamWidthScale = width / this.beamSprite.width;
        const targetLengthScale = this.maxBeamRange / this.beamSprite.height;

        // Start with minimal length (just the arrow tip visible)
        this.beamSprite.setScale(beamWidthScale, 0.05);

        // Animate beam expanding from barrel to full length
        const expandDuration = 150;
        this.gameScene.tweens.add({
            targets: this.beamSprite,
            scaleY: targetLengthScale,
            duration: expandDuration,
            ease: 'Cubic.easeOut',
            onComplete: () => {
                // After expanding, fade out the beam
                this.gameScene.tweens.add({
                    targets: this.beamSprite,
                    alpha: 0,
                    duration: 200,
                    ease: 'Power2',
                    onComplete: () => {
                        if (this.beamSprite) {
                            this.beamSprite.destroy();
                            this.beamSprite = null;
                        }
                    }
                });
            }
        });

        // 3. Collision Logic (Piercing) - apply damage when beam reaches full extension
        this.gameScene.time.delayedCall(expandDuration, () => {
            const enemies = this.gameScene.enemyGroup.getChildren();

            for (const enemy of enemies) {
                const e = enemy as Phaser.Physics.Arcade.Sprite;
                if (!e.active) continue;

                if (this.isInBeamPath(e.x, e.y, width, endX, endY, barrelX, barrelY)) {
                    if ((e as any).hit) {
                        (e as any).hit(damage);
                    }
                }
            }
        });
    }

    // Helper to check collision with beam line
    private isInBeamPath(targetX: number, targetY: number, beamWidth: number, endX: number, endY: number, startX: number, startY: number): boolean {
        // Vector from start to end
        const dx = endX - startX;
        const dy = endY - startY;
        const beamLenSq = dx * dx + dy * dy;

        if (beamLenSq === 0) return false;

        // Vector from start to target
        const tx = targetX - startX;
        const ty = targetY - startY;

        // Project target vector onto beam vector (dot product)
        // t is the normalized distance along the line (0 to 1)
        const t = Math.max(0, Math.min(1, (tx * dx + ty * dy) / beamLenSq));

        // Closest point on line to target
        const closestX = startX + t * dx;
        const closestY = startY + t * dy;

        // Distance from closest point to target center
        const distSq = (targetX - closestX) ** 2 + (targetY - closestY) ** 2;

        // Check if distance is within beam width + enemy radius approx (16px)
        const hitRadius = (beamWidth / 2) + 16; 
        return distSq < (hitRadius * hitRadius);
    }

    /**
     * Character-specific AI logic for Railgun
     * The main AI behavior is handled by the AllyBehavior system
     */
    updateAI(_time: number, _delta: number): void {
        // Railgun AI focuses on charged shots from range
        // The FollowAndAttackBehavior handles the general logic
    }
}
