import ASSETS from '../assets.js';
import { GameScene } from "../scenes/Game.ts";

export default class EnemyBullet extends Phaser.Physics.Arcade.Sprite {
    id: string;  // Unique ID for network syncing
    power = 1;
    moveVelocity = 200;
    gameScene: GameScene;
    private static nextId = 0;  // Static counter for generating unique IDs

    constructor(
        scene: GameScene,
        x: number,
        y: number,
        power: number,
        targetX?: number,
        targetY?: number
    ) {
        const tileId = 11;
        super(scene, x, y, ASSETS.spritesheet.tiles.key, tileId + power);

        scene.add.existing(this);
        scene.physics.add.existing(this);

        // Generate unique ID for this bullet
        this.id = `enemy_bullet_${Date.now()}_${EnemyBullet.nextId++}`;

        this.power = power;
        this.setSize(16, 24); // resize hitbox to correctly fit image instead of using the entire tile size
        this.setDepth(10);
        this.gameScene = scene;

        // If target coordinates provided, fire towards target (for aimed bullets)
        if (targetX !== undefined && targetY !== undefined) {
            const angle = Phaser.Math.Angle.Between(x, y, targetX, targetY);
            this.setVelocity(
                Math.cos(angle) * this.moveVelocity,
                Math.sin(angle) * this.moveVelocity
            );
            // Rotate bullet to face direction of travel
            this.setRotation(angle + Math.PI / 2);
        } else {
            // Default behavior: fire straight down (for legacy enemies)
            this.setFlipY(true); // flip image vertically to point downwards
            this.setVelocityY(this.moveVelocity * power * 0.5); // bullet vertical speed
        }

        // Ensure physics body is enabled and active
        if (this.body) {
            this.body.enable = true;
        }
    }

    preUpdate(time: number, delta: number) {
        super.preUpdate(time, delta);

        this.checkWorldBounds();
    }

    getPower() {
        return this.power;
    }

    // is this bullet off the screen?
    checkWorldBounds() {
        const worldBounds = this.scene.physics.world.bounds;

        if (this.x < worldBounds.x ||
            this.x > worldBounds.x + worldBounds.width ||
            this.y < worldBounds.y ||
            this.y > worldBounds.y + worldBounds.height) {
            this.die();
        }
    }

    die() {
        this.gameScene.removeEnemyBullet(this);
    }
}
