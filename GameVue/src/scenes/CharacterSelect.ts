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
        },
        {
            id: 'cheese-touch',
            name: 'Cheese Touch',
            frame: 2,
            description: 'Big cheese energy',
            stats: {
                speed: 'Fine',
                health: 'Half a truckle',
                fireRate: 'Swiss cheese'
            },
            ability1: 'Cheese Beam (damage over time)',
            ability2: 'Eat Cheese (heal self)'
        },
        {
            id: 'big-sword',
            name: 'Big G',
            frame: 3,
            description: 'Has a sword that is as big as he is',
            stats: {
                speed: 'Medium',
                health: 'High',
                fireRate: 'Melee'
            },
            ability1: 'Heavy Slash (frontal swing)',
            ability2: 'Piercing Strike (charge dash)'
        },
        {
            id: 'boom-stick',
            name: 'Boom Stick',
            frame: 4,
            description: 'Close range devastation',
            stats: {
                speed: 'Fast',
                health: 'Low',
                fireRate: 'Slow but deadly'
            },
            ability1: 'Shotgun Blast (7 pellet spread)',
            ability2: 'Burst Dash (quick dodge)'
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
        const screenWidth = this.scale.width;
        const screenPadding = 40;
        const cardSpacing = 20;
        const availableWidth = screenWidth - (screenPadding * 2);

        const minCardWidth = 200;
        const maxCardWidth = 350;
        const cardHeight = 450;

        const numCards = this.characters.length;
        const totalSpacing = cardSpacing * (numCards - 1);
        const widthPerCard = (availableWidth - totalSpacing) / numCards;
        const cardWidth = Phaser.Math.Clamp(widthPerCard, minCardWidth, maxCardWidth);

        const actualTotalWidth = (cardWidth * numCards) + totalSpacing;
        const needsScroll = actualTotalWidth > availableWidth;

        const startX = needsScroll
            ? screenPadding + cardWidth / 2
            : centerX - (actualTotalWidth / 2) + (cardWidth / 2);

        const container = this.add.container(0, 0);

        this.characters.forEach((character, index) => {
            const x = startX + (index * (cardWidth + cardSpacing));
            const card = this.createCharacterCard(character, x, centerY, cardWidth, cardHeight);
            this.characterCards.set(character.id, card);
            container.add(card);
        });

        if (needsScroll) {
            this.setupScrolling(container, actualTotalWidth, availableWidth);
        }
    }

    private setupScrolling(container: Phaser.GameObjects.Container, contentWidth: number, viewWidth: number): void {
        const maxScroll = contentWidth - viewWidth;
        let currentScroll = 0;

        const leftArrow = this.add.text(20, this.scale.height / 2, '◀', {
            fontSize: '48px',
            color: '#ffffff'
        }).setOrigin(0.5).setInteractive({ useHandCursor: true }).setAlpha(0.3);

        const rightArrow = this.add.text(this.scale.width - 20, this.scale.height / 2, '▶', {
            fontSize: '48px',
            color: '#ffffff'
        }).setOrigin(0.5).setInteractive({ useHandCursor: true });

        const updateArrows = () => {
            leftArrow.setAlpha(currentScroll > 0 ? 1 : 0.3);
            rightArrow.setAlpha(currentScroll < maxScroll ? 1 : 0.3);
        };

        const scrollAmount = 300;

        leftArrow.on('pointerdown', () => {
            if (currentScroll > 0) {
                currentScroll = Math.max(0, currentScroll - scrollAmount);
                this.tweens.add({
                    targets: container,
                    x: -currentScroll,
                    duration: 200,
                    ease: 'Power2'
                });
                updateArrows();
            }
        });

        rightArrow.on('pointerdown', () => {
            if (currentScroll < maxScroll) {
                currentScroll = Math.min(maxScroll, currentScroll + scrollAmount);
                this.tweens.add({
                    targets: container,
                    x: -currentScroll,
                    duration: 200,
                    ease: 'Power2'
                });
                updateArrows();
            }
        });

        this.input.on('wheel', (_pointer: Phaser.Input.Pointer, _gameObjects: any, _deltaX: number, deltaY: number) => {
            currentScroll = Phaser.Math.Clamp(currentScroll + deltaY, 0, maxScroll);
            container.x = -currentScroll;
            updateArrows();
        });
    }

    private createCharacterCard(character: CharacterData, x: number, y: number, cardWidth: number = 300, cardHeight: number = 450): Phaser.GameObjects.Container {
        const container = this.add.container(x, y);
        const scale = cardWidth / 300;

        const bg = this.add.rectangle(0, 0, cardWidth, cardHeight, 0x222222, 0.9);
        bg.setStrokeStyle(4, 0x666666);
        container.add(bg);

        const sprite = this.add.sprite(0, -120 * scale, ASSETS.spritesheet.ships.key, character.frame);
        sprite.setScale(3 * scale);
        container.add(sprite);

        const nameText = this.add.text(0, -30 * scale, character.name, {
            fontFamily: 'Arial Black',
            fontSize: `${Math.floor(24 * scale)}px`,
            color: '#ffffff',
            stroke: '#000000',
            strokeThickness: 4,
            align: 'center'
        }).setOrigin(0.5);
        container.add(nameText);

        const descText = this.add.text(0, 10 * scale, character.description, {
            fontFamily: 'Arial',
            fontSize: `${Math.floor(14 * scale)}px`,
            color: '#aaaaaa',
            align: 'center',
            wordWrap: { width: cardWidth - 20 }
        }).setOrigin(0.5);
        container.add(descText);

        const contentWidth = cardWidth - 30;
        const leftX = -contentWidth / 2 + 10;
        const rightX = 10;
        let yOffset = 40 * scale;

        const statsTitle = this.add.text(leftX, yOffset, 'Stats:', {
            fontFamily: 'Arial Black',
            fontSize: `${Math.floor(16 * scale)}px`,
            color: '#ffff00',
            align: 'left'
        }).setOrigin(0, 0.5);
        container.add(statsTitle);

        let statsY = yOffset + 25 * scale;
        Object.entries(character.stats).forEach(([key, value]) => {
            const statText = this.add.text(leftX, statsY, `${this.capitalize(key)}: ${value}`, {
                fontFamily: 'Arial',
                fontSize: `${Math.floor(12 * scale)}px`,
                color: '#ffffff',
                align: 'left'
            }).setOrigin(0, 0.5);
            container.add(statText);
            statsY += 20 * scale;
        });

        const abilitiesTitle = this.add.text(rightX, yOffset, 'Abilities:', {
            fontFamily: 'Arial Black',
            fontSize: `${Math.floor(16 * scale)}px`,
            color: '#00ffff',
            align: 'left'
        }).setOrigin(0, 0.5);
        container.add(abilitiesTitle);

        let abilitiesY = yOffset + 25 * scale;
        const ability1Text = this.add.text(rightX, abilitiesY, `1: ${character.ability1}`, {
            fontFamily: 'Arial',
            fontSize: `${Math.floor(12 * scale)}px`,
            color: '#ffffff',
            align: 'left',
            wordWrap: { width: contentWidth / 2 - 20 }
        }).setOrigin(0, 0.5);
        container.add(ability1Text);
        abilitiesY += 35 * scale;

        const ability2Text = this.add.text(rightX, abilitiesY, `2: ${character.ability2}`, {
            fontFamily: 'Arial',
            fontSize: `${Math.floor(12 * scale)}px`,
            color: '#ffffff',
            align: 'left',
            wordWrap: { width: contentWidth / 2 - 20 }
        }).setOrigin(0, 0.5);
        container.add(ability2Text);

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
