import { Scene } from 'phaser';
import ASSETS from '../assets';
import NetworkManager from '../../network/NetworkManager';

interface CharacterData {
    id: string;
    name: string;
    frame: number;
    description: string;
    stats: {
        speed: string;
        health: string;
        fireRate: string;
    };
    ability1: string;
    ability2: string;
}

interface CharacterSelection {
    characterId: string;
    ready: boolean;
    timestamp: number;
}

// TODO There's several improvements to be made here, such as better UI/UX, gamepad support, etc.

// The UI could display character stats as bars and abilities with icons

// With 6 characters planned, the layout will need adjustment. I'm thinking a carousel would be nice with big cards showing details, but a grid could also work especially if we want to show all options at once.
// Should some characters be locked initially and require unlocking?

export class CharacterSelectScene extends Scene {
    private characters: CharacterData[] = [
        {
            id: 'lizard-wizard',
            name: 'Lizard Wizard',
            frame: 0,
            description: 'Fast and deadly, but fragile',
            stats: {
                speed: 'Very Fast',
                health: 'Low',
                fireRate: 'Fast'
            },
            ability1: 'Rapid Fire',
            ability2: 'Spread Shot (3 projectiles)'
        },
        {
            id: 'sword-and-board',
            name: 'Sword & Board',
            frame: 1,
            description: 'Tanky and defensive',
            stats: {
                speed: 'Slow',
                health: 'High',
                fireRate: 'Slow'
            },
            ability1: 'Melee Attack',
            ability2: 'Shield (blocks damage)'
        }
    ];

    private selectedCharacterId: string | null = null;
    private networkEnabled: boolean = false;
    private isHost: boolean = false;
    private players: string[] = [];
    private characterSelections: Map<string, CharacterSelection> = new Map();

    private titleText!: Phaser.GameObjects.Text;
    private characterCards: Map<string, Phaser.GameObjects.Container> = new Map();
    private startButton!: Phaser.GameObjects.Text;
    private startButtonBg!: Phaser.GameObjects.Rectangle;
    private playerStatusText!: Phaser.GameObjects.Text;

    constructor() {
        super('CharacterSelectScene');
    }

    init(data: any): void {
        // Receive data from Lobby scene
        this.networkEnabled = data?.networkEnabled || false;
        this.isHost = data?.isHost || false;
        this.players = data?.players || [];

        console.log('CharacterSelect initialized:', {
            networkEnabled: this.networkEnabled,
            isHost: this.isHost,
            players: this.players
        });
    }

    create(): void {
        const centerX = this.scale.width / 2;
        const centerY = this.scale.height / 2;

        // Title
        this.titleText = this.add.text(centerX, 80, 'SELECT YOUR CHARACTER', {
            fontFamily: 'Arial Black',
            fontSize: '48px',
            color: '#ffffff',
            stroke: '#000000',
            strokeThickness: 8,
            align: 'center'
        }).setOrigin(0.5);

        // Player status text (shows who is ready in multiplayer)
        if (this.networkEnabled && this.players.length > 1) {
            this.playerStatusText = this.add.text(centerX, 140, '', {
                fontFamily: 'Arial',
                fontSize: '20px',
                color: '#ffff00',
                align: 'center'
            }).setOrigin(0.5);
        }

        // Create character selection cards
        this.createCharacterCards(centerX, centerY);

        // Create start button (initially disabled)
        this.createStartButton(centerX, this.scale.height - 80);

        // Update player status after UI is created
        if (this.networkEnabled && this.players.length > 1) {
            this.updatePlayerStatus();
        }

        // Instructions
        const instructionText = this.networkEnabled && this.players.length > 1
            ? 'Click a character to select - Waiting for all players...'
            : 'Click a character to select';
        this.add.text(centerX, this.scale.height - 30, instructionText, {
            fontFamily: 'Arial',
            fontSize: '20px',
            color: '#cccccc',
            align: 'center'
        }).setOrigin(0.5);

        // Setup network storage handlers if multiplayer
        if (this.networkEnabled) {
            this.setupStorageHandlers();

            // Initialize storage with character selections object if host
            if (this.isHost) {
                const storage = NetworkManager.getStorage();
                if (storage && !storage.characterSelections) {
                    const socket = (NetworkManager as any).socket;
                    if (socket) {
                        socket.updateStorage('characterSelections', 'set', {});
                        socket.updateStorage('allPlayersReady', 'set', false);
                    }
                }
            }
        }
    }

    private createCharacterCards(centerX: number, centerY: number): void {
        const cardWidth = 350;
        const cardSpacing = 50;
        const totalWidth = (cardWidth * this.characters.length) + (cardSpacing * (this.characters.length - 1));
        const startX = centerX - (totalWidth / 2) + (cardWidth / 2);

        this.characters.forEach((character, index) => {
            const x = startX + (index * (cardWidth + cardSpacing));
            const card = this.createCharacterCard(character, x, centerY);
            this.characterCards.set(character.id, card);
        });
    }

    private createCharacterCard(character: CharacterData, x: number, y: number): Phaser.GameObjects.Container {
        const container = this.add.container(x, y);
        const cardWidth = 300;
        const cardHeight = 450;

        // Card background
        const bg = this.add.rectangle(0, 0, cardWidth, cardHeight, 0x222222, 0.9);
        bg.setStrokeStyle(4, 0x666666);
        container.add(bg);

        // Character sprite (large)
        const sprite = this.add.sprite(0, -120, ASSETS.spritesheet.ships.key, character.frame);
        sprite.setScale(4);
        container.add(sprite);

        // Character name
        const nameText = this.add.text(0, -30, character.name, {
            fontFamily: 'Arial Black',
            fontSize: '28px',
            color: '#ffffff',
            stroke: '#000000',
            strokeThickness: 6,
            align: 'center'
        }).setOrigin(0.5);
        container.add(nameText);

        // Description
        const descText = this.add.text(0, 10, character.description, {
            fontFamily: 'Arial',
            fontSize: '18px',
            color: '#aaaaaa',
            align: 'center'
        }).setOrigin(0.5);
        container.add(descText);

        // Layout Stats and Abilities side by side
        const leftX = -120;  // Left column X position
        const rightX = 30;  // Right column X position
        let yOffset = 50;

        // Stats (Left column)
        const statsTitle = this.add.text(leftX, yOffset, 'Stats:', {
            fontFamily: 'Arial Black',
            fontSize: '20px',
            color: '#ffff00',
            align: 'left'
        }).setOrigin(0, 0.5);
        container.add(statsTitle);

        let statsY = yOffset + 30;
        Object.entries(character.stats).forEach(([key, value]) => {
            const statText = this.add.text(leftX, statsY, `${this.capitalize(key)}: ${value}`, {
                fontFamily: 'Arial',
                fontSize: '14px',
                color: '#ffffff',
                align: 'left'
            }).setOrigin(0, 0.5);
            container.add(statText);
            statsY += 25;
        });

        // Abilities (Right column)
        const abilitiesTitle = this.add.text(rightX, yOffset, 'Abilities:', {
            fontFamily: 'Arial Black',
            fontSize: '20px',
            color: '#00ffff',
            align: 'left'
        }).setOrigin(0, 0.5);
        container.add(abilitiesTitle);

        let abilitiesY = yOffset + 30;
        const ability1Text = this.add.text(rightX, abilitiesY, `1: ${character.ability1}`, {
            fontFamily: 'Arial',
            fontSize: '14px',
            color: '#ffffff',
            align: 'left',
            wordWrap: { width: 120 }
        }).setOrigin(0, 0.5);
        container.add(ability1Text);
        abilitiesY += 40;

        const ability2Text = this.add.text(rightX, abilitiesY, `2: ${character.ability2}`, {
            fontFamily: 'Arial',
            fontSize: '14px',
            color: '#ffffff',
            align: 'left',
            wordWrap: { width: 120 }
        }).setOrigin(0, 0.5);
        container.add(ability2Text);

        // Make card interactive
        bg.setInteractive({ useHandCursor: true });
        bg.on('pointerdown', () => this.selectCharacter(character.id));
        bg.on('pointerover', () => {
            if (this.selectedCharacterId !== character.id) {
                bg.setStrokeStyle(4, 0xffffff);
            }
        });
        bg.on('pointerout', () => {
            if (this.selectedCharacterId !== character.id) {
                bg.setStrokeStyle(4, 0x666666);
            }
        });

        // Store reference to bg for selection highlighting
        container.setData('bg', bg);
        container.setData('characterId', character.id);

        return container;
    }

    //TODO Make character cards selectable with gamepad

    private selectCharacter(characterId: string): void {
        // Deselect previous character
        if (this.selectedCharacterId) {
            const prevCard = this.characterCards.get(this.selectedCharacterId);
            if (prevCard) {
                const bg = prevCard.getData('bg') as Phaser.GameObjects.Rectangle;
                bg.setStrokeStyle(4, 0x666666);
            }
        }

        // Select new character
        this.selectedCharacterId = characterId;
        const card = this.characterCards.get(characterId);
        if (card) {
            const bg = card.getData('bg') as Phaser.GameObjects.Rectangle;
            bg.setStrokeStyle(6, 0x00ff00);
        }

        console.log('Character selected:', characterId);

        // Update storage if multiplayer
        if (this.networkEnabled) {
            const playerId = NetworkManager.getPlayerId();
            if (playerId) {
                const storage = NetworkManager.getStorage();
                const characterSelections = storage?.characterSelections || {};

                characterSelections[playerId] = {
                    characterId: characterId,
                    ready: true,
                    timestamp: Date.now()
                };

                const socket = (NetworkManager as any).socket;
                if (socket) {
                    socket.updateStorage('characterSelections', 'set', characterSelections);
                }

                // Update local state
                this.characterSelections.set(playerId, characterSelections[playerId]);
                this.updatePlayerStatus();
            }
        } else {
            // Single player - just enable start button
            this.startButtonBg.setFillStyle(0x00aa00);
            this.startButton.setColor('#ffffff');
            this.startButtonBg.setInteractive({ useHandCursor: true });
        }
    }

    private createStartButton(x: number, y: number): void {
        // Button background
        this.startButtonBg = this.add.rectangle(x, y, 300, 60, 0x444444);
        this.startButtonBg.setStrokeStyle(4, 0x666666);

        // Button text
        this.startButton = this.add.text(x, y, 'START GAME', {
            fontFamily: 'Arial Black',
            fontSize: '32px',
            color: '#666666',
            align: 'center'
        }).setOrigin(0.5);

        // Make button interactive (disabled initially)
        this.startButtonBg.on('pointerdown', () => {
            if (this.selectedCharacterId) {
                this.onStartButtonClick();
            }
        });

        this.startButtonBg.on('pointerover', () => {
            if (this.selectedCharacterId) {
                this.startButtonBg.setFillStyle(0x00dd00);
            }
        });

        this.startButtonBg.on('pointerout', () => {
            if (this.selectedCharacterId) {
                this.startButtonBg.setFillStyle(0x00aa00);
            }
        });
    }

    private onStartButtonClick(): void {
        // This is called when the button is clicked
        // Only host can manually start the game
        if (!this.selectedCharacterId) return;

        if (this.networkEnabled && this.players.length > 1) {
            if (!this.isHost) {
                console.log('Only host can start the game');
                return;
            }

            // Check if all players have selected characters
            const allReady = this.checkAllPlayersReady();
            if (!allReady) {
                console.log('Not all players are ready');
                return;
            }

            // Signal game start in storage (will trigger startGame on all clients)
            const storage = NetworkManager.getStorage();
            const socket = (NetworkManager as any).socket;
            if (socket && storage) {
                socket.updateStorage('gameStarting', 'set', true);
            }
        }

        // Start game immediately for host/single player
        this.startGame();
    }

    private startGame(): void {
        if (!this.selectedCharacterId) return;

        console.log('Starting game with character:', this.selectedCharacterId);

        // Transition to Game scene with character selection and network data
        this.scene.start('GameScene', {
            characterId: this.selectedCharacterId,
            networkEnabled: this.networkEnabled,
            isHost: this.isHost,
            players: this.players
        });
    }

    private setupStorageHandlers(): void {
        // Listen for storage updates
        NetworkManager.onStorageUpdate((storage: any) => {
            console.log('CharacterSelect storage updated:', storage);

            // Update character selections from storage
            if (storage.characterSelections) {
                this.characterSelections.clear();
                Object.entries(storage.characterSelections).forEach(([playerId, selection]: [string, any]) => {
                    this.characterSelections.set(playerId, selection);
                });
                this.updatePlayerStatus();
            }

            // Check if game is starting
            if (storage.gameStarting) {
                console.log('Game starting from storage update!');
                this.startGame();
            }
        });
    }

    private updatePlayerStatus(): void {
        if (!this.playerStatusText || !this.networkEnabled) return;

        const readyCount = this.characterSelections.size;
        const totalPlayers = this.players.length;

        let statusText = `Players Ready: ${readyCount}/${totalPlayers}\n`;

        // Show which players are ready
        this.players.forEach((playerId, index) => {
            const selection = this.characterSelections.get(playerId);
            const playerNum = index + 1;
            const shortId = playerId.slice(0, 8);

            if (selection) {
                const charName = this.characters.find(c => c.id === selection.characterId)?.name || 'Unknown';
                statusText += `✓ Player ${playerNum} (${shortId}): ${charName}\n`;
            } else {
                statusText += `⏳ Player ${playerNum} (${shortId}): Not Ready\n`;
            }
        });

        this.playerStatusText.setText(statusText);

        // Update start button state
        const allReady = this.checkAllPlayersReady();
        if (allReady && this.isHost) {
            this.startButtonBg.setFillStyle(0x00aa00);
            this.startButton.setColor('#ffffff');
            this.startButton.setText('START GAME');
            this.startButtonBg.setInteractive({ useHandCursor: true });
        } else if (this.isHost) {
            this.startButtonBg.setFillStyle(0x444444);
            this.startButton.setColor('#666666');
            this.startButton.setText('WAITING FOR PLAYERS');
        } else if (this.selectedCharacterId) {
            this.startButtonBg.setFillStyle(0x444444);
            this.startButton.setColor('#666666');
            this.startButton.setText('WAITING FOR HOST');
        }
    }

    private checkAllPlayersReady(): boolean {
        if (!this.networkEnabled || this.players.length <= 1) {
            return true; // Single player always ready
        }

        // Check if all players have made a selection
        for (const playerId of this.players) {
            if (!this.characterSelections.has(playerId)) {
                return false;
            }
        }

        return true;
    }

    private capitalize(str: string): string {
        return str.charAt(0).toUpperCase() + str.slice(1);
    }
}
