import type { Lobby } from '../scenes/Lobby';
import { Team } from '../types/Team';
import NetworkManager from '../../managers/NetworkManager';
import DOMElement = Phaser.GameObjects.DOMElement;

interface UIElements {
    title?: Phaser.GameObjects.Text;
    roomCodeContainer?: Phaser.GameObjects.Container;
    roomCodeLabel?: Phaser.GameObjects.Text;
    roomCodeText?: Phaser.GameObjects.Text;
    roomCodeInput?: DOMElement;
    playerListContainer?: Phaser.GameObjects.Container;
    redTeamContainer?: Phaser.GameObjects.Container;
    blueTeamContainer?: Phaser.GameObjects.Container;
    redTeamTitle?: Phaser.GameObjects.Text;
    blueTeamTitle?: Phaser.GameObjects.Text;
    redTeamBackground?: Phaser.GameObjects.Rectangle;
    blueTeamBackground?: Phaser.GameObjects.Rectangle;
    statusText?: Phaser.GameObjects.Text;
    startButton?: Phaser.GameObjects.Text;
    backButton?: Phaser.GameObjects.Text;
}

// UI helper class for lobby interface
export class LobbyUI {
    private lobbyScene: Lobby;
    private elements: UIElements = {};
    public lobbyCodeRegex = /^[A-Z1-9]{6}$/;  // PlaySocketJS generates 6-character codes (A-Z, 1-9)
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

        // Player list container (holds both team containers)
        this.elements.playerListContainer = this.lobbyScene.add.container(centerX, 250);

        // Red Team Container (left side)
        const teamSpacing = 250;
        this.elements.redTeamContainer = this.lobbyScene.add.container(-teamSpacing, 0);

        this.elements.redTeamBackground = this.lobbyScene.add.rectangle(0, 100, 200, 300, 0x330000, 0.5)
            .setInteractive({ useHandCursor: true })
            .on('pointerdown', () => {
                const stats = NetworkManager.getStats();
                if (stats.playerId) {
                    this.lobbyScene.switchPlayerTeam(stats.playerId, Team.Red);
                }
            })
            .on('pointerover', () => {
                this.elements.redTeamBackground?.setFillStyle(0x550000, 0.7);
            })
            .on('pointerout', () => {
                this.elements.redTeamBackground?.setFillStyle(0x330000, 0.5);
            });

        this.elements.redTeamTitle = this.lobbyScene.add.text(0, 0, 'RED TEAM', {
            fontFamily: 'Arial Black',
            fontSize: 24,
            color: '#ff0000',
            stroke: '#000000',
            strokeThickness: 6
        }).setOrigin(0.5);

        this.elements.redTeamContainer.add([this.elements.redTeamBackground, this.elements.redTeamTitle]);

        // Blue Team Container (right side)
        this.elements.blueTeamContainer = this.lobbyScene.add.container(teamSpacing, 0);

        this.elements.blueTeamBackground = this.lobbyScene.add.rectangle(0, 100, 200, 300, 0x000033, 0.5)
            .setInteractive({ useHandCursor: true })
            .on('pointerdown', () => {
                const stats = NetworkManager.getStats();
                if (stats.playerId) {
                    this.lobbyScene.switchPlayerTeam(stats.playerId, Team.Blue);
                }
            })
            .on('pointerover', () => {
                this.elements.blueTeamBackground?.setFillStyle(0x000055, 0.7);
            })
            .on('pointerout', () => {
                this.elements.blueTeamBackground?.setFillStyle(0x000033, 0.5);
            });

        this.elements.blueTeamTitle = this.lobbyScene.add.text(0, 0, 'BLUE TEAM', {
            fontFamily: 'Arial Black',
            fontSize: 24,
            color: '#0000ff',
            stroke: '#000000',
            strokeThickness: 6
        }).setOrigin(0.5);

        this.elements.blueTeamContainer.add([this.elements.blueTeamBackground, this.elements.blueTeamTitle]);

        // Add both team containers to the main player list container
        this.elements.playerListContainer.add([this.elements.redTeamContainer, this.elements.blueTeamContainer]);

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
            'Select Characters with this lobby',
            () => this.lobbyScene.selectCharacters()
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

    // Update player list with team assignments
    updatePlayerList(players: string[], teamAssignments: { [playerId: string]: Team }, isHost: boolean): void {
        // Clear existing player entries from both team containers (keep titles and backgrounds)
        const redChildren = this.elements.redTeamContainer!.list.slice();
        redChildren.forEach((child, index) => {
            if (index > 1) {  // Keep background (0) and title (1)
                child.destroy();
            }
        });

        const blueChildren = this.elements.blueTeamContainer!.list.slice();
        blueChildren.forEach((child, index) => {
            if (index > 1) {  // Keep background (0) and title (1)
                child.destroy();
            }
        });

        // Separate players by team
        const redPlayers: string[] = [];
        const bluePlayers: string[] = [];

        players.forEach(playerId => {
            const team = teamAssignments[playerId] || Team.Red;  // Default to Red if not assigned
            if (team === Team.Red) {
                redPlayers.push(playerId);
            } else if (team === Team.Blue) {
                bluePlayers.push(playerId);
            }
        });

        // Add red team players
        redPlayers.forEach((playerId, index) => {
            const yOffset = 40 + (index * 30);
            const playerText = this.lobbyScene.add.text(
                0,
                yOffset,
                `${playerId.slice(0, 8)}...`,
                {
                    fontFamily: 'Arial',
                    fontSize: 18,
                    color: '#ff8888',
                    stroke: '#000000',
                    strokeThickness: 3
                }
            ).setOrigin(0.5);

            this.elements.redTeamContainer!.add(playerText);
        });

        // Add blue team players
        bluePlayers.forEach((playerId, index) => {
            const yOffset = 40 + (index * 30);
            const playerText = this.lobbyScene.add.text(
                0,
                yOffset,
                `${playerId.slice(0, 8)}...`,
                {
                    fontFamily: 'Arial',
                    fontSize: 18,
                    color: '#8888ff',
                    stroke: '#000000',
                    strokeThickness: 3
                }
            ).setOrigin(0.5);

            this.elements.blueTeamContainer!.add(playerText);
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
