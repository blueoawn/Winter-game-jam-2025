import { Scene } from 'phaser';
import Image = Phaser.GameObjects.Image;

export class GameOver extends Scene
{
    background1: Image

    constructor() {
        super('GameOver');
    }


    create() {
        this.background1 = this.add.image(0, 0, 'background').setOrigin(0);

        this.add.text(this.scale.width * 0.5, this.scale.height * 0.5, 'Game Over', {
            fontFamily: 'Arial Black', fontSize: 64, color: '#ffffff',
            stroke: '#000000', strokeThickness: 8,
            align: 'center'
        }).setOrigin(0.5);
        
        //TODO add button to go back to main menu in solo

        // For multiplayer, the player should have the option to leave or wait until another player is able to revive them
    }
}
