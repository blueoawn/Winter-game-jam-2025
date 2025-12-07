import { PlayerController } from './PlayerController';
import { GameScene } from '../../scenes/GameScene';
import { Depth } from '../../constants';
// Audio handled by AudioManager
import { NinjaStar } from '../Projectile/NinjaStar';
import Graphics = Phaser.GameObjects.Graphics;

export class Railgun extends PlayerController {
    // Railgun specific properties
    private beamGraphics: Graphics | null = null;
    // private beamFadeTimer: Phaser.Time.TimerEvent | null = null; // TODO: Implement fade effect if needed
    
    // Beam Stats
    private readonly maxBeamRange = 600;
    private readonly maxBeamWidth = 50;
    private readonly minBeamWidth = 3;
    private readonly maxBeamDamage = 8;
    
    // Recharge Stats
    private readonly baseRechargeRate = 3; // Per second
    private readonly staticRechargeMultiplier = 10; // 10x speed when standing still

    constructor(scene: GameScene, x: number, y: number) {
        super(scene, x, y, 3); // Frame 3 for Railgun (Assumed)

        // Stats: Slower movement, heavy hitter
        this.characterSpeed = 400;
        this.velocityMax = 350;
        this.maxHealth = 25;
        this.health = this.maxHealth;
        
        // Ability 1: Ninja Stars (Medium cooldown, moderate damage)
        this.ability1Rate = 120; 
        
        // Ability 2: Railgun (Cooldown handles the 'refire' delay, but damage depends on meter)
        this.ability2Rate = 120; 

        // Enable skill bar for Railgun Charge
        this.skillBarEnabled = true;
        this.maxSkillMeter = 100;
        this.skillMeter = 0; // Starts empty or full? Let's start empty to encourage charging
        this.createSkillBar();

        this.on('destroy', () => {
           if (this.beamGraphics) {
               this.beamGraphics.destroy();
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
        const endX = this.x + Math.cos(angle) * this.maxBeamRange;
        const endY = this.y + Math.sin(angle) * this.maxBeamRange;

        // 2. Visuals
        if (!this.beamGraphics) {
            this.beamGraphics = this.gameScene.add.graphics();
            this.beamGraphics.setDepth(Depth.ABILITIES);
        }
        
        this.beamGraphics.clear();
        this.beamGraphics.lineStyle(width, 0x00FFFF, 1); // Cyan beam
        this.beamGraphics.lineBetween(this.x, this.y, endX, endY);
        
        // Add a core to the beam for visual pop
        this.beamGraphics.lineStyle(width / 3, 0xFFFFFF, 1);
        this.beamGraphics.lineBetween(this.x, this.y, endX, endY);

        // Fade out effect
        this.gameScene.tweens.add({
            targets: this.beamGraphics,
            alpha: 0,
            duration: 300,
            onComplete: () => {
                if (this.beamGraphics) {
                    this.beamGraphics.clear();
                    this.beamGraphics.alpha = 1;
                }
            }
        });

        // 3. Collision Logic (Piercing)
        // Check all enemies to see if they are touching the beam line
        const enemies = this.gameScene.enemyGroup.getChildren();
        // const walls = this.gameScene.wallGroup.getChildren(); // TODO: Add wall collision if needed
        // For this implementation, it pierces EVERYTHING (like a true Railgun).

        for (const enemy of enemies) {
            const e = enemy as Phaser.Physics.Arcade.Sprite;
            if (!e.active) continue;

            if (this.isInBeamPath(e.x, e.y, width, endX, endY)) {
                if ((e as any).hit) {
                    (e as any).hit(damage);
                }
            }
        }
    }

    // Helper to check collision with beam line
    private isInBeamPath(targetX: number, targetY: number, beamWidth: number, endX: number, endY: number): boolean {
        // Vector from start to end
        const dx = endX - this.x;
        const dy = endY - this.y;
        const beamLenSq = dx * dx + dy * dy;

        if (beamLenSq === 0) return false;

        // Vector from start to target
        const tx = targetX - this.x;
        const ty = targetY - this.y;

        // Project target vector onto beam vector (dot product)
        // t is the normalized distance along the line (0 to 1)
        const t = Math.max(0, Math.min(1, (tx * dx + ty * dy) / beamLenSq));

        // Closest point on line to target
        const closestX = this.x + t * dx;
        const closestY = this.y + t * dy;

        // Distance from closest point to target center
        const distSq = (targetX - closestX) ** 2 + (targetY - closestY) ** 2;

        // Check if distance is within beam width + enemy radius approx (16px)
        const hitRadius = (beamWidth / 2) + 16; 
        return distSq < (hitRadius * hitRadius);
    }

    updateAI(): void {
        // Not implemented
    }
}