import ASSETS from '../assets.js';
import ANIMATION from '../animation.ts';
import { GameScene } from "../scenes/GameScene.ts";

export default class Explosion extends Phaser.GameObjects.Sprite {

    constructor(scene: GameScene, x: number, y: number) {
        super(scene, x, y, ASSETS.spritesheet.tiles.key, 4);

        scene.add.existing(this);

        this.setDepth(10);
        this.anims.play(ANIMATION.explosion.key);

        // cleanup after animation completes
        this.on(Phaser.Animations.Events.ANIMATION_COMPLETE, () => {
            this.destroy();
        }, this);
    }
}
