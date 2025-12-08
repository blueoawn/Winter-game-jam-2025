import { audioManager } from '../../managers/AudioManager';
import ASSETS from '../assets';

export class Start extends Phaser.Scene {
    private buttons: Phaser.GameObjects.Text[] = [];
    private selectedButtonIndex = 0;
    private gamepad: Phaser.Input.Gamepad.Gamepad | null = null;
    private lastPadInput = 0;
    private padInputDelay = 200;

    constructor() {
        super('Start');
    }

    create() {
        const { width, height } = this.scale;
        const centerX = width * 0.5;
        const centerY = height * 0.5;

        audioManager.init(this);

        // Play character select music on loop
        audioManager.playMusic(ASSETS.audio.characterSelect.key, { loop: true, volume: 0.5 });

        // Add background image
        const background = this.add.image(centerX, centerY, ASSETS.image.mainMenuArt.key);

        // Scale background to cover the screen while maintaining aspect ratio
        const scaleX = width / background.width;
        const scaleY = height / background.height;
        const scale = Math.max(scaleX, scaleY);
        background.setScale(scale);
        background.setAlpha(0.4)
        background.setDepth(-1); // Put background behind everything

        this.add.text(centerX, 100, 'Half-dozen Heroz', {
            fontFamily: 'Arial Black',
            fontSize: 48,
            color: '#ffffff',
            stroke: '#000000',
            strokeThickness: 8,
            align: 'center'
        }).setOrigin(0.5);

        this.add.text(centerX, 180, 'Team Grem', {
            fontFamily: 'Arial',
            fontSize: 24,
            color: '#aaaaaa',
            stroke: '#000000',
            strokeThickness: 4,
            align: 'center'
        }).setOrigin(0.5);

        this.buttons = [];

        // this.buttons.push(this.createButton(
        //     centerX,
        //     centerY - 60,
        //     'Solo Play',
        //     () => this.startSoloGame()
        // ));

        this.buttons.push(this.createButton(
            centerX,
            centerY + 60,
            'Slime Invasion',
            () => this.startSlimeInvasion()
        ));

        // this.buttons.push(this.createButton(
        //     centerX,
        //     centerY + 20,
        //     'Host Game',
        //     () => this.hostMultiplayerGame()
        // ));
        //
        // this.buttons.push(this.createButton(
        //     centerX,
        //     centerY + 100,
        //     'Join Game',
        //     () => this.joinMultiplayerGame()
        // ));

        this.createVolumeSlider(centerX, height - 120);

        // Hidden unlock all characters button (bottom-left corner)
        const unlockAllButton = this.add.text(20, height - 20, 'Unlock All', {
            fontFamily: 'Arial',
            fontSize: 12,
            color: '#808080',
            backgroundColor: '#191919',
            padding: { x: 5, y: 2 }
        })
        .setOrigin(0, 1)
        .setAlpha(0.3)
        .setInteractive({ useHandCursor: true });

        unlockAllButton.on('pointerover', () => {
            unlockAllButton.setAlpha(0.8);
            unlockAllButton.setColor('#ffff00');
        });

        unlockAllButton.on('pointerout', () => {
            unlockAllButton.setAlpha(0.3);
            unlockAllButton.setColor('#333333');
        });

        unlockAllButton.on('pointerdown', () => {
            // Unlock all characters in localStorage
            const allCharacterIds = [
                'lizard-wizard',
                'sword-and-board',
                'railgun',
                'big-sword',
                'boomstick',
                'cheese-touch'
            ];
            localStorage.setItem('unlockedCharacters', JSON.stringify(allCharacterIds));

            // Visual feedback
            unlockAllButton.setColor('#00ff00');
            unlockAllButton.setText('✓ Unlocked!');

            this.time.delayedCall(1000, () => {
                unlockAllButton.setText('Unlock All');
                unlockAllButton.setColor('#333333');
            });
        });

        this.add.text(centerX, height - 50, 'Mouse and Keyboard', {
            fontFamily: 'Arial',
            fontSize: 18,
            color: '#666666',
            align: 'center'
        }).setOrigin(0.5);

        this.setupGamepadSupport();
        this.updateButtonSelection();
    }

    update(time: number) {
        this.handleGamepadInput(time);
    }

    createButton(x: number, y: number, text: string, onClick: () => void): Phaser.GameObjects.Text {
        const button = this.add.text(x, y, text, {
            fontFamily: 'Arial Black',
            fontSize: 32,
            color: '#ffffff',
            stroke: '#000000',
            strokeThickness: 6,
            padding: { x: 20, y: 10 }
        })
        .setOrigin(0.5)
        .setInteractive({ useHandCursor: true });

        button.on('pointerover', () => {
            this.selectedButtonIndex = this.buttons.indexOf(button);
            this.updateButtonSelection();
        });

        button.on('pointerout', () => {
            button.clearTint();
            button.setScale(1.0);
        });

        button.on('pointerdown', onClick);

        (button as any).onClick = onClick;

        return button;
    }

    createVolumeSlider(x: number, y: number): void {
        const sliderWidth = 200;
        const sliderHeight = 10;
        const minX = x - sliderWidth / 2;
        const maxX = x + sliderWidth / 2;

        const soundIcon = this.add.text(minX - 60, y, '🔊', {
            fontSize: 24
        }).setOrigin(0.5).setInteractive({ useHandCursor: true });

        soundIcon.on('pointerdown', () => {
            const muted = audioManager.toggleMute();
            soundIcon.setText(muted ? '🔇' : '🔊');
        });

        const sliderBg = this.add.rectangle(x, y, sliderWidth, sliderHeight, 0x444444)
            .setInteractive({ useHandCursor: true });

        const initialVolume = audioManager.getVolume();
        const sliderFill = this.add.rectangle(
            minX,
            y,
            sliderWidth * initialVolume,
            sliderHeight,
            0x00ff00
        ).setOrigin(0, 0.5);

        const sliderHandle = this.add.circle(
            minX + sliderWidth * initialVolume,
            y,
            12,
            0xffffff
        ).setInteractive({ useHandCursor: true });

        this.input.setDraggable(sliderHandle);

        sliderHandle.on('pointerover', () => {
            sliderHandle.setScale(1.2);
            sliderHandle.setFillStyle(0xffff00);
        });

        sliderHandle.on('pointerout', () => {
            sliderHandle.setScale(1.0);
            sliderHandle.setFillStyle(0xffffff);
        });

        const updateSlider = (posX: number) => {
            const clampedX = Phaser.Math.Clamp(posX, minX, maxX);
            sliderHandle.x = clampedX;
            const volume = (clampedX - minX) / sliderWidth;
            audioManager.setVolume(volume);
            sliderFill.width = sliderWidth * volume;
        };

        sliderHandle.on('drag', (_pointer: Phaser.Input.Pointer, dragX: number) => {
            updateSlider(dragX);
        });

        sliderBg.on('pointerdown', (pointer: Phaser.Input.Pointer) => {
            updateSlider(pointer.x);
        });
    }

    setupGamepadSupport(): void {
        if (this.input.gamepad) {
            this.input.gamepad.once('connected', (pad: Phaser.Input.Gamepad.Gamepad) => {
                this.gamepad = pad;
            });

            if (this.input.gamepad.total > 0) {
                this.gamepad = this.input.gamepad.pad1;
            }
        }

        this.input.keyboard?.on('keydown-UP', () => this.navigateUp());
        this.input.keyboard?.on('keydown-DOWN', () => this.navigateDown());
        this.input.keyboard?.on('keydown-ENTER', () => this.activateSelected());
        this.input.keyboard?.on('keydown-SPACE', () => this.activateSelected());
    }

    handleGamepadInput(time: number): void {
        if (!this.gamepad || time - this.lastPadInput < this.padInputDelay) return;

        const leftStickY = this.gamepad.axes[1]?.getValue() || 0;
        const dpadUp = this.gamepad.buttons[12]?.pressed;
        const dpadDown = this.gamepad.buttons[13]?.pressed;
        const aButton = this.gamepad.buttons[0]?.pressed;

        if (leftStickY < -0.5 || dpadUp) {
            this.navigateUp();
            this.lastPadInput = time;
        } else if (leftStickY > 0.5 || dpadDown) {
            this.navigateDown();
            this.lastPadInput = time;
        }

        if (aButton) {
            this.activateSelected();
            this.lastPadInput = time;
        }
    }

    navigateUp(): void {
        this.selectedButtonIndex = (this.selectedButtonIndex - 1 + this.buttons.length) % this.buttons.length;
        this.updateButtonSelection();
    }

    navigateDown(): void {
        this.selectedButtonIndex = (this.selectedButtonIndex + 1) % this.buttons.length;
        this.updateButtonSelection();
    }

    activateSelected(): void {
        const button = this.buttons[this.selectedButtonIndex];
        if (button && (button as any).onClick) {
            (button as any).onClick();
        }
    }

    updateButtonSelection(): void {
        this.buttons.forEach((btn, index) => {
            if (index === this.selectedButtonIndex) {
                btn.setTint(0xffff00);
                btn.setScale(1.1);
            } else {
                btn.clearTint();
                btn.setScale(1.0);
            }
        });
    }

    startSoloGame() {
        this.scene.start('CharacterSelectScene', {
            networkEnabled: false,
            isHost: false,
            players: [],
            mapId: 'summoners-rift'
        });
    }

    startSlimeInvasion() {
        this.scene.start('CharacterSelectScene', {
            networkEnabled: false,
            isHost: false,
            players: [],
            mapId: 'slime-invasion'
        });
    }

    hostMultiplayerGame() {
        this.scene.start('Lobby', { mode: 'host' });
    }

    joinMultiplayerGame() {
        this.scene.start('Lobby', { mode: 'join' });
    }

}
