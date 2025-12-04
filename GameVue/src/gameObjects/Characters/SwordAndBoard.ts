import { PlayerController } from '../../../managers/PlayerController';
import { GameScene } from '../../scenes/Game';
import Rectangle = Phaser.GameObjects.Rectangle;
import TimerEvent = Phaser.Time.TimerEvent;

export class SwordAndBoard extends PlayerController {
    shield: Rectangle | null;
    shieldTimer: TimerEvent | null;
    constructor(scene: GameScene, x: number, y: number) {
        super(scene, x, y, 1);  // Frame 1 for SwordAndBoard

        // Override stats - slow but tanky
        this.characterSpeed = 600;
        this.velocityMax = 350;
        this.maxHealth = 3;  // More health
        this.health = this.maxHealth;
        this.ability1Rate = 20;   // Slower attack
        this.ability2Rate = 180;  // Shield every 3 seconds

        this.on('destroy', () => {
            this.removeShield();
            this.removeShieldTimer();
        })
    }

    public preUpdate(time: number, delta: number) {
        super.preUpdate(time, delta);
        this.updateShieldPositionAndRotation();
    }

    protected ability1(): void {
        if (!this.canUseAbility1()) return;
        this.gameScene.fireBullet(
            {x: this.x, y: this.y},
            {x: this.currentAim.x, y: this.currentAim.y}
        );
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
        // TODO Use a proper shield graphic
        this.shield = this.gameScene.add.rectangle(0, 0, 100, 10, 0x4c4c4c);
        this.gameScene.physics.add.existing(this.shield);
        // Make it a dynamic body
        (this.shield.body as Phaser.Physics.Arcade.Body).setAllowGravity(false);
        // Make collision body bigger to catch fast bullets
        (this.shield.body as Phaser.Physics.Arcade.Body).setSize(120, 30);
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

    // TODO
    updateAI(): void {
        // For CPU-controlled characters
        // Not implemented in this phase
    }
}
