//TODO Bluepawn is reworking this into something better

import { EnemyController } from './EnemyController';
import { GameScene } from '../../scenes/GameScene';
import Vector2 = Phaser.Math.Vector2;
import Spline = Phaser.Curves.Spline;

// Flying enemy that follows a predefined spline path
export default class EnemyFlying extends EnemyController {
    // Path properties
    shipId: number;
    pathId: number;
    pathVector: Vector2;
    path: Spline;
    pathIndex: number;
    pathSpeed: number;

    // Firing properties
    fireCounterMin: number = 100;
    fireCounterMax: number = 300;
    fireCounter: number;

    // Predefined path coordinates
    static readonly paths = [
        [[200, -50], [1080, 160], [200, 340], [1080, 520], [200, 700], [1080, 780]],
        [[-50, 200], [1330, 200], [1330, 400], [-50, 400], [-50, 600], [1330, 600]],
        [[-50, 360], [640, 50], [1180, 360], [640, 670], [50, 360], [640, 50], [1180, 360], [640, 670], [-50, 360]],
        [[1330, 360], [640, 50], [50, 360], [640, 670], [1180, 360], [640, 50], [50, 360], [640, 670], [1330, 360]],
    ];

    constructor(scene: GameScene, shipId: number, pathId: number, speed: number, power: number) {
        const startingFrame = 12;
        super(scene, 500, 500, startingFrame + shipId);

        // Set enemy type for network sync
        this.enemyType = 'EnemyFlying';

        this.shipId = shipId;
        this.pathId = pathId;
        this.power = power;
        this.fireCounter = Phaser.Math.RND.between(this.fireCounterMin, this.fireCounterMax);

        this.setFlipY(true);
        if (pathId === 0) {
            this.setPosition(this.gameScene.scale.width / 2, this.gameScene.scale.height / 2);
        }
        this.initPath(pathId, speed);

        // Create health bar after initialization
        this.createHealthBar();
    }

    protected updateAI(_time: number, _delta: number): void {
        if (this.pathIndex > 1) return;

        // Get current coordinate based on percentage moved
        this.path.getPoint(this.pathIndex, this.pathVector);
        this.setPosition(this.pathVector.x, this.pathVector.y);

        // Increment percentage moved by pathSpeed
        this.pathIndex += this.pathSpeed;

        // Handle firing
        if (this.fireCounter > 0) {
            this.fireCounter--;
        } else {
            this.fire();
        }

        // Die when reaching end of path
        if (this.pathIndex > 1) {
            this.die();
        }
    }

    fire(): void {
        this.fireCounter = Phaser.Math.RND.between(this.fireCounterMin, this.fireCounterMax);
        this.gameScene.fireEnemyBullet(this.x, this.y, this.power);
    }

    initPath(pathId: number, speed: number): void {
        const points = EnemyFlying.paths[pathId];

        this.path = new Phaser.Curves.Spline(points);
        this.pathVector = new Phaser.Math.Vector2();
        this.pathIndex = 0;
        this.pathSpeed = speed;

        // Set initial position
        this.path.getPoint(0, this.pathVector);
        this.setPosition(this.pathVector.x, this.pathVector.y);
    }
}
