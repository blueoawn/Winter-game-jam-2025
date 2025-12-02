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
    characterSpeed = 1000;
    velocityMax = 500;
    drag = 2000;
    fireRate = 10;
    fireCounter = 0;
    health = 1;
    gameScene: GameScene;
    isLocal: boolean = false;
    playerId: string = '';
    keys = {
        wKeyDown: false,
        aKeyDown: false,
        sKeyDown: false,
        dKeyDown: false,
    }

    constructor(scene: GameScene, x: number, y: number, shipId: number) {
        super(scene, x, y, ASSETS.spritesheet.ships.key, shipId);

        scene.add.existing(this);
        scene.physics.add.existing(this);
        this.setCollideWorldBounds(true); // prevent ship from leaving the screen
        this.setDepth(100); // make ship appear on top of other game objects
        this.gameScene = scene;
        this.setMaxVelocity(this.velocityMax); // limit maximum speed of ship
        this.setDrag(this.drag);
        this.listenToKeyboardInputs();
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

        const moveDirection = new Phaser.Math.Vector2();
        const mouseXPosition = this.gameScene.input.mousePointer.x
        const mouseYPosition = this.gameScene.input.mousePointer.y;
        const spaceKeyDown = cursors.space.isDown;

        if (this.keys.aKeyDown) moveDirection.x--;
        if (this.keys.dKeyDown) moveDirection.x++;
        if (this.keys.wKeyDown) moveDirection.y--;
        if (this.keys.sKeyDown) moveDirection.y++;
        if (spaceKeyDown) this.fire();

        if (this.body) {
            this.rotation = Math.atan2((this.y - mouseYPosition), (this.x - mouseXPosition)) - Math.PI / 2;
            moveDirection.normalize()
            this.setVelocity(moveDirection.x * this.characterSpeed, moveDirection.y * this.characterSpeed)
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

        this.body.velocity.x += moveDirection.x * this.characterSpeed;
        this.body.velocity.y += moveDirection.y * this.characterSpeed;
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

    listenToKeyboardInputs(): void {
        if (this.gameScene.input.keyboard) {
            this.gameScene.input.keyboard.on('keydown', (event) => {
                switch (event.key) {
                    case 'w':
                        this.keys.wKeyDown = true;
                        break;
                    case 'a':
                        this.keys.aKeyDown = true;
                        break;
                    case 's':
                        this.keys.sKeyDown = true;
                        break;
                    case 'd':
                        this.keys.dKeyDown = true;
                        break;
                }
            });

            this.gameScene.input.keyboard.on('keyup', (event) => {
                switch (event.key) {
                    case 'w':
                        this.keys.wKeyDown = false;
                        break;
                    case 'a':
                        this.keys.aKeyDown = false;
                        break;
                    case 's':
                        this.keys.sKeyDown = false;
                        break;
                    case 'd':
                        this.keys.dKeyDown = false;
                        break;
                }
            });
        }
    }
}
