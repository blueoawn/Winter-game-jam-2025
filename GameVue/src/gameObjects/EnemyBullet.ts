import ASSETS from '../assets.js';
import { GameScene } from "../scenes/Game.ts";

export default class EnemyBullet extends Phaser.Physics.Arcade.Sprite {
    power = 1;
    moveVelocity = 200;
    gameScene: GameScene;

    constructor(scene: GameScene, x: number, y: number, power: number) {
        const tileId = 11;
        super(scene, x, y, ASSETS.spritesheet.tiles.key, tileId + power);

        scene.add.existing(this);
        scene.physics.add.existing(this);

        this.power = power;
        this.setSize(16, 24); // resize hitbox to correctly fit image instead of using the entire tile size
        this.setFlipY(true); // flip image vertically to point downwards
        this.setDepth(10);
        this.gameScene = scene;
        this.setVelocityY(this.moveVelocity * power * 0.5); // bullet vertical speed
    }

    preUpdate(time: number, delta: number) {
        super.preUpdate(time, delta);

        this.checkWorldBounds();
    }

    getPower() {
        return this.power;
    }

    // is this bullet below the screen?
    checkWorldBounds() {
        if (this.y > this.scene.scale.height) {
            this.die();
        }
    }

    die() {
        this.gameScene.removeEnemyBullet(this);
    }
}
