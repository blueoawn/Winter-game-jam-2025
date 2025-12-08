import { Behavior } from './Behavior';
import type { EnemyController } from '../gameObjects/NPC/EnemyController';
import ASSETS from '../assets';
import { audioManager } from '../../managers/AudioManager';

/**
 * Boss behavior for Lizard Wizard boss fight
 *
 * Advanced attack patterns:
 * - Phase 1 (100%-50% HP): Normal attacks with circular bullet patterns
 * - Phase 2 (50%-0% HP): Faster attacks, teleportation, spiral patterns
 */
export class BossBehavior extends Behavior {
    moveSpeed: number = 150;
    attackRange: number = 600;
    teleportRange: number = 300;

    // Phase tracking
    private currentPhase: number = 1;
    private healthThresholdPhase2: number = 0.5;

    // Ability cooldowns
    private ability1Rate: number = 800;   // Single shot
    private ability2Rate: number = 2500;  // Spread shot
    private circularShotRate: number = 4000; // Circular pattern
    private teleportRate: number = 6000;  // Teleport ability

    private lastAbility1Time: number = 0;
    private lastAbility2Time: number = 0;
    private lastCircularShotTime: number = 0;
    private lastTeleportTime: number = 0;

    private targetPlayer: Phaser.Physics.Arcade.Sprite | null = null;
    private circlePhaseAngle: number = 0;
    private isTeleporting: boolean = false;

    constructor(options?: {
        moveSpeed?: number;
        attackRange?: number;
        ability1Rate?: number;
        ability2Rate?: number;
    }) {
        super();

        if (options) {
            this.moveSpeed = options.moveSpeed ?? this.moveSpeed;
            this.attackRange = options.attackRange ?? this.attackRange;
            this.ability1Rate = options.ability1Rate ?? this.ability1Rate;
            this.ability2Rate = options.ability2Rate ?? this.ability2Rate;
        }
    }

    update(npc: EnemyController, time: number, _delta: number): void {
        if (!this.targetPlayer) {
            this.targetPlayer = this.findNearestPlayer(npc);
        }

        if (!this.targetPlayer) {
            this.stopMovement(npc);
            return;
        }

        this.updatePhase(npc);

        const distance = this.getDistanceToTarget(npc, this.targetPlayer);

        // Always face the player
        const angle = Phaser.Math.Angle.Between(npc.x, npc.y, this.targetPlayer.x, this.targetPlayer.y);
        npc.rotation = angle + Math.PI / 2;

        // Phase 2: Teleport if too close
        if (this.currentPhase === 2 && distance < this.teleportRange) {
            this.tryTeleport(npc, time);
        } else {
            this.handleMovement(npc, distance);
        }

        this.tryAttack(npc, time, distance);
    }

    private updatePhase(npc: EnemyController): void {
        const healthPercent = npc.health / npc.maxHealth;

        if (this.currentPhase === 1 && healthPercent <= this.healthThresholdPhase2) {
            console.log('[BOSS] Entering Phase 2!');
            this.currentPhase = 2;

            // Phase 2: Increase attack speed significantly
            this.ability1Rate = 400;
            this.ability2Rate = 1500;
            this.circularShotRate = 2500;
            this.moveSpeed = 220;

            // Change music to intense battle theme
            audioManager.stopMusic();
            audioManager.playMusic(ASSETS.audio.battleTheme2.key, { loop: true, volume: 0.5 });

            // Visual feedback - intense purple/pink tint
            npc.setTint(0xff00ff);
            npc.setScale(npc.scaleX * 1.1, npc.scaleY * 1.1); // Slightly larger

            // Screen shake effect
            npc.gameScene.cameras.main.shake(500, 0.01);

            // Show phase transition message
            const phaseText = npc.gameScene.add.text(
                npc.gameScene.scale.width / 2,
                npc.gameScene.scale.height / 2 - 50,
                'PHASE 2!',
                {
                    fontFamily: 'Arial Black',
                    fontSize: '72px',
                    color: '#ff00ff',
                    stroke: '#000000',
                    strokeThickness: 10,
                    align: 'center'
                }
            ).setOrigin(0.5).setScrollFactor(0).setDepth(2000);

            // Pulsing effect
            npc.gameScene.tweens.add({
                targets: phaseText,
                scaleX: 1.3,
                scaleY: 1.3,
                alpha: 0,
                duration: 1500,
                ease: 'Power2',
                onComplete: () => phaseText.destroy()
            });

            // Add glowing aura effect around boss
            const glowCircle = npc.gameScene.add.circle(npc.x, npc.y, 100, 0xff00ff, 0.3);
            glowCircle.setDepth(npc.depth - 1);

            npc.gameScene.tweens.add({
                targets: glowCircle,
                scaleX: 2,
                scaleY: 2,
                alpha: 0,
                duration: 1000,
                ease: 'Power2',
                onComplete: () => glowCircle.destroy()
            });
        }
    }

    private handleMovement(npc: EnemyController, distance: number): void {
        if (this.isTeleporting) return;

        // Circle strafe pattern in phase 2
        if (this.currentPhase === 2 && distance < this.attackRange) {
            this.circleStrafeAroundPlayer(npc);
        }
        // Keep distance in phase 1
        else if (distance > this.attackRange * 0.8) {
            this.moveTowards(npc, this.targetPlayer!.x, this.targetPlayer!.y, this.moveSpeed);
        }
        else if (distance < this.attackRange * 0.5) {
            this.moveAwayFrom(npc, this.targetPlayer!.x, this.targetPlayer!.y, this.moveSpeed);
        }
        else {
            this.stopMovement(npc);
        }
    }

    private circleStrafeAroundPlayer(npc: EnemyController): void {
        if (!this.targetPlayer) return;

        // Orbit around player
        this.circlePhaseAngle += 0.03;
        const orbitRadius = this.attackRange * 0.6;

        const targetX = this.targetPlayer.x + Math.cos(this.circlePhaseAngle) * orbitRadius;
        const targetY = this.targetPlayer.y + Math.sin(this.circlePhaseAngle) * orbitRadius;

        this.moveTowards(npc, targetX, targetY, this.moveSpeed);
    }

    private tryTeleport(npc: EnemyController, time: number): void {
        if (time - this.lastTeleportTime < this.teleportRate) return;
        if (!this.targetPlayer) return;

        // Teleport to a random position around player (but outside danger zone)
        const angle = Math.random() * Math.PI * 2;
        const distance = this.attackRange * 0.7;

        const newX = this.targetPlayer.x + Math.cos(angle) * distance;
        const newY = this.targetPlayer.y + Math.sin(angle) * distance;

        // Clamp to world bounds
        const scene = npc.gameScene;
        const clampedX = Phaser.Math.Clamp(newX, 50, scene.currentMap.width - 50);
        const clampedY = Phaser.Math.Clamp(newY, 50, scene.currentMap.height - 50);

        // Teleport effect
        this.isTeleporting = true;
        npc.setAlpha(0.3);

        scene.time.delayedCall(200, () => {
            npc.setPosition(clampedX, clampedY);
            scene.addExplosion(clampedX, clampedY);

            scene.time.delayedCall(200, () => {
                npc.setAlpha(1);
                this.isTeleporting = false;
            });
        });

        this.lastTeleportTime = time;
    }

    private tryAttack(npc: EnemyController, time: number, distance: number): void {
        if (!this.targetPlayer || this.isTeleporting) return;
        if (distance > this.attackRange) return;

        // Phase 2: Try circular pattern first
        if (this.currentPhase === 2 && time - this.lastCircularShotTime >= this.circularShotRate) {
            this.fireCircularPattern(npc, 12);
            this.lastCircularShotTime = time;
        }
        // Spread shot
        else if (time - this.lastAbility2Time >= this.ability2Rate) {
            const shots = this.currentPhase === 2 ? 7 : 5;
            this.fireSpreadShot(npc, this.targetPlayer, npc.power, shots);
            this.lastAbility2Time = time;
        }
        // Single shot
        else if (time - this.lastAbility1Time >= this.ability1Rate) {
            this.fireSingleShot(npc, this.targetPlayer, npc.power);
            this.lastAbility1Time = time;
        }
    }

    private fireCircularPattern(npc: EnemyController, bulletCount: number): void {
        const angleStep = (Math.PI * 2) / bulletCount;

        for (let i = 0; i < bulletCount; i++) {
            const angle = angleStep * i;
            const distance = 200;

            const targetX = npc.x + Math.cos(angle) * distance;
            const targetY = npc.y + Math.sin(angle) * distance;

            npc.gameScene.fireEnemyMagicMissile(npc.x, npc.y, npc.power, targetX, targetY);
        }
    }

    // Override to use magic missiles
    protected fireSingleShot(
        npc: EnemyController,
        target: Phaser.Physics.Arcade.Sprite,
        power: number = 1
    ): void {
        npc.gameScene.fireEnemyMagicMissile(npc.x, npc.y, power, target.x, target.y);
    }

    // Override to use magic missiles
    protected fireSpreadShot(
        npc: EnemyController,
        target: Phaser.Physics.Arcade.Sprite,
        power: number = 1,
        spread: number = 6,
        projectileCount: number = 3
    ): void {
        const yDiff = target.y - npc.y;
        const xDiff = target.x - npc.x;
        const distance = Math.sqrt(xDiff * xDiff + yDiff * yDiff);
        const baseAngle = Math.atan2(yDiff, xDiff);

        const totalSpreadAngle = Math.PI / spread;
        const anglePerProjectile = totalSpreadAngle / (projectileCount - 1);
        const startAngle = baseAngle - totalSpreadAngle / 2;

        for (let i = 0; i < projectileCount; i++) {
            const currentAngle = startAngle + i * anglePerProjectile;
            const targetX = npc.x + distance * Math.cos(currentAngle);
            const targetY = npc.y + distance * Math.sin(currentAngle);

            npc.gameScene.fireEnemyMagicMissile(npc.x, npc.y, power, targetX, targetY);
        }
    }

    protected moveAwayFrom(npc: EnemyController, targetX: number, targetY: number, speed: number): void {
        const angle = Phaser.Math.Angle.Between(targetX, targetY, npc.x, npc.y);
        const velocityX = Math.cos(angle) * speed;
        const velocityY = Math.sin(angle) * speed;
        npc.setVelocity(velocityX, velocityY);
    }

    cleanup(npc: EnemyController): void {
        this.targetPlayer = null;
        this.currentPhase = 1;
        this.isTeleporting = false;
        npc.clearTint();
    }
}

