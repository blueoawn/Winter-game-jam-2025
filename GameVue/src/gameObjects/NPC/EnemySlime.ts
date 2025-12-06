import { EnemyController } from './EnemyController';
import { GameScene } from '../../scenes/GameScene';
import ASSETS from '../../assets';

export default class EnemySlime extends EnemyController {
    private moveSpeed: number = 50;
    private targetX: number = 0;
    private targetY: number = 0;
    private chaseRange: number = 300;
    private currentDirection: string = 'down';

    // Animation keys
    static readonly ANIM_DOWN = 'slime_down';
    static readonly ANIM_LEFT = 'slime_left';
    static readonly ANIM_RIGHT = 'slime_right';
    static readonly ANIM_UP = 'slime_up';

    constructor(scene: GameScene, x: number, y: number) {
        // Pass frame 0 temporarily, we'll set the texture after
        super(scene, x, y, 0);

        // Override texture to use slime spritesheet
        this.setTexture(ASSETS.spritesheet.slime.key, 0);

        this.enemyType = 'EnemySlime';

        // Set stats
        this.health = 3;
        this.maxHealth = 3;
        this.power = 1;

        this.setScale(0.15, 0.15)
        this.setBodySize(this.width, this.height);

        this.setCollideWorldBounds(true);

        // Create animations if they don't exist
        this.createAnimations();

        // Start with down animation
        this.play(EnemySlime.ANIM_DOWN);
    }

    private createAnimations(): void {
        const anims = this.scene.anims;

        // Row 0 (frames 0-4): Down
        if (!anims.exists(EnemySlime.ANIM_DOWN)) {
            anims.create({
                key: EnemySlime.ANIM_DOWN,
                frames: anims.generateFrameNumbers(ASSETS.spritesheet.slime.key, { start: 0, end: 4 }),
                frameRate: 8,
                repeat: -1
            });
        }

        // Row 1 (frames 5-9): Left
        if (!anims.exists(EnemySlime.ANIM_LEFT)) {
            anims.create({
                key: EnemySlime.ANIM_LEFT,
                frames: anims.generateFrameNumbers(ASSETS.spritesheet.slime.key, { start: 5, end: 9 }),
                frameRate: 8,
                repeat: -1
            });
        }

        // Row 2 (frames 10-14): Right
        if (!anims.exists(EnemySlime.ANIM_RIGHT)) {
            anims.create({
                key: EnemySlime.ANIM_RIGHT,
                frames: anims.generateFrameNumbers(ASSETS.spritesheet.slime.key, { start: 10, end: 14 }),
                frameRate: 8,
                repeat: -1
            });
        }

        // Row 3 (frames 15-19): Up
        if (!anims.exists(EnemySlime.ANIM_UP)) {
            anims.create({
                key: EnemySlime.ANIM_UP,
                frames: anims.generateFrameNumbers(ASSETS.spritesheet.slime.key, { start: 15, end: 19 }),
                frameRate: 8,
                repeat: -1
            });
        }
    }

    protected updateAI(_time: number, _delta: number): void {
        const player = this.gameScene.player;
        if (!player || !player.active) {
            this.setVelocity(0, 0);
            return;
        }

        const distanceToPlayer = Phaser.Math.Distance.Between(this.x, this.y, player.x, player.y);

        if (distanceToPlayer <= this.chaseRange) {
            // Chase player
            this.targetX = player.x;
            this.targetY = player.y;

            const angle = Phaser.Math.Angle.Between(this.x, this.y, this.targetX, this.targetY);
            const velocityX = Math.cos(angle) * this.moveSpeed;
            const velocityY = Math.sin(angle) * this.moveSpeed;

            this.setVelocity(velocityX, velocityY);

            // Update animation based on movement direction
            this.updateAnimation(velocityX, velocityY);
        } else {
            // Idle - stop moving
            this.setVelocity(0, 0);
        }
    }

    private updateAnimation(velocityX: number, velocityY: number): void {
        let newDirection = this.currentDirection;

        // Determine primary direction based on velocity
        if (Math.abs(velocityX) > Math.abs(velocityY)) {
            // Moving more horizontally
            newDirection = velocityX < 0 ? 'left' : 'right';
        } else {
            // Moving more vertically
            newDirection = velocityY < 0 ? 'up' : 'down';
        }

        // Only change animation if direction changed
        if (newDirection !== this.currentDirection) {
            this.currentDirection = newDirection;

            switch (newDirection) {
                case 'down':
                    this.play(EnemySlime.ANIM_DOWN);
                    break;
                case 'left':
                    this.play(EnemySlime.ANIM_LEFT);
                    break;
                case 'right':
                    this.play(EnemySlime.ANIM_RIGHT);
                    break;
                case 'up':
                    this.play(EnemySlime.ANIM_UP);
                    break;
            }
        }
    }

    die(): void {
        this.gameScene.addExplosion(this.x, this.y);
        this.gameScene.removeEnemy(this);
    }
}

