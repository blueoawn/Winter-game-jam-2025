import { EnemyController } from '../../managers/EnemyController';
import { GameScene } from '../scenes/Game';

/**
 * LizardWizard enemy - uses LizardWizard sprite and abilities
 * - Ability 1: Single projectile (fast fire rate)
 * - Ability 2: Spread shot (3 projectiles)
 * - AI: Chases player and fires when in range
 */
export default class EnemyLizardWizard extends EnemyController {
    // Movement properties
    moveSpeed: number = 200;
    targetPlayer: Phaser.Physics.Arcade.Sprite | null = null;

    // Ability cooldowns (in milliseconds)
    ability1Rate: number = 1000;  // Fire every 1 second
    ability2Rate: number = 3000;  // Spread shot every 3 seconds
    lastAbility1Time: number = 0;
    lastAbility2Time: number = 0;

    // Combat properties
    attackRange: number = 400;  // Start firing when player is within this range

    constructor(scene: GameScene, x: number, y: number) {
        const lizardWizardFrame = 0;  // Frame 0 is LizardWizard
        super(scene, x, y, lizardWizardFrame);

        // Set enemy stats
        this.health = 5;
        this.maxHealth = 5;
        this.power = 1;

        // Enable physics body
        this.setCollideWorldBounds(true);
    }

    protected updateAI(time: number, _delta: number): void {
        // Find target player if we don't have one
        if (!this.targetPlayer) {
            this.targetPlayer = this.findNearestPlayer();
        }

        // No target found, don't do anything
        if (!this.targetPlayer) return;

        // Calculate distance to player
        const distance = Phaser.Math.Distance.Between(
            this.x, this.y,
            this.targetPlayer.x, this.targetPlayer.y
        );

        // Move towards player if too far
        if (distance > this.attackRange * 0.7) {
            this.moveTowardsTarget();
        } else {
            // Stop moving when in attack range
            this.setVelocity(0, 0);
        }

        // Attack if in range
        if (distance <= this.attackRange) {
            this.tryAttack(time);
        }
    }

    private findNearestPlayer(): Phaser.Physics.Arcade.Sprite | null {
        // In single player mode
        if (this.gameScene.player) {
            return this.gameScene.player as any;
        }

        // In multiplayer mode - find local player
        if (this.gameScene.playerManager) {
            const localPlayer = this.gameScene.playerManager.getLocalPlayer();
            if (localPlayer) {
                return localPlayer as any;
            }
        }

        return null;
    }

    private moveTowardsTarget(): void {
        if (!this.targetPlayer) return;

        // Calculate angle to target
        const angle = Phaser.Math.Angle.Between(
            this.x, this.y,
            this.targetPlayer.x, this.targetPlayer.y
        );

        // Set velocity towards target
        this.setVelocity(
            Math.cos(angle) * this.moveSpeed,
            Math.sin(angle) * this.moveSpeed
        );
    }

    private tryAttack(time: number): void {
        if (!this.targetPlayer) return;

        // Try ability 2 (spread shot) first if available
        if (time - this.lastAbility2Time >= this.ability2Rate) {
            this.useAbility2(time);
        }
        // Otherwise use ability 1 (single shot) if available
        else if (time - this.lastAbility1Time >= this.ability1Rate) {
            this.useAbility1(time);
        }
    }

    private useAbility1(time: number): void {
        if (!this.targetPlayer) return;

        // Fire single projectile at player
        this.gameScene.fireEnemyBullet(
            this.x,
            this.y,
            this.power,
            this.targetPlayer.x,
            this.targetPlayer.y
        );

        this.lastAbility1Time = time;
    }

    private useAbility2(time: number, spread: number = 6, projectileCount: number = 3): void {
        if (!this.targetPlayer) return;

        // Calculate angle to target
        const yDiff = this.targetPlayer.y - this.y;
        const xDiff = this.targetPlayer.x - this.x;
        const distance = Math.sqrt(xDiff * xDiff + yDiff * yDiff);
        const baseAngle = Math.atan2(yDiff, xDiff);

        // Calculate spread
        const totalSpreadAngle = Math.PI / spread;
        const anglePerProjectile = totalSpreadAngle / (projectileCount - 1);
        const startAngle = baseAngle - (totalSpreadAngle / 2);

        // Fire spread of projectiles
        for (let i = 0; i < projectileCount; i++) {
            const currentAngle = startAngle + (i * anglePerProjectile);
            const targetX = this.x + (distance * Math.cos(currentAngle));
            const targetY = this.y + (distance * Math.sin(currentAngle));

            this.gameScene.fireEnemyBullet(
                this.x,
                this.y,
                this.power,
                targetX,
                targetY
            );
        }

        this.lastAbility2Time = time;
    }

    // Override die to add visual feedback
    die(): void {
        // Create explosion effect
        this.gameScene.addExplosion(this.x, this.y);

        // Optional: Add score or rewards here
        // this.gameScene.addScore(10);

        // Remove from scene
        this.gameScene.removeEnemy(this);
    }
}
