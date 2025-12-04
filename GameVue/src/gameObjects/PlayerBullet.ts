import ASSETS from '../assets.js';
import { GameScene } from "../scenes/Game.ts";
import Vector2 = Phaser.Math.Vector2;

export default class PlayerBullet extends Phaser.Physics.Arcade.Sprite {
    id: string;
    power = 1;
    bulletSpeed = 1000;
    gameScene: GameScene;
    private static nextId = 0;

    // Damage falloff properties
    originX = 0;
    originY = 0;
    baseDamage = 1;
    minDamage = 0.2;
    falloffStart = 100;
    falloffEnd = 250;
    hasFalloff = false;

    constructor(scene: GameScene, from: {x: number, y: number}, to: {x: number, y: number}, power: number) {
        super(scene, from.x, from.y, ASSETS.spritesheet.tiles.key, power-1);

        this.id = `bullet_${Date.now()}_${PlayerBullet.nextId++}`;

        scene.add.existing(this);
        scene.physics.add.existing(this);

        this.setSize(12, 32);
        this.setDepth(10);
        this.gameScene = scene;
        this.power = power;
        this.baseDamage = power;
        this.originX = from.x;
        this.originY = from.y;

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
        if (!this.hasFalloff) {
            return this.power;
        }

        const dx = this.x - this.originX;
        const dy = this.y - this.originY;
        const distance = Math.sqrt(dx * dx + dy * dy);

        if (distance <= this.falloffStart) {
            return this.baseDamage;
        }

        if (distance >= this.falloffEnd) {
            return this.baseDamage * this.minDamage;
        }

        const falloffRange = this.falloffEnd - this.falloffStart;
        const falloffProgress = (distance - this.falloffStart) / falloffRange;
        const damageMultiplier = 1 - (falloffProgress * (1 - this.minDamage));

        return this.baseDamage * damageMultiplier;
    }

    setFalloff(baseDamage: number, minDamage: number, falloffStart: number, falloffEnd: number): void {
        this.hasFalloff = true;
        this.baseDamage = baseDamage;
        this.minDamage = minDamage;
        this.falloffStart = falloffStart;
        this.falloffEnd = falloffEnd;
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
