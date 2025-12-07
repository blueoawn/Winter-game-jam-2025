import ASSETS from '../../assets.js';
import { GameScene } from "../../scenes/GameScene.ts";
import { Depth } from '../../constants.ts';
// Note: InputState and PlayerState should be defined in network module
import { SyncableEntity } from '../../../network/SyncableEntity';
import Vector2 = Phaser.Math.Vector2;
import Container = Phaser.GameObjects.Container;

//TODO add stuff for rollback/network sync

export abstract class PlayerController extends Phaser.Physics.Arcade.Sprite implements SyncableEntity{
    protected characterSpeed = 1000;
    protected velocityMax = 500;
    protected drag = 2000;
    protected ability1Rate = 10;
    protected ability2Rate = 60;
    protected ability1Cooldown = 0;
    protected ability2Cooldown = 0;
    fireRate = 10;  // Keep for backward compatibility
    fireCounter = 0;
    maxHealth = 1;
    health = this.maxHealth;
    gameScene: GameScene;
    isLocal: boolean = false;
    playerId: string = '';
    lastVelocity: Vector2;

    // Appearance can be a standalone texture/image or a frame from a spritesheet/atlas
    appearance: { texture: string; frame?: string | number } | null = null;

    /**
     * Update the visual for this controller. Accepts either:
     *  - a texture key for a single image or atlas, or
     *  - a texture key + frame for a spritesheet/tile.
     *
     * This updates the underlying Arcade.Sprite texture/frame so the controller
     * can use any registered Phaser texture.
     */
    setAppearance(texture: string, frame?: string | number): void {
        this.appearance = { texture, frame };
        this.setTexture(texture);
        if (frame !== undefined && frame !== null) {
            this.setFrame(frame as any);
        }
    }
    healthBarContainer: Container;
    skillBarContainer: Container | null = null;
    protected skillBarEnabled: boolean = false;  // Disabled by default
    protected skillMeter: number = 0;
    protected maxSkillMeter: number = 100;
    protected currentAim: Vector2;  // Store current aim position for abilities

    constructor(scene: GameScene, x: number, y: number, shipId: number) {
        super(scene, x, y, ASSETS.spritesheet.ships.key, shipId);

        scene.add.existing(this);
        scene.physics.add.existing(this);
        this.setCollideWorldBounds(true); // prevent ship from leaving the screen
        this.setDepth(Depth.PLAYER); // make character appear on top of other game objects
        this.gameScene = scene;
        this.setMaxVelocity(this.velocityMax); // limit maximum speed of ship
        this.setDrag(this.drag);
        this.currentAim = new Vector2(x, y);  // Initialize aim to player position
        this.createHealthBar();
        this.createSkillBar();
        this.handleDestruction();
    }

    preUpdate(time: number, delta: number) {
        super.preUpdate(time, delta);

        this.updateHealthBarPosition();
        this.updateSkillBarPosition();
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

        // Handle rotation and aim
        if ('aim' in input && input.aim) {
            this.currentAim = input.aim;  // Store aim position for abilities
            this.rotation = Phaser.Math.Angle.Between(
                this.x, this.y, input.aim.x, input.aim.y
            ) + Math.PI / 2;
        } else {
            this.rotation = input.rotation;
            // If no aim provided, use rotation to calculate aim position ahead of player
            this.currentAim = new Vector2(
                this.x + Math.cos(this.rotation - Math.PI / 2) * 100,
                this.y + Math.sin(this.rotation - Math.PI / 2) * 100
            );
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

    hit(damage: number) {
        this.health -= damage;
        this.updateHealthBarValue();
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

    createHealthBar(): void {
        // Create rectangles at (0, 0) since they're relative to the container
        const healthBarBottom = this.scene.add.rectangle(0, 0, this.width, 10, 0xff0000);
        const healthBarTop = this.scene.add.rectangle(0, 0, this.width, 10, 0x08ff00);
        // Create container at player position
        this.healthBarContainer = this.scene.add.container(this.x, this.y - this.height, [
            healthBarBottom,
            healthBarTop
        ]);

        // Set depth on the container, not individual rectangles
        this.healthBarContainer.setDepth(Depth.PLAYER_UI);
    }

    updateHealthBarPosition(): void {
        this.healthBarContainer.x = this.x;
        this.healthBarContainer.y = this.y + this.height * this.scaleY;
    }

    updateHealthBarValue(): void {
        const remainingHealthRatio = this.health / this.maxHealth;
        const fullHealthWidth = (this.healthBarContainer.list[0] as Phaser.GameObjects.Rectangle).width;
        const remainingHealthWidth = fullHealthWidth * remainingHealthRatio;
        if (remainingHealthRatio <= 0) {
            (this.healthBarContainer.list[1] as Phaser.GameObjects.Rectangle).width = 0;
        } else {
            (this.healthBarContainer.list[1] as Phaser.GameObjects.Rectangle).width = remainingHealthWidth;
        }
    }

    createSkillBar(): void {
        if (!this.skillBarEnabled) return;

        // Create skill bar (yellow) below health bar
        const skillBarBottom = this.scene.add.rectangle(0, 0, this.width, 6, 0x555555);
        const skillBarTop = this.scene.add.rectangle(0, 0, this.width, 6, 0xffcc00);
        skillBarTop.width = 0;  // Start empty

        this.skillBarContainer = this.scene.add.container(this.x, this.y + this.height + 12, [
            skillBarBottom,
            skillBarTop
        ]);
        this.skillBarContainer.setDepth(Depth.PLAYER_UI);
    }

    updateSkillBarPosition(): void {
        if (!this.skillBarContainer) return;
        this.skillBarContainer.x = this.x;
        this.skillBarContainer.y = this.y + this.height + 12;
    }

    updateSkillBarValue(): void {
        if (!this.skillBarContainer) return;
        const ratio = this.skillMeter / this.maxSkillMeter;
        const fullWidth = (this.skillBarContainer.list[0] as Phaser.GameObjects.Rectangle).width;
        (this.skillBarContainer.list[1] as Phaser.GameObjects.Rectangle).width = fullWidth * Math.max(0, Math.min(1, ratio));
    }

    handleDestruction(): void {
        this.on('destroy', () => {
            // Delay destruction of health bar to ensure it is visible when player dies
            // Because instantly destroying it after death would be kinda jank?? idk
            const delayedDestructionTimer = this.gameScene.time.delayedCall(1000, () => {
                this.healthBarContainer.destroy();
                if (this.skillBarContainer) {
                    this.skillBarContainer.destroy();
                }
                delayedDestructionTimer.destroy();
            });
        });
    }

    private lastNetworkInput: InputState | null = null;
}
