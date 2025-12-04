import { PlayerController } from '../../../managers/PlayerController';
import { GameScene } from '../../scenes/Game';
import { Depth } from '../../constants';
import Graphics = Phaser.GameObjects.Graphics;
import TimerEvent = Phaser.Time.TimerEvent;

// Cheese touch is a character that locks onto an enemy and does damage over time to them with their primary ability
// Cheese touch has a secondary meter to show how much resource they have to heal themselves with their secondary ability
// Which they obtain by dealing damage with their primary ability

// Ability 1 - Cheese Beam
// Description: Fires a continuous beam of cheese at the targeted enemy, dealing damage over time

// Ability 2 - Eat the cheese
// Description: Consumes the secondary meter to heal self, restoring a portion of health based on the amount of meter consumed

export class CheeseTouch extends PlayerController {
    // Beam properties
    beamGraphics: Graphics | null = null;
    isBeaming: boolean = false;
    beamDamageTimer: TimerEvent | null = null;
    beamRange: number = 300;

    // Lock-on properties
    lockOnRadius: number = 100;  // Configurable radius around cursor to find targets
    lockedTarget: Phaser.Physics.Arcade.Sprite | null = null;
    lockOnIndicator: Graphics | null = null;

    constructor(scene: GameScene, x: number, y: number) {
        super(scene, x, y, 2);  // Frame 2 for CheeseTouch

        // Balanced stats
        this.characterSpeed = 700;
        this.velocityMax = 400;
        this.maxHealth = 10;
        this.health = this.maxHealth;
        this.ability1Rate = 5;    // Can use beam frequently
        this.ability2Rate = 60;   // Heal every 1 second

        // Enable skill bar for cheese meter
        this.skillBarEnabled = true;
        this.maxSkillMeter = 100;
        this.skillMeter = 0;
        this.createSkillBar();  // Create it now that it's enabled

        // Cleanup on destroy
        this.on('destroy', () => {
            this.stopBeam();
            if (this.lockOnIndicator) {
                this.lockOnIndicator.destroy();
                this.lockOnIndicator = null;
            }
        });
    }

    public preUpdate(time: number, delta: number) {
        super.preUpdate(time, delta);

        // Update beam visual if active
        if (this.isBeaming && this.beamGraphics) {
            this.updateLockOnTarget();
            this.drawBeam();
            this.drawLockOnIndicator();
        }
    }

    protected ability1(): void {
        if (!this.canUseAbility1()) return;

        // Toggle beam on/off
        if (this.isBeaming) {
            this.stopBeam();
        } else {
            this.startBeam();
        }

        this.startAbility1Cooldown();
    }

    protected ability2(): void {
        if (!this.canUseAbility2()) return;
        if (this.skillMeter <= 0) return;  // Need cheese to heal
        if (this.health >= this.maxHealth) return;  // Already full health

        // Consume cheese meter to heal
        const healAmount = Math.min(1, this.skillMeter / 50);  // Heal 1 HP per 50 cheese
        const cheeseUsed = Math.min(this.skillMeter, 50);

        this.skillMeter -= cheeseUsed;
        this.updateSkillBarValue();
        this.health = Math.min(this.maxHealth, this.health + healAmount);
        this.updateHealthBarValue();

        this.startAbility2Cooldown();
    }

    startBeam(): void {
        this.isBeaming = true;

        // Create beam graphics
        this.beamGraphics = this.gameScene.add.graphics();
        this.beamGraphics.setDepth(Depth.ABILITIES);

        // Create lock-on indicator graphics
        this.lockOnIndicator = this.gameScene.add.graphics();
        this.lockOnIndicator.setDepth(Depth.ABILITIES);

        // Start damage timer - deal damage every 200ms
        this.beamDamageTimer = this.gameScene.time.addEvent({
            delay: 200,
            callback: this.dealBeamDamage,
            callbackScope: this,
            loop: true
        });
    }

    stopBeam(): void {
        this.isBeaming = false;
        this.lockedTarget = null;

        if (this.beamGraphics) {
            this.beamGraphics.destroy();
            this.beamGraphics = null;
        }

        if (this.beamDamageTimer) {
            this.beamDamageTimer.destroy();
            this.beamDamageTimer = null;
        }

        if (this.lockOnIndicator) {
            this.lockOnIndicator.destroy();
            this.lockOnIndicator = null;
        }
    }

    drawBeam(): void {
        if (!this.beamGraphics) return;

        this.beamGraphics.clear();

        // Use locked target position if available, otherwise use cursor aim
        const targetX = this.lockedTarget?.active ? this.lockedTarget.x : this.currentAim.x;
        const targetY = this.lockedTarget?.active ? this.lockedTarget.y : this.currentAim.y;

        // Draw beam from player to target (clamped to range)
        const dx = targetX - this.x;
        const dy = targetY - this.y;
        const dist = Math.sqrt(dx * dx + dy * dy);

        // Clamp to beam range
        const ratio = Math.min(1, this.beamRange / dist);
        const endX = this.x + dx * ratio;
        const endY = this.y + dy * ratio;

        // Yellow/orange cheese beam
        this.beamGraphics.lineStyle(6, 0xffcc00, 0.8);
        this.beamGraphics.beginPath();
        this.beamGraphics.moveTo(this.x, this.y);
        this.beamGraphics.lineTo(endX, endY);
        this.beamGraphics.strokePath();
    }

    updateLockOnTarget(): void {
        // Find closest enemy within lockOnRadius of cursor
        const enemies = this.gameScene.enemyGroup.getChildren();
        let closestEnemy: Phaser.Physics.Arcade.Sprite | null = null;
        let closestDist = this.lockOnRadius;

        for (const enemy of enemies) {
            const e = enemy as Phaser.Physics.Arcade.Sprite;
            if (!e.active) continue;

            // Distance from cursor to enemy
            const dx = e.x - this.currentAim.x;
            const dy = e.y - this.currentAim.y;
            const dist = Math.sqrt(dx * dx + dy * dy);

            // Also check if enemy is within beam range from player
            const playerDist = Math.sqrt((e.x - this.x) ** 2 + (e.y - this.y) ** 2);

            if (dist < closestDist && playerDist <= this.beamRange) {
                closestDist = dist;
                closestEnemy = e;
            }
        }

        this.lockedTarget = closestEnemy;
    }

    drawLockOnIndicator(): void {
        if (!this.lockOnIndicator) return;

        this.lockOnIndicator.clear();

        if (!this.lockedTarget || !this.lockedTarget.active) return;

        // Get enemy size for indicator radius
        const enemyWidth = this.lockedTarget.displayWidth || this.lockedTarget.width || 32;
        const enemyHeight = this.lockedTarget.displayHeight || this.lockedTarget.height || 32;
        const radius = Math.max(enemyWidth, enemyHeight) / 2 + 5;  // Add padding

        // Draw red circle around locked target
        this.lockOnIndicator.lineStyle(3, 0xff0000, 1);
        this.lockOnIndicator.strokeCircle(this.lockedTarget.x, this.lockedTarget.y, radius);
    }

    dealBeamDamage(): void {
        if (!this.isBeaming) return;

        // If we have a locked target, damage it directly
        if (this.lockedTarget && this.lockedTarget.active) {
            if ((this.lockedTarget as any).hit) {
                (this.lockedTarget as any).hit(1);
                this.skillMeter = Math.min(this.maxSkillMeter, this.skillMeter + 10);
                this.updateSkillBarValue();
            }
            return;
        }

        // Fallback: Check for enemies in beam path
        const enemies = this.gameScene.enemyGroup.getChildren();

        for (const enemy of enemies) {
            const e = enemy as Phaser.Physics.Arcade.Sprite;
            if (!e.active) continue;

            // Simple distance check to beam line
            if (this.isInBeamPath(e.x, e.y)) {
                // Deal damage to enemy
                if ((e as any).hit) {
                    (e as any).hit(1);
                    // Gain cheese meter when dealing damage
                    this.skillMeter = Math.min(this.maxSkillMeter, this.skillMeter + 10);
                    this.updateSkillBarValue();
                }
            }
        }
    }

    isInBeamPath(targetX: number, targetY: number): boolean {
        // Calculate distance from point to beam line
        const dx = this.currentAim.x - this.x;
        const dy = this.currentAim.y - this.y;
        const beamLength = Math.min(Math.sqrt(dx * dx + dy * dy), this.beamRange);

        // Vector from player to target
        const tx = targetX - this.x;
        const ty = targetY - this.y;

        // Project target onto beam line
        const dot = (tx * dx + ty * dy) / (dx * dx + dy * dy);

        // Check if projection is within beam length
        if (dot < 0 || dot * Math.sqrt(dx * dx + dy * dy) > beamLength) {
            return false;
        }

        // Calculate perpendicular distance
        const projX = this.x + dot * dx;
        const projY = this.y + dot * dy;
        const perpDist = Math.sqrt((targetX - projX) ** 2 + (targetY - projY) ** 2);

        // Beam has width of 30 pixels
        return perpDist < 30;
    }

    // TODO
    updateAI(): void {
        // For CPU-controlled characters
        // Not implemented in this phase
    }
}
