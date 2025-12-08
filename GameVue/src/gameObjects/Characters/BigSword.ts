import { PlayerController } from './PlayerController';
import { GameScene } from '../../scenes/GameScene';
import { Depth } from '../../constants';
import ASSETS from '../../assets';
import Graphics = Phaser.GameObjects.Graphics;
import TimerEvent = Phaser.Time.TimerEvent;
import { Slash } from '../Projectile/Slash';

export class BigSword extends PlayerController {
    // Ability 1 - Heavy Slash config
    slashDamage = 2;
    slashWidth = 80;        // Hitbox width (reduced to better match blade sprite)
    slashHeight = 230;      // Hitbox height (increased to match blade length)
    slashOffset = 40;       // Distance from character to slash position
    slashDuration = 400;    // Duration of the swing in milliseconds (higher = slower)
    slashArc = Math.PI * 0.8;

    // Trail config
    trailMaxWidth = 40;     // Maximum trail width at the end of slash
    trailOffset = 85;       // Distance from character for trail (further than sword)
    trailSegments = 35;     // Number of trail segments

    // Ability 2 - Piercing Strike config
    dashDamage = 3;
    dashDistance = 200;
    dashSpeed = 800;
    dashChargeTime = 500;
    dashHitboxWidth = 60;
    dashHitboxHeight = 30;

    // Runtime state
    private currentSlash: Slash | null = null;
    private slashSprite: Phaser.GameObjects.Image | null = null;
    private slashTrailGraphics: Graphics | null = null;
    private dashGraphics: Graphics | null = null;
    private arrowGraphics: Graphics | null = null;
    private isCharging = false;
    private isDashing = false;
    private isSlashing = false;
    private isInvulnerable = false;
    private chargeTimer: TimerEvent | null = null;
    private dashStartX = 0;
    private dashStartY = 0;
    private dashTargetX = 0;
    private dashTargetY = 0;
    private dashProgress = 0;
    private hitEnemies: Set<any> = new Set();

    constructor(scene: GameScene, x: number, y: number) {
        super(scene, x, y, 2);

        this.characterSpeed = 650;
        this.velocityMax = 380;
        this.maxHealth = 25;
        this.health = this.maxHealth;
        this.ability1Rate = 40;
        this.ability2Rate = 180;

        // Use playable characters sprite sheet - frame 2 is BigSword
        this.setAppearance(ASSETS.spritesheet.playableCharacters.key, 2);
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
            this.cleanupGraphics();
        });
    }

    public preUpdate(time: number, delta: number) {
        super.preUpdate(time, delta);

        if (this.isSlashing) {
            this.updateSlash(time);
            // Update slash entity position to follow player
            if (this.currentSlash) {
                this.currentSlash.updateOwnerPosition(this.x, this.y);
                this.currentSlash.update(this.gameScene.time.now);
            }
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

        // Calculate base angle to start from the character's right side
        const baseAngle = this.rotation - Math.PI / 2;

        // Create slash entity for hit detection
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

        // Create sword sprite for visual effect
        this.slashSprite = this.gameScene.add.image(0, 0, ASSETS.image.sword.key);
        this.slashSprite.setOrigin(0.5, 1); // Bottom-center origin (handle) for proper sword swing pivot
        this.slashSprite.setDepth(Depth.ABILITIES);
        this.slashSprite.setScale(1.5);

        // Create trail graphics
        this.slashTrailGraphics = this.gameScene.add.graphics();
        this.slashTrailGraphics.setDepth(Depth.ABILITIES);
    }

    updateSlash(time: number): void {
        if (!this.slashSprite || !this.slashTrailGraphics || !this.currentSlash) return;

        // Get progress from slash entity
        const elapsed = time - this.currentSlash.startTime;
        const progress = Math.min(elapsed / this.slashDuration, 1);

        // Start from right side and swing to left (outward arc)
        const baseAngle = this.currentSlash.baseAngle;
        const startAngle = baseAngle + this.slashArc / 2;
        const currentAngle = startAngle - this.slashArc * progress;

        const slashX = this.x + Math.cos(currentAngle) * this.slashOffset;
        const slashY = this.y + Math.sin(currentAngle) * this.slashOffset;

        // Position and rotate sword sprite
        // Sprite is bottom-to-top with origin at bottom (handle)
        // We need to add PI/2 to make it point outward correctly
        this.slashSprite.setPosition(slashX, slashY);
        this.slashSprite.setRotation(currentAngle + Math.PI / 2);

        // Draw widening trail
        this.slashTrailGraphics.clear();

        // Draw trail segments that widen as the slash progresses
        for (let i = 0; i < this.trailSegments; i++) {
            const segmentProgress = (i / this.trailSegments) * progress;
            const segmentAngle = startAngle - this.slashArc * segmentProgress;

            // Width increases as we progress through the slash
            const width = this.trailMaxWidth * segmentProgress;
            const alpha = 0.6 * segmentProgress;

            const segX = this.x + Math.cos(segmentAngle) * this.trailOffset;
            const segY = this.y + Math.sin(segmentAngle) * this.trailOffset;

            this.slashTrailGraphics.fillStyle(0x01FFFF, alpha);
            this.slashTrailGraphics.fillCircle(segX, segY, width / 2);
        }

        // Slash entity handles hit detection automatically in its update method

        if (progress >= 1) {
            this.endSlash();
        }
    }

    endSlash(): void {
        this.isSlashing = false;

        if (this.currentSlash) {
            this.currentSlash.destroy();
            this.currentSlash = null;
        }

        if (this.slashSprite) {
            this.slashSprite.destroy();
            this.slashSprite = null;
        }

        if (this.slashTrailGraphics) {
            this.slashTrailGraphics.destroy();
            this.slashTrailGraphics = null;
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

        // Check other players in multiplayer (PvP)
        const playerManager = (this.gameScene as any).playerManager;
        if (playerManager) {
            const players = playerManager.getAllPlayers();
            for (const player of players) {
                // Skip self to prevent self-damage
                if (player.playerId === this.playerId) continue;
                if (!player.active || this.hitEnemies.has(player)) continue;
                // Skip respawning players
                if (player.isRespawning) continue;

                const dx = Math.abs(player.x - this.x);
                const dy = Math.abs(player.y - this.y);

                if (dx < this.dashHitboxWidth / 2 + 20 && dy < this.dashHitboxHeight / 2 + 20) {
                    if (player.hit) {
                        player.hit(this.dashDamage, this.playerId, this.team);
                        this.hitEnemies.add(player);
                        console.log(`[PVP] ${this.playerId} dash hit ${player.playerId} for ${this.dashDamage} damage`);
                    }
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
        if (this.slashSprite) {
            this.slashSprite.destroy();
            this.slashSprite = null;
        }
        if (this.slashTrailGraphics) {
            this.slashTrailGraphics.destroy();
            this.slashTrailGraphics = null;
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

    /**
     * Character-specific AI logic for BigSword
     * The main AI behavior is handled by the AllyBehavior system
     */
    updateAI(_time: number, _delta: number): void {
        // BigSword AI is aggressive melee with dash attacks
        // The FollowAndAttackBehavior handles the general logic
    }
}
