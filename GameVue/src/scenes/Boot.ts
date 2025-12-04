import { Scene } from 'phaser';

export class Boot extends Scene
{
    constructor ()
    {
        super('Boot');
    }

    preload ()
    {
        this.load.image('phaser-logo', 'assets/Sprites/phaser3-logo.png');
    }

    create ()
    {
        const { width, height } = this.scale;

        this.add.image(width / 2, height / 2 - 50, 'phaser-logo').setScale(0.5);

        this.add.text(width / 2, height / 2 + 50, 'Made with Phaser', {
            fontFamily: 'Arial',
            fontSize: 24,
            color: '#ffffff'
        }).setOrigin(0.5);

        // this.time.delayedCall(1500, () => {
            this.scene.start('Preloader');
        // });
    }
}
