import { PlayerController } from './PlayerController';
import { GameScene } from '../../scenes/GameScene';
import { Depth } from '../../constants';
import { audioManager } from '../../../managers/AudioManager';
import ASSETS from '../../assets';
import Graphics = Phaser.GameObjects.Graphics;
import TimerEvent = Phaser.Time.TimerEvent;
import { Beam } from '../Projectile/Beam';

// Cheese touch is a character that locks onto an enemy and does damage over time to them with their primary ability
// Cheese touch has a secondary meter to show how much resource they have to heal themselves with their secondary ability
// Which they obtain by dealing damage with their primary ability

// Ability 1 - Cheese Beam
// Description: Fires a continuous beam of cheese at the targeted enemy, dealing damage over time

// Ability 2 - Eat the cheese
// Description: Consumes the secondary meter to heal self, restoring a portion of health based on the amount of meter consumed

export class CheeseTouch extends PlayerController {
    // Animation keys
    static readonly ANIM_IDLE = 'cheese_idle';
    static readonly ANIM_BEAM = 'cheese_beam';

    // Beam properties
    beam: Beam | null = null;
    isBeaming = false;
    beamDamageTimer: TimerEvent | null = null;
    beamRange = 300;
    beamDamage = 1;

    // Lock-on properties
    lockOnRadius = 100;
    lockedTarget: Phaser.Physics.Arcade.Sprite | null = null;
    lockOnIndicator: Graphics | null = null;

    constructor(scene: GameScene, x: number, y: number) {
        super(scene, x, y, 2);

        this.characterSpeed = 700;
        this.velocityMax = 400;
        this.maxHealth = 15;
        this.health = this.maxHealth;
        this.ability1Rate = 5;
        this.ability2Rate = 60*2;

        // Use sprite sheet
        this.setAppearance(ASSETS.spritesheet.cheeseTouchAttack.key, 0);
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

        // Create animations
        this.createAnimations();

        // Enable skill bar for cheese meter
        this.skillBarEnabled = true;
        this.maxSkillMeter = 100;
        this.skillMeter = 0;
        this.createSkillBar();

        this.ability1Rate = 60;
        this.ability1Cooldown = 0;

        // Cleanup on destroy
        this.on('destroy', () => {
            this.stopBeam();
            if (this.lockOnIndicator) {
                this.lockOnIndicator.destroy();
                this.lockOnIndicator = null;
            }
        });
    }

    private createAnimations(): void {
        const anims = this.scene.anims;

        // Idle animation: just frame 0
        if (!anims.exists(CheeseTouch.ANIM_IDLE)) {
            anims.create({
                key: CheeseTouch.ANIM_IDLE,
                frames: [{ key: ASSETS.spritesheet.cheeseTouchAttack.key, frame: 0 }],
                frameRate: 1,
                repeat: -1
            });
        }

        // Beam animation: frame 1 (hands up) held continuously
        if (!anims.exists(CheeseTouch.ANIM_BEAM)) {
            anims.create({
                key: CheeseTouch.ANIM_BEAM,
                frames: [{ key: ASSETS.spritesheet.cheeseTouchAttack.key, frame: 1 }],
                frameRate: 1,
                repeat: -1
            });
        }

        // Start with idle animation
        this.play(CheeseTouch.ANIM_IDLE);
    }

    public preUpdate(time: number, delta: number) {
        super.preUpdate(time, delta);

        // Update beam visual if active
        if (this.isBeaming && this.beam) {
            this.updateLockOnTarget();
            this.updateBeamPosition();
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

        // Play cheese eating sound
        audioManager.playCheeseEat();

        //stop the beam to start eating (make it more dangerous to heal)

        this.stopBeam();

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

        // Play beam animation (hands up)
        this.play(CheeseTouch.ANIM_BEAM);

        // Play drain sound
        audioManager.play('cheese-touch-drain');

        // Calculate initial beam angle
        const angle = Math.atan2(this.currentAim.y - this.y, this.currentAim.x - this.x);

        // Create beam entity
        this.beam = new Beam(
            this.gameScene,
            this.x,
            this.y,
            angle,
            this.beamRange,
            this.beamDamage,
            6, // width
            0xffcc00, // yellow/orange cheese color
            this.playerId,
            this.team
        );

        // Add to player bullet group for collision detection
        this.gameScene.playerBulletGroup.add(this.beam as any);

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

        // Return to idle animation
        this.play(CheeseTouch.ANIM_IDLE);

        if (this.beam) {
            this.beam.destroy();
            this.beam = null;
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

    updateBeamPosition(): void {
        if (!this.beam) return;

        // Use locked target position if available, otherwise use cursor aim
        const targetX = this.lockedTarget?.active ? this.lockedTarget.x : this.currentAim.x;
        const targetY = this.lockedTarget?.active ? this.lockedTarget.y : this.currentAim.y;

        // Calculate angle to target
        const angle = Math.atan2(targetY - this.y, targetX - this.x);

        // Update beam position and angle
        this.beam.updateBeam(this.x, this.y, angle);
    }

    updateLockOnTarget(): void {
        // Find closest target (enemy or destructible wall) within lockOnRadius of cursor
        let closestTarget: Phaser.Physics.Arcade.Sprite | null = null;
        let closestDist = this.lockOnRadius;

        // Check enemies
        const enemies = this.gameScene.enemyGroup.getChildren();
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
                closestTarget = e;
            }
        }

        // Check for players (in multiplayer mode)
        const playerManager = (this.gameScene as any).playerManager;
        if (playerManager) {
            const players = playerManager.getAllPlayers();
            for (const player of players) {
                if (player.playerId === this.playerId) continue; // Skip self
                if (!player.active) continue;
                // Distance from cursor to player
                const dx = player.x - this.currentAim.x;
                const dy = player.y - this.currentAim.y;
                const dist = Math.sqrt(dx * dx + dy * dy);

                // Also check if player is within beam range from player
                const playerDist = Math.sqrt((player.x - this.x) ** 2 + (player.y - this.y) ** 2);

                if (dist < closestDist && playerDist <= this.beamRange) {
                    closestDist = dist;
                    closestTarget = player;
                }
            }
        }

        this.lockedTarget = closestTarget;
    

        // Check destructible walls
        const walls = this.gameScene.wallGroup.getChildren();
        for (const wall of walls) {
            const w = wall as any;
            if (!w.active || w.isIndestructible) continue;

            // Distance from cursor to wall
            const dx = w.x - this.currentAim.x;
            const dy = w.y - this.currentAim.y;
            const dist = Math.sqrt(dx * dx + dy * dy);

            // Also check if wall is within beam range from player
            const playerDist = Math.sqrt((w.x - this.x) ** 2 + (w.y - this.y) ** 2);

            if (dist < closestDist && playerDist <= this.beamRange) {
                closestDist = dist;
                closestTarget = w;
            }
        }

        this.lockedTarget = closestTarget;
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
        if (!this.isBeaming || !this.beam) return;

        // Store hit count before dealing damage
        const initialHitCount = this.beam.hitEntities.size;

        // If we have a locked target, damage it directly
        if (this.lockedTarget && this.lockedTarget.active) {
            if ((this.lockedTarget as any).hit && !this.beam.hitEntities.has(this.lockedTarget)) {
                const target = this.lockedTarget as any;
                // Check if it's a player to pass PvP info
                if (target.playerId && target.team) {
                    target.hit(this.beamDamage, this.playerId, this.team);
                } else {
                    target.hit(this.beamDamage);
                }
                this.beam.hitEntities.add(this.lockedTarget);
                this.skillMeter = Math.min(this.maxSkillMeter, this.skillMeter + 10);
                this.updateSkillBarValue();
            }
            return;
        }

        // Use beam's damage method for all other targets
        this.beam.dealDamage();

        // Check if we hit anything and update cheese meter accordingly
        const newHitCount = this.beam.hitEntities.size;
        if (newHitCount > initialHitCount) {
            // Gained cheese meter for hitting something
            this.skillMeter = Math.min(this.maxSkillMeter, this.skillMeter + 10);
            this.updateSkillBarValue();
        }

        // Clear hit entities each damage tick to allow continuous damage
        this.beam.hitEntities.clear();
    }

    /**
     * Character-specific AI logic for CheeseTouch
     * The main AI behavior is handled by the AllyBehavior system
     */
    updateAI(_time: number, _delta: number): void {
        // CheeseTouch AI focuses on beam attacks and self-healing
        // The FollowAndAttackBehavior handles the general logic
    }
}
