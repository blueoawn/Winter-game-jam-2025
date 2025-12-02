import ASSETS from '../assets.js';
import { GameScene } from "../scenes/Game.ts";
import type { InputState, PlayerState } from '../../network/StateSerializer';
import Vector2 = Phaser.Math.Vector2;

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
    lastVelocity: Vector2;

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
            this.checkLocalInput();
        }
    }


    checkLocalInput() {
        const cursors = this.gameScene.cursors; // get cursors object from Game scene
        if (!cursors) {
            return
        }

        const moveDirection = new Phaser.Math.Vector2();
        const mouseXPosition = this.gameScene.input.mousePointer.x;
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

        this.gameScene.fireBullet(
            {x: this.x, y: this.y},
            {x: this.gameScene.input.mousePointer.x, y: this.gameScene.input.mousePointer.y}
        );
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
        if (inputState.fire) this.fire();
        const velocityVector = new Vector2(inputState.velocity.x, inputState.velocity.y);
        velocityVector.normalize();
        this.setVelocity(velocityVector.x * inputState.movementSpeed, velocityVector.y * inputState.movementSpeed);
        this.rotation = inputState.rotation;
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
        const cursors = this.gameScene.cursors; // get cursors object from Game scene
        const defaultInputState = {
            movementSpeed: this.characterSpeed,
            velocity: this.lastVelocity,
            rotation: this.rotation,
            fire: false
        }
        if (!cursors) {
            return defaultInputState;
        }

        const velocity = new Phaser.Math.Vector2();
        const mouseXPosition = this.gameScene.input.mousePointer.x
        const mouseYPosition = this.gameScene.input.mousePointer.y;
        const spaceKeyDown = cursors.space.isDown;

        if (this.keys.aKeyDown) velocity.x--;
        if (this.keys.dKeyDown) velocity.x++;
        if (this.keys.wKeyDown) velocity.y--;
        if (this.keys.sKeyDown) velocity.y++;
        if (spaceKeyDown) this.fire();

        velocity.x = velocity.x * this.characterSpeed
        velocity.y = velocity.y * this.characterSpeed

        const rotation = Math.atan2((this.y - mouseYPosition), (this.x - mouseXPosition)) - Math.PI / 2;
        this.lastVelocity = velocity;

        return {
            movementSpeed: this.characterSpeed,
            velocity,
            rotation,
            fire: spaceKeyDown
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
