//TODO Bluepawn is reworking this into something better

import ASSETS from '../assets.js';
import { GameScene } from "../scenes/Game.ts";
import Vector2 = Phaser.Math.Vector2;
import Spline = Phaser.Curves.Spline;

export default class EnemyFlying extends Phaser.Physics.Arcade.Sprite {
    health = 1; // enemy health
    fireCounterMin = 100; // minimum fire rate
    fireCounterMax = 300; // maximum fire rate
    fireCounter;
    power = 1; // enemy strength
    shipId: number;  // Store shipId for network sync
    pathId: number;  // Store pathId for network sync
    enemyId: string;  // Unique ID for network tracking
    private static nextId = 0;  // Static counter for generating unique IDs

    // path coordinates for enemy to follow
    paths = [
        [[200, -50], [1080, 160], [200, 340], [1080, 520], [200, 700], [1080, 780]],
        [[-50, 200], [1330, 200], [1330, 400], [-50, 400], [-50, 600], [1330, 600]],
        [[-50, 360], [640, 50], [1180, 360], [640, 670], [50, 360], [640, 50], [1180, 360], [640, 670], [-50, 360]],
        [[1330, 360], [640, 50], [50, 360], [640, 670], [1180, 360], [640, 50], [50, 360], [640, 670], [1330, 360]],
    ]
    gameScene: GameScene;
    pathVector: Vector2;
    path: Spline;
    pathIndex: number;
    pathSpeed: number;

    constructor(scene: GameScene, shipId: number, pathId: number, speed: number, power: number) {
        const startingId = 12;
        super(scene, 500, 500, ASSETS.spritesheet.ships.key, startingId + shipId);

        scene.add.existing(this);
        scene.physics.add.existing(this);

        // Store properties for network synchronization
        this.shipId = shipId;
        this.pathId = pathId;
        this.power = power;
        this.enemyId = `enemy_${Date.now()}_${EnemyFlying.nextId++}`;  // Generate unique ID

        this.fireCounter = Phaser.Math.RND.between(this.fireCounterMin, this.fireCounterMax); // random firing interval
        this.setFlipY(true); // flip image vertically
        this.setDepth(10);
        this.gameScene = scene;

        this.initPath(pathId, speed); // choose path to follow
    }

    preUpdate(time: number, delta: number) {
        super.preUpdate(time, delta);
        if (this.pathIndex > 1) return; // stop updating if reached end of path

        this.path.getPoint(this.pathIndex, this.pathVector); // get current coordinate based on percentage moved

        this.setPosition(this.pathVector.x, this.pathVector.y); // set position of this enemy

        this.pathIndex += this.pathSpeed; // increment percentage moved by pathSpeed

        if (this.pathIndex > 1) this.die();

        // update firing interval
        if (this.fireCounter > 0) this.fireCounter--;
        else {
            this.fire();
        }
    }

    hit(damage: number) {
        this.health -= damage;

        if (this.health <= 0) this.die();
    }

    die() {
        this.gameScene.addExplosion(this.x, this.y);
        this.gameScene.removeEnemy(this);
    }

    fire() {
        this.fireCounter = Phaser.Math.RND.between(this.fireCounterMin, this.fireCounterMax);
        this.gameScene.fireEnemyBullet(this.x, this.y, this.power);
    }

    initPath(pathId: number, speed: number) {
        const points = this.paths[pathId];

        this.path = new Phaser.Curves.Spline(points);
        this.pathVector = new Phaser.Math.Vector2(); // current coordinates along path in pixels
        this.pathIndex = 0; // percentage of position moved along path, 0 = beginning, 1 = end
        this.pathSpeed = speed; // speed of movement

        this.path.getPoint(0, this.pathVector); // get coordinates based on pathIndex

        this.setPosition(this.pathVector.x, this.pathVector.y);
    }

    getPower() {
        return this.power;
    }

    remove() {
        this.gameScene.removeEnemy(this);
    }
}
