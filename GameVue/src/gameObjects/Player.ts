import ASSETS from '../assets.js';
import { GameScene } from "../scenes/Game.ts";
import type { PlayerState } from '../../network/StateSerializer';

interface InputState {
    left?: boolean;
    right?: boolean;
    up?: boolean;
    down?: boolean;
    fire?: boolean;
}

export default class Player extends Phaser.Physics.Arcade.Sprite {
    velocityIncrement = 50;
    velocityMax = 500;
    drag = 1000;
    fireRate = 10;
    fireCounter = 0;
    health = 1;
    gameScene: GameScene;
    isLocal: boolean = false;
    playerId: string = '';

    constructor(scene: GameScene, x: number, y: number, shipId: number) {
        super(scene, x, y, ASSETS.spritesheet.ships.key, shipId);

        scene.add.existing(this);
        scene.physics.add.existing(this);
        this.setCollideWorldBounds(true); // prevent ship from leaving the screen
        this.setDepth(100); // make ship appear on top of other game objects
        this.gameScene = scene;
        this.setMaxVelocity(this.velocityMax); // limit maximum speed of ship
        this.setDrag(this.drag);
    }

    preUpdate(time: number, delta: number) {
        super.preUpdate(time, delta);

        if (this.fireCounter > 0) this.fireCounter--;

        // Only check input for local player
        if (this.isLocal) {
            this.checkInput();
        }
    }

    checkInput() {
        const cursors = this.gameScene.cursors; // get cursors object from Game scene
        if (!cursors) {
            return
        }

        const leftKey = cursors.left.isDown;
        const rightKey = cursors.right.isDown;
        const upKey = cursors.up.isDown;
        const downKey = cursors.down.isDown;
        const spaceKey = cursors.space.isDown;

        const moveDirection = { x: 0, y: 0 }; // default move direction

        if (leftKey) moveDirection.x--;
        if (rightKey) moveDirection.x++;
        if (upKey) moveDirection.y--;
        if (downKey) moveDirection.y++;
        if (spaceKey) this.fire();

        if (this.body) {
            this.body.velocity.x += moveDirection.x * this.velocityIncrement; // increase horizontal velocity
            this.body.velocity.y += moveDirection.y * this.velocityIncrement; // increase vertical velocity
        }
    }

    fire() {
        if (this.fireCounter > 0) return;

        this.fireCounter = this.fireRate;

        this.gameScene.fireBullet(this.x, this.y);
    }

    hit(damage: number) {
        this.health -= damage;

        if (this.health <= 0) this.die();
    }

    die() {
        this.gameScene.addExplosion(this.x, this.y);
        this.destroy(); // destroy sprite so it is no longer updated
    }

    // Network methods for multiplayer

    // Apply input state (used by host for all players)
    applyInput(inputState: InputState) {
        if (!this.body) return;

        const moveDirection = { x: 0, y: 0 };

        if (inputState.left) moveDirection.x--;
        if (inputState.right) moveDirection.x++;
        if (inputState.up) moveDirection.y--;
        if (inputState.down) moveDirection.y++;
        if (inputState.fire) this.fire();

        this.body.velocity.x += moveDirection.x * this.velocityIncrement;
        this.body.velocity.y += moveDirection.y * this.velocityIncrement;
    }

    // Apply full state from network (used by clients)
    applyState(state: PlayerState) {
        this.setPosition(state.x, state.y);
        this.setRotation(state.rotation);
        this.health = state.health;

        if (this.body) {
            this.body.velocity.x = state.velocityX;
            this.body.velocity.y = state.velocityY;
        }

        if (state.frame !== undefined && state.frame !== null) {
            this.setFrame(state.frame);
        }
    }

    // Get current input state (used by local player to send to host)
    getCurrentInput(): InputState {
        const cursors = this.gameScene.cursors;
        if (!cursors) {
            return {};
        }

        return {
            left: cursors.left.isDown,
            right: cursors.right.isDown,
            up: cursors.up.isDown,
            down: cursors.down.isDown,
            fire: cursors.space.isDown
        };
    }
}
