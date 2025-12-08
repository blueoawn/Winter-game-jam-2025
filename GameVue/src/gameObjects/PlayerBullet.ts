/* Deprecated from when we were using pool instead of entity deltas

import ASSETS from '../assets.js';
import { GameScene } from "../scenes/Game.ts";
import Vector2 = Phaser.Math.Vector2;

export default class PlayerBullet extends Phaser.Physics.Arcade.Sprite {
    id: string;
    power = 1;
    bulletSpeed = 1000;
    gameScene: GameScene;
    private static nextId = 0;
    private createdTime: number = 0;  // Track when bullet was created/acquired
    private maxLifetime: number = 3000;  // Auto-reclaim after 3 seconds

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
        this.createdTime = Date.now();  // Set creation time

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

        // Ensure physics body is enabled and active
        if (this.body) {
            this.body.enable = true;
        }
    }

    preUpdate(time: number, delta: number) {
        super.preUpdate(time, delta);

        // Auto-reclaim bullets after 3 seconds
        if (Date.now() - this.createdTime > this.maxLifetime) {
            console.log(`PlayerBullet: Auto-reclaiming bullet ${this.id} after ${this.maxLifetime}ms`);
            this.remove();
            return;
        }

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
        const worldBounds = this.scene.physics.world.bounds;

        if (this.x < worldBounds.x ||
            this.x > worldBounds.x + worldBounds.width ||
            this.y < worldBounds.y ||
            this.y > worldBounds.y + worldBounds.height) {
            this.remove();
        }
    }

    remove() {
        this.gameScene.removeBullet(this);
    }
}
*/