import * as Phaser from 'phaser';

export enum ControlScheme {
    KEYBOARD_MOUSE = 'keyboard_mouse',
    GAMEPAD = 'gamepad',
    TOUCH = 'touch'
}

export interface AbstractInputState {
    movement: Phaser.Math.Vector2;  // Normalized direction
    aim: Phaser.Math.Vector2;       // World coordinates
    ability1: boolean;
    ability2: boolean;
}

export class ButtonMapper {
    private scene: Phaser.Scene;
    private currentScheme: ControlScheme;
    private keys: any;
    private gamepad: Phaser.Input.Gamepad.Gamepad | null = null;
    private keyboardInitialized: boolean = false;
    private setupRetryCount: number = 0;
    private maxRetries: number = 50;  // Try for up to 5 seconds (50 * 100ms)

    // Mapping dictionaries for remappable controls
    // Action -> button index
    private keyboardMap: Map<string, number> = new Map();
    private gamepadMap: Map<string, number> = new Map();

    constructor(scene: Phaser.Scene) {
        this.scene = scene;
        this.initializeDefaultMappings();
        this.detectControlScheme();
        this.setupKeyboard();
        this.setupGamepad();
        this.setupFocusListener();
    }

    private initializeDefaultMappings(): void {
        // Keyboard defaults (can be changed later for settings)
        this.keyboardMap.set('moveLeft', Phaser.Input.Keyboard.KeyCodes.A);
        this.keyboardMap.set('moveRight', Phaser.Input.Keyboard.KeyCodes.D);
        this.keyboardMap.set('moveUp', Phaser.Input.Keyboard.KeyCodes.W);
        this.keyboardMap.set('moveDown', Phaser.Input.Keyboard.KeyCodes.S);
        this.keyboardMap.set('ability1', Phaser.Input.Keyboard.KeyCodes.SPACE);
        this.keyboardMap.set('ability2', Phaser.Input.Keyboard.KeyCodes.SHIFT);

        // Gamepad defaults (button indices)
        this.gamepadMap.set('ability1', 0);  // A button
        this.gamepadMap.set('ability2', 1);  // B button
    }

    // Allow remapping keys (for future settings menu)
    remapKey(action: string, keyCode: number): void {
        this.keyboardMap.set(action, keyCode);
        this.setupKeyboard();  // Re-setup with new mappings
    }

    remapGamepadButton(action: string, buttonIndex: number): void {
        this.gamepadMap.set(action, buttonIndex);
    }

    private detectControlScheme(): void {
        if (this.scene.input.gamepad && this.scene.input.gamepad.total > 0) {
            this.currentScheme = ControlScheme.GAMEPAD;
        } else if (this.scene.input.keyboard) {
            this.currentScheme = ControlScheme.KEYBOARD_MOUSE;
        } else {
            this.currentScheme = ControlScheme.TOUCH;
        }
    }

    private setupKeyboard(): void {
        if (!this.scene.input.keyboard) {
            this.setupRetryCount++;

            if (this.setupRetryCount <= this.maxRetries) {
                console.warn(`ButtonMapper: Keyboard input not available, retrying... (attempt ${this.setupRetryCount}/${this.maxRetries})`);
                // Initialize with empty object to prevent undefined access
                this.keys = {};

                // Retry setup
                this.scene.time.delayedCall(100, () => {
                    this.setupKeyboard();
                });
            } else {
                console.error('ButtonMapper: Keyboard initialization failed after max retries. Using empty input.');
            }
            return;
        }

        // Register each key individually (addKeys was causing all keys to share same object)
        this.keys = {
            moveLeft: this.scene.input.keyboard.addKey(this.keyboardMap.get('moveLeft')!),
            moveRight: this.scene.input.keyboard.addKey(this.keyboardMap.get('moveRight')!),
            moveUp: this.scene.input.keyboard.addKey(this.keyboardMap.get('moveUp')!),
            moveDown: this.scene.input.keyboard.addKey(this.keyboardMap.get('moveDown')!),
            ability1: this.scene.input.keyboard.addKey(this.keyboardMap.get('ability1')!),
            ability2: this.scene.input.keyboard.addKey(this.keyboardMap.get('ability2')!)
        };

        this.keyboardInitialized = true;
        this.setupRetryCount = 0;  // Reset counter on success

        console.log('ButtonMapper: Keyboard input initialized successfully');
        console.log('ButtonMapper: Individual keys registered:', {
            moveLeft: this.keys.moveLeft.keyCode,
            moveRight: this.keys.moveRight.keyCode,
            moveUp: this.keys.moveUp.keyCode,
            moveDown: this.keys.moveDown.keyCode,
            ability1: this.keys.ability1.keyCode,
            ability2: this.keys.ability2.keyCode
        });
    }

    private setupFocusListener(): void {
        // Reinitialize keyboard when window gains focus (fixes tab-in issue)
        window.addEventListener('focus', () => {
            if (!this.keyboardInitialized && this.scene.input.keyboard) {
                console.log('ButtonMapper: Window gained focus, reinitializing keyboard...');
                this.setupRetryCount = 0;  // Reset retry counter
                this.setupKeyboard();
            }
        });
    }

    private setupGamepad(): void {
        this.scene.input.gamepad?.on('connected', (pad: Phaser.Input.Gamepad.Gamepad) => {
            this.gamepad = pad;
            this.currentScheme = ControlScheme.GAMEPAD;
        });
    }

    getInput(): AbstractInputState {
        switch (this.currentScheme) {
            case ControlScheme.KEYBOARD_MOUSE:
                return this.getKeyboardMouseInput();
            case ControlScheme.GAMEPAD:
                return this.getGamepadInput();
            case ControlScheme.TOUCH:
                return this.getTouchInput();
        }
    }

    private getKeyboardMouseInput(): AbstractInputState {
        const movement = new Phaser.Math.Vector2(0, 0);

        // Read from mapped keys (with safety check)
        if (this.keys) {
            if (this.keys.moveLeft?.isDown) movement.x -= 1;
            if (this.keys.moveRight?.isDown) movement.x += 1;
            if (this.keys.moveUp?.isDown) movement.y -= 1;
            if (this.keys.moveDown?.isDown) movement.y += 1;
        }

        movement.normalize();

        const worldPoints = this.scene.cameras.main.getWorldPoint(this.scene.input.mousePointer.x, this.scene.input.mousePointer.y);
        const aim = new Phaser.Math.Vector2(worldPoints);

        return {
            movement,
            aim,
            ability1: this.keys?.ability1?.isDown || false,
            ability2: this.keys?.ability2?.isDown || false
        };
    }

    private getGamepadInput(): AbstractInputState {
        if (!this.gamepad) return this.getNullInput();

        const leftStick = this.gamepad.leftStick;
        const movement = new Phaser.Math.Vector2(leftStick.x, leftStick.y);

        const rightStick = this.gamepad.rightStick;
        const centerX = this.scene.scale.width / 2;
        const centerY = this.scene.scale.height / 2;
        const aim = new Phaser.Math.Vector2(
            centerX + rightStick.x * 200,
            centerY + rightStick.y * 200
        );

        // Read from mapped buttons
        const ability1ButtonIndex = this.gamepadMap.get('ability1') || 0;
        const ability2ButtonIndex = this.gamepadMap.get('ability2') || 1;

        return {
            movement,
            aim,
            ability1: this.gamepad.buttons[ability1ButtonIndex]?.pressed || false,
            ability2: this.gamepad.buttons[ability2ButtonIndex]?.pressed || false
        };
    }

    private getTouchInput(): AbstractInputState {
        // Stub for future implementation
        return this.getNullInput();
    }

    private getNullInput(): AbstractInputState {
        return {
            movement: new Phaser.Math.Vector2(0, 0),
            aim: new Phaser.Math.Vector2(0, 0),
            ability1: false,
            ability2: false
        };
    }

    getCurrentScheme(): ControlScheme {
        return this.currentScheme;
    }
}
