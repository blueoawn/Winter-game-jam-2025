import ASSETS from '../assets.js';
import { GameScene } from "../scenes/Game.ts";

export default class PlayerBullet extends Phaser.Physics.Arcade.Sprite {
    power = 1;
    moveVelocity = 1000;
    gameScene: GameScene;

    constructor(scene: GameScene, x: number, y: number, power: number) {
        super(scene, x, y, ASSETS.spritesheet.tiles.key, power-1);

        scene.add.existing(this);
        scene.physics.add.existing(this);

        this.setSize(12, 32); // resize hitbox to correctly fit image instead of using the entire tile size
        this.setDepth(10);
        this.gameScene = scene;
        this.setVelocityY(-this.moveVelocity); // bullet vertical speed
    }

    preUpdate(time: number, delta: number) {
        super.preUpdate(time, delta);

        this.checkWorldBounds();
    }

    getPower() {
        return this.power;
    }

    // is this bullet above the screen?
    checkWorldBounds() {
        if (this.y < 0) {
            this.remove();
        }
    }

    remove() {
        this.gameScene.removeBullet(this);
    }
}
