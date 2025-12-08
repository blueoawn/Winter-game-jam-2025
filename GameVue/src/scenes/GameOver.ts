import { Scene } from 'phaser';
import { audioManager } from '../../managers/AudioManager';

export class GameOver extends Scene
{
    constructor() {
        super('GameOver');
    }

    create() {
        const { width, height } = this.scale;

        audioManager.init(this);
        audioManager.play('game-over-music', { loop: true, volume: 0.5 });

        this.cameras.main.fadeIn(500, 0, 0, 0);

        this.add.rectangle(width / 2, height / 2, width, height, 0x000000, 0.7);

        this.add.text(width * 0.5, height * 0.5 - 80, 'Game Over', {
            fontFamily: 'Arial Black', fontSize: 64, color: '#ffffff',
            stroke: '#000000', strokeThickness: 8,
            align: 'center'
        }).setOrigin(0.5);

        const mainMenuBtn = this.add.text(width * 0.5, height * 0.5 + 40, 'Main Menu', {
            fontFamily: 'Arial Black',
            fontSize: 32,
            color: '#ffffff',
            stroke: '#000000',
            strokeThickness: 6,
            padding: { x: 20, y: 10 }
        })
        .setOrigin(0.5)
        .setInteractive({ useHandCursor: true });

        mainMenuBtn.on('pointerover', () => {
            mainMenuBtn.setTint(0xffff00);
            mainMenuBtn.setScale(1.1);
        });

        mainMenuBtn.on('pointerout', () => {
            mainMenuBtn.clearTint();
            mainMenuBtn.setScale(1.0);
        });

        mainMenuBtn.on('pointerdown', () => {
            this.scene.start('Start');
        });

        // For multiplayer, the player should have the option to leave or wait until another player is able to revive them
    }
}
