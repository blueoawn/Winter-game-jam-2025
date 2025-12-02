import type { Lobby } from '../scenes/Lobby';
import DOMElement = Phaser.GameObjects.DOMElement;

interface UIElements {
    title?: Phaser.GameObjects.Text;
    roomCodeContainer?: Phaser.GameObjects.Container;
    roomCodeLabel?: Phaser.GameObjects.Text;
    roomCodeText?: Phaser.GameObjects.Text;
    roomCodeInput?: DOMElement;
    playerListContainer?: Phaser.GameObjects.Container;
    playerListTitle?: Phaser.GameObjects.Text;
    statusText?: Phaser.GameObjects.Text;
    startButton?: Phaser.GameObjects.Text;
    backButton?: Phaser.GameObjects.Text;
}

// UI helper class for lobby interface
export class LobbyUI {
    private lobbyScene: Lobby;
    private elements: UIElements = {};
    public lobbyCodeRegex = /[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}/;
    constructor(scene: Lobby) {
        this.lobbyScene = scene;
    }

    // Create lobby UI elements
    create(): UIElements {
        const { width, height } = this.lobbyScene.scale;
        const centerX = width * 0.5;
        const centerY = height * 0.5;

        // Title
        this.elements.title = this.lobbyScene.add.text(centerX, 50, 'Multiplayer Lobby', {
            fontFamily: 'Arial Black',
            fontSize: 48,
            color: '#ffffff',
            stroke: '#000000',
            strokeThickness: 8,
            align: 'center'
        }).setOrigin(0.5);

        // Room code display container
        this.elements.roomCodeContainer = this.lobbyScene.add.container(centerX, 150);

        this.elements.roomCodeLabel = this.lobbyScene.add.text(0, 0, 'Enter Room Code:', {
            fontFamily: 'Arial Black',
            fontSize: 24,
            color: '#ffffff',
            stroke: '#000000',
            strokeThickness: 6
        }).setOrigin(0.5);

        this.elements.roomCodeInput = this.lobbyScene.add.dom(centerX, 190, 'input', `
            outline: none;
            font-size: 24,
        `).setInteractive({useHandCursor: true})
            .addListener('input').on('input', async (event) => {
            if (event) {
                if (this.elements.roomCodeInput) {
                    this.elements.roomCodeInput.pointerEvents = 'none';
                }

                if (this.lobbyCodeRegex.test(event.target.value.trim())) {
                    // Don't change case - PeerJS IDs are case-sensitive!
                    await this.lobbyScene.connectToHost(event.target.value.trim());
                }
                if (this.elements.roomCodeInput) {
                    this.elements.roomCodeInput.pointerEvents = 'auto';
                }
            }
        })

        this.elements.roomCodeText = this.lobbyScene.add.text(0, 40, '------', {
            fontFamily: 'Arial Black',
            fontSize: 36,
            color: '#00ff00',
            stroke: '#000000',
            strokeThickness: 8
        }).setOrigin(0.5)
            .on('pointerover', (event) => {
                this.elements.roomCodeText?.setColor('rgba(0, 255, 0, 0.8)');
            })
            .on('pointerout', (event) => {
                this.elements.roomCodeText?.setColor('rgba(0, 255, 0, 1)');
            })
            .on('pointerdown', (event) => {
                if (this.elements.roomCodeText) {
                    navigator.clipboard.writeText(this.elements.roomCodeText.text.trim());
                }
                this.elements.roomCodeText?.setScale(0.95);
                setTimeout(() => {
                    this.elements.roomCodeText?.setScale(1);
                }, 100)
            })

        this.elements.roomCodeContainer.add([
            this.elements.roomCodeLabel,
            this.elements.roomCodeText
        ]);

        // Player list container
        this.elements.playerListContainer = this.lobbyScene.add.container(centerX, 250);

        this.elements.playerListTitle = this.lobbyScene.add.text(0, 0, 'Connected Players:', {
            fontFamily: 'Arial Black',
            fontSize: 24,
            color: '#ffffff',
            stroke: '#000000',
            strokeThickness: 6
        }).setOrigin(0.5);

        this.elements.playerListContainer.add(this.elements.playerListTitle);

        // Status message
        this.elements.statusText = this.lobbyScene.add.text(centerX, centerY + 100, '', {
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
            () => this.lobbyScene.onStartGame()
        );
        this.elements.startButton.setVisible(false);

        // Back button
        this.elements.backButton = this.createButton(
            centerX,
            height - 50,
            'Back to Menu',
            () => this.lobbyScene.onBackToMenu()
        );

        return this.elements;
    }

    // Create an interactive button
    createButton(x: number, y: number, text: string, onClick: () => void): Phaser.GameObjects.Text {
        const button = this.lobbyScene.add.text(x, y, text, {
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
            const playerText = this.lobbyScene.add.text(
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
        const { width, height } = this.lobbyScene.scale;
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

    changeMode(mode: 'host' | 'join'): void {
        switch (mode) {
            case "host":
                if (this.elements.roomCodeInput) {
                    this.elements.roomCodeInput.visible = false;
                }

                if (this.elements.roomCodeLabel) {
                    this.elements.roomCodeLabel.text = 'Room Code (Click to copy) :'
                }

                if (this.elements.roomCodeText) {
                    this.elements.roomCodeText.setInteractive({ useHandCursor: true });
                }
                break;
            case "join":
                if (this.elements.roomCodeInput) {
                    this.elements.roomCodeInput.visible = true;
                }

                if (this.elements.roomCodeLabel) {
                    this.elements.roomCodeLabel.text = 'Enter Room Code:'
                }

                if (this.elements.roomCodeText) {
                    this.elements.roomCodeText.disableInteractive(true);
                }
                break;
        }
    }
}
