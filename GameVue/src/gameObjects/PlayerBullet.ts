import ASSETS from '../assets.js';
import { GameScene } from "../scenes/Game.ts";
import Vector2 = Phaser.Math.Vector2;

export default class PlayerBullet extends Phaser.Physics.Arcade.Sprite {
    id: string;  // Unique ID for network syncing
    power = 1;
    bulletSpeed = 1000;
    gameScene: GameScene;
    private static nextId = 0;  // Static counter for generating unique IDs

    constructor(scene: GameScene, from: {x: number, y: number}, to: {x: number, y: number}, power: number) {
        super(scene, from.x, from.y, ASSETS.spritesheet.tiles.key, power-1);

        // Generate unique ID for this bullet
        this.id = `bullet_${Date.now()}_${PlayerBullet.nextId++}`;

        scene.add.existing(this);
        scene.physics.add.existing(this);

        this.setSize(12, 32); // resize hitbox to correctly fit image instead of using the entire tile size
        this.setDepth(10);
        this.gameScene = scene;
        const velocityVector = new Vector2(to.x - from.x, to.y - from.y);
        this.rotation = Math.atan2(to.y - from.y, to.x - from.x) - Math.PI / 2;
        velocityVector.normalize();

        this.setVelocity(velocityVector.x * this.bulletSpeed, velocityVector.y * this.bulletSpeed);
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
        if (this.y < 0 || this.x < 0) {
            this.remove();
        }
    }

    remove() {
        this.gameScene.removeBullet(this);
    }
}
