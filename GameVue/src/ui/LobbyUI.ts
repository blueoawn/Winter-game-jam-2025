import type { Lobby } from '../scenes/Lobby';

interface UIElements {
    title?: Phaser.GameObjects.Text;
    roomCodeContainer?: Phaser.GameObjects.Container;
    roomCodeLabel?: Phaser.GameObjects.Text;
    roomCodeText?: Phaser.GameObjects.Text;
    playerListContainer?: Phaser.GameObjects.Container;
    playerListTitle?: Phaser.GameObjects.Text;
    statusText?: Phaser.GameObjects.Text;
    startButton?: Phaser.GameObjects.Text;
    backButton?: Phaser.GameObjects.Text;
}

// UI helper class for lobby interface
export class LobbyUI {
    private scene: Lobby;
    private elements: UIElements = {};

    constructor(scene: Lobby) {
        this.scene = scene;
    }

    // Create lobby UI elements
    create(): UIElements {
        const { width, height } = this.scene.scale;
        const centerX = width * 0.5;
        const centerY = height * 0.5;

        // Title
        this.elements.title = this.scene.add.text(centerX, 50, 'Multiplayer Lobby', {
            fontFamily: 'Arial Black',
            fontSize: 48,
            color: '#ffffff',
            stroke: '#000000',
            strokeThickness: 8,
            align: 'center'
        }).setOrigin(0.5);

        // Room code display container
        this.elements.roomCodeContainer = this.scene.add.container(centerX, 150);

        this.elements.roomCodeLabel = this.scene.add.text(0, 0, 'Room Code:', {
            fontFamily: 'Arial Black',
            fontSize: 24,
            color: '#ffffff',
            stroke: '#000000',
            strokeThickness: 6
        }).setOrigin(0.5);

        this.elements.roomCodeText = this.scene.add.text(0, 40, '------', {
            fontFamily: 'Arial Black',
            fontSize: 36,
            color: '#00ff00',
            stroke: '#000000',
            strokeThickness: 8
        }).setOrigin(0.5);

        this.elements.roomCodeContainer.add([
            this.elements.roomCodeLabel,
            this.elements.roomCodeText
        ]);

        // Player list container
        this.elements.playerListContainer = this.scene.add.container(centerX, 250);

        this.elements.playerListTitle = this.scene.add.text(0, 0, 'Connected Players:', {
            fontFamily: 'Arial Black',
            fontSize: 24,
            color: '#ffffff',
            stroke: '#000000',
            strokeThickness: 6
        }).setOrigin(0.5);

        this.elements.playerListContainer.add(this.elements.playerListTitle);

        // Status message
        this.elements.statusText = this.scene.add.text(centerX, centerY + 100, '', {
            fontFamily: 'Arial',
            fontSize: 20,
            color: '#ffff00',
            stroke: '#000000',
            strokeThickness: 4,
            align: 'center'
        }).setOrigin(0.5);

        // Start button (host only, initially hidden)
        this.elements.startButton = this.createButton(
            centerX,
            height - 100,
            'Start Game',
            () => this.scene.onStartGame()
        );
        this.elements.startButton.setVisible(false);

        // Back button
        this.elements.backButton = this.createButton(
            centerX,
            height - 50,
            'Back to Menu',
            () => this.scene.onBackToMenu()
        );

        return this.elements;
    }

    // Create an interactive button
    createButton(x: number, y: number, text: string, onClick: () => void): Phaser.GameObjects.Text {
        const button = this.scene.add.text(x, y, text, {
            fontFamily: 'Arial Black',
            fontSize: 28,
            color: '#ffffff',
            stroke: '#000000',
            strokeThickness: 6,
            padding: { x: 20, y: 10 }
        })
        .setOrigin(0.5)
        .setInteractive({ useHandCursor: true });

        button.on('pointerover', () => {
            button.setColor('#ffff00');
        });

        button.on('pointerout', () => {
            button.setColor('#ffffff');
        });

        button.on('pointerdown', onClick);

        return button;
    }

    // Update room code display
    updateRoomCode(code: string): void {
        if (this.elements.roomCodeText) {
            this.elements.roomCodeText.setText(code);
        }
    }

    // Update player list
    updatePlayerList(players: string[], isHost: boolean): void {
        // Clear existing player list (except title)
        const children = this.elements.playerListContainer!.list.slice();
        children.forEach((child, index) => {
            if (index > 0) {  // Keep title (index 0)
                child.destroy();
            }
        });

        // Add player entries
        players.forEach((playerId, index) => {
            const yOffset = 40 + (index * 35);
            const playerText = this.scene.add.text(
                0,
                yOffset,
                `${index + 1}. Player ${playerId.slice(0, 8)}...`,
                {
                    fontFamily: 'Arial',
                    fontSize: 20,
                    color: '#00ff00',
                    stroke: '#000000',
                    strokeThickness: 4
                }
            ).setOrigin(0.5);

            this.elements.playerListContainer!.add(playerText);
        });

        // Show/hide start button based on host status and player count
        if (this.elements.startButton) {
            this.elements.startButton.setVisible(isHost && players.length >= 1);
        }
    }

    // Update status message
    updateStatus(message: string, color: string = '#ffff00'): void {
        if (this.elements.statusText) {
            this.elements.statusText.setText(message);
            this.elements.statusText.setColor(color);
        }
    }

    // Show error message
    showError(errorMessage: string): void {
        this.updateStatus(errorMessage, '#ff0000');
    }

    // Show connection dialog for joining
    showJoinDialog(onJoin: (roomCode: string) => void): void {
        const { width, height } = this.scene.scale;
        const centerX = width * 0.5;
        const centerY = height * 0.5;

        // TODO: Replace with proper UI input instead of prompt EXAMPLE USING PHASER DOM https://phaser.discourse.group/t/text-input/3141 see post by retroVX
        const roomCodeInput = prompt('Enter Room Code:');

        if (roomCodeInput && roomCodeInput.trim()) {
            onJoin(roomCodeInput.trim().toUpperCase());
        }
    }

    // Destroy all UI elements
    destroy(): void {
        Object.values(this.elements).forEach(element => {
            if (element && element.destroy) {
                element.destroy();
            }
        });
        this.elements = {};
    }
}
