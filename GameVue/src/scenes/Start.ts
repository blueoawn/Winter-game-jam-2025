export class Start extends Phaser.Scene {

    constructor() {
        super('Start');
    }
        create() {
        const { width, height } = this.scale;
        const centerX = width * 0.5;
        const centerY = height * 0.5;

        // Title
        this.add.text(centerX, 100, 'Half-dozen Heros', {
            fontFamily: 'Arial Black',
            fontSize: 48,
            color: '#ffffff',
            stroke: '#000000',
            strokeThickness: 8,
            align: 'center'
        }).setOrigin(0.5);

        // Subtitle
        this.add.text(centerX, 180, 'Team Grem', {
            fontFamily: 'Arial',
            fontSize: 24,
            color: '#aaaaaa',
            stroke: '#000000',
            strokeThickness: 4,
            align: 'center'
        }).setOrigin(0.5);

        // Solo Play button
        this.createButton(
            centerX,
            centerY - 60,
            'Solo Play',
            () => this.startSoloGame()
        );

        // Host Game button
        this.createButton(
            centerX,
            centerY + 20,
            'Host Game',
            () => this.hostMultiplayerGame()
        );

        // Join Game button
        this.createButton(
            centerX,
            centerY + 100,
            'Join Game',
            () => this.joinMultiplayerGame()
        );

        // Input label - change this in the future to automatically detect input type instead of hardcoding
        this.add.text(centerX, height - 50, 'Mouse 🖱️ Keyboard ⌨️', {
            fontFamily: 'Arial',
            fontSize: 18,
            color: '#666666',
            align: 'center'
        }).setOrigin(0.5);
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
            button.setTint(0xffff00);
            button.setScale(1.1);
        });

        button.on('pointerout', () => {
            button.clearTint();
            button.setScale(1.0);
        });

        button.on('pointerdown', onClick);

        return button;
    }

    startSoloGame() {
        // Start game without networking
        this.scene.start('GameScene', {
            networkEnabled: false,
            isHost: false,
            players: []
        });
    }

    hostMultiplayerGame() {
        this.scene.start('Lobby', { mode: 'host' });
    }

    joinMultiplayerGame() {
        this.scene.start('Lobby', { mode: 'join' });
    }

}
