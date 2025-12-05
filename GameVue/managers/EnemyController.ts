import ASSETS from '../src/assets.js';
import type { GameScene } from '../src/scenes/Game.ts';
import { Depth } from '../src/constants.ts';
import Container = Phaser.GameObjects.Container;

export abstract class EnemyController extends Phaser.Physics.Arcade.Sprite {
    health: number = 1;
    maxHealth: number = 1;
    power: number = 1;  // Damage dealt to player
    enemyId: string;
    enemyType: string = 'EnemyFlying';  // Default type, should be overridden by subclasses
    gameScene: GameScene;
    healthBarContainer: Container | null = null;
    protected showHealthBar: boolean = true;  // Can be disabled per enemy type

    private static nextId = 0;

    constructor(scene: GameScene, x: number, y: number, frame: number) {
        super(scene, x, y, ASSETS.spritesheet.ships.key, frame);

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

        // Update AI behavior (implemented by subclasses)
        this.updateAI(time, delta);
    }

    hit(damage: number): void {
        this.health -= damage;
        this.updateHealthBarValue();
        if (this.health <= 0) {
            this.die();
        }
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
        this.healthBarContainer.y = this.y - this.height;
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
        });
    }

    // Abstract method for AI behavior - must be implemented by subclasses
    protected abstract updateAI(time: number, delta: number): void;
}
