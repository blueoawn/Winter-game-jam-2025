import ASSETS from '../src/assets.js';
import { GameScene } from "../src/scenes/Game.ts";
import type { InputState, PlayerState } from '../network/StateSerializer.ts';
import Vector2 = Phaser.Math.Vector2;

export abstract class PlayerController extends Phaser.Physics.Arcade.Sprite {
    protected characterSpeed = 1000;
    protected velocityMax = 500;
    protected drag = 2000;
    protected ability1Rate = 10;
    protected ability2Rate = 60;
    protected ability1Cooldown = 0;
    protected ability2Cooldown = 0;
    fireRate = 10;  // Keep for backward compatibility
    fireCounter = 0;
    health = 1;
    gameScene: GameScene;
    isLocal: boolean = false;
    playerId: string = '';
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
    }

    preUpdate(time: number, delta: number) {
        super.preUpdate(time, delta);

        if (this.fireCounter > 0) this.fireCounter--;
        if (this.ability1Cooldown > 0) this.ability1Cooldown--;
        if (this.ability2Cooldown > 0) this.ability2Cooldown--;
    }

    // Abstract methods for character implementations
    protected abstract ability1(): void;
    protected abstract ability2(): void;

    // Cooldown helpers
    protected canUseAbility1(): boolean {
        return this.ability1Cooldown <= 0;
    }

    protected canUseAbility2(): boolean {
        return this.ability2Cooldown <= 0;
    }

    protected startAbility1Cooldown(): void {
        this.ability1Cooldown = this.ability1Rate;
    }

    protected startAbility2Cooldown(): void {
        this.ability2Cooldown = this.ability2Rate;
    }

    // Process input from ButtonMapper or network
    processInput(input: any): void {
        // Handle movement
        let movement: Phaser.Math.Vector2;
        if ('movement' in input) {
            movement = input.movement.clone();
        } else {
            movement = new Phaser.Math.Vector2(input.velocity.x, input.velocity.y);
        }

        movement.normalize();
        const speed = ('movementSpeed' in input) ? input.movementSpeed : this.characterSpeed;
        this.setVelocity(movement.x * speed, movement.y * speed);

        // Handle rotation
        if ('aim' in input) {
            this.rotation = Phaser.Math.Angle.Between(
                this.x, this.y, input.aim.x, input.aim.y
            ) + Math.PI / 2;
        } else {
            this.rotation = input.rotation;
        }

        // Handle abilities
        const ability1Active = ('ability1' in input) ? input.ability1 : input.fire;
        const ability2Active = ('ability2' in input) ? input.ability2 : false;

        if (ability1Active) this.ability1();
        if (ability2Active) this.ability2();
    }

    // Store input for network serialization
    storeInputForNetwork(abstractInput: any): void {
        this.lastNetworkInput = {
            movementSpeed: this.characterSpeed,
            velocity: abstractInput.movement,
            rotation: this.rotation,
            ability1: abstractInput.ability1,
            ability2: abstractInput.ability2
        };
    }

    // Legacy fire method - can remove this now
    // Character-specific abilities are implemented via ability1() and ability2()
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
        this.processInput(inputState);
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
    // Returns the last stored input from storeInputForNetwork() or a default state
    getCurrentInput(): InputState {
        return this.lastNetworkInput || {
            movementSpeed: this.characterSpeed,
            velocity: this.lastVelocity || new Vector2(0, 0),
            rotation: this.rotation,
            ability1: false,
            ability2: false
        };
    }

    private lastNetworkInput: InputState | null = null;
}
