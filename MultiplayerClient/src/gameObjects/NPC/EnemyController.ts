import ASSETS from '../../assets.js';
import type { GameScene } from '../../scenes/GameScene.ts';
import { Depth } from '../../constants.ts';
import Container = Phaser.GameObjects.Container;
import { SyncableEntity } from '../../../network/SyncableEntity.ts';

//TODO - Add stuff in here for network sync/rollback

export abstract class EnemyController extends Phaser.Physics.Arcade.Sprite implements SyncableEntity{
    health: number = 1;
    maxHealth: number = 1;
    power: number = 1;  // Damage dealt to player
    knockback: number = 200;  // Knockback force when colliding with players
    enemyId: string;
    enemyType: string = 'EnemyFlying';  // Default type, should be overridden by subclasses
    gameScene: GameScene;
    healthBarContainer: Container | null = null;
    protected showHealthBar: boolean = true;  // Can be disabled per enemy type

    // Knockback state - prevents AI from overriding velocity during knockback
    protected isInKnockback: boolean = false;
    protected knockbackTimer: Phaser.Time.TimerEvent | null = null;
    protected knockbackDuration: number = 300;  // Duration in ms that AI is disabled after knockback

    // Collision cooldown - prevents rapid damage from continuous contact
    lastCollisionTime: number = 0;
    collisionCooldown: number = 500;  // Minimum ms between taking contact damage

    private static nextId = 0;

    constructor(scene: GameScene, x: number, y: number, frame: number, textureKey?: string) {
        super(scene, x, y, textureKey || ASSETS.spritesheet.ships.key, frame);

        scene.add.existing(this);
        scene.physics.add.existing(this);

        this.gameScene = scene;
        this.enemyId = `enemy_${Date.now()}_${EnemyController.nextId++}`;

        this.setDepth(Depth.ENEMIES);

        this.createHealthBar();
        this.handleDestruction();
    }

    preUpdate(time: number, delta: number) {
        super.preUpdate(time, delta);

        this.updateHealthBarPosition();

        // Only update AI behavior if not in knockback state
        if (!this.isInKnockback) {
            this.updateAI(time, delta);
        }
    }

    hit(damage: number): void {
        this.health -= damage;
        this.updateHealthBarValue();
        if (this.health <= 0) {
            this.die();
        }
    }

    /**
     * Apply knockback velocity and enter knockback state (disables AI temporarily)
     * @param velocityX X component of knockback velocity
     * @param velocityY Y component of knockback velocity
     */
    applyKnockback(velocityX: number, velocityY: number): void {
        if (!this.body) return;

        // Apply the knockback velocity
        this.body.velocity.x = velocityX;
        this.body.velocity.y = velocityY;

        // Enter knockback state to prevent AI from overriding
        this.isInKnockback = true;

        // Clear any existing knockback timer
        if (this.knockbackTimer) {
            this.knockbackTimer.destroy();
        }

        // Set timer to exit knockback state
        this.knockbackTimer = this.gameScene.time.addEvent({
            delay: this.knockbackDuration,
            callback: () => {
                this.isInKnockback = false;
                this.knockbackTimer = null;
            },
            callbackScope: this
        });
    }

    /**
     * Check if this enemy can take contact damage (respects cooldown)
     */
    canTakeContactDamage(): boolean {
        const now = this.gameScene.time.now;
        return now - this.lastCollisionTime >= this.collisionCooldown;
    }

    /**
     * Mark that contact damage was taken (starts cooldown)
     */
    markContactDamage(): void {
        this.lastCollisionTime = this.gameScene.time.now;
    }

    die(): void {
        this.gameScene.addExplosion(this.x, this.y);
        this.gameScene.removeEnemy(this);
    }

    getPower(): number {
        return this.power;
    }

    remove(): void {
        this.gameScene.removeEnemy(this);
    }

    createHealthBar(): void {
        if (!this.showHealthBar) return;

        // Create rectangles at (0, 0) since they're relative to the container
        const healthBarBottom = this.scene.add.rectangle(0, 0, this.width, 6, 0xff0000);
        const healthBarTop = this.scene.add.rectangle(0, 0, this.width, 6, 0x08ff00);

        // Create container above enemy
        this.healthBarContainer = this.scene.add.container(this.x, this.y - this.height, [
            healthBarBottom,
            healthBarTop
        ]);

        this.healthBarContainer.setDepth(Depth.PLAYER_UI);
    }

    updateHealthBarPosition(): void {
        if (!this.healthBarContainer) return;
        this.healthBarContainer.x = this.x;
        this.healthBarContainer.y = this.y - this.height * this.scaleY;
    }

    updateHealthBarValue(): void {
        if (!this.healthBarContainer) return;
        const remainingHealthRatio = this.health / this.maxHealth;
        const fullHealthWidth = (this.healthBarContainer.list[0] as Phaser.GameObjects.Rectangle).width;
        const remainingHealthWidth = fullHealthWidth * remainingHealthRatio;
        if (remainingHealthRatio <= 0) {
            (this.healthBarContainer.list[1] as Phaser.GameObjects.Rectangle).width = 0;
        } else {
            (this.healthBarContainer.list[1] as Phaser.GameObjects.Rectangle).width = remainingHealthWidth;
        }
    }

    handleDestruction(): void {
        this.on('destroy', () => {
            if (this.healthBarContainer) {
                this.healthBarContainer.destroy();
                this.healthBarContainer = null;
            }
            if (this.knockbackTimer) {
                this.knockbackTimer.destroy();
                this.knockbackTimer = null;
            }
        });
    }

    // Abstract method for AI behavior - must be implemented by subclasses
    protected abstract updateAI(time: number, delta: number): void;
}
