import { Scene } from 'phaser';
import ASSETS from '../assets';

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

    private titleText!: Phaser.GameObjects.Text;
    private characterCards: Map<string, Phaser.GameObjects.Container> = new Map();
    private startButton!: Phaser.GameObjects.Text;
    private startButtonBg!: Phaser.GameObjects.Rectangle;

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

        // Create character selection cards
        this.createCharacterCards(centerX, centerY);

        // Create start button (initially disabled)
        this.createStartButton(centerX, this.scale.height - 80);

        // Instructions
        this.add.text(centerX, this.scale.height - 30, 'Click a character to select', {
            fontFamily: 'Arial',
            fontSize: '20px',
            color: '#cccccc',
            align: 'center'
        }).setOrigin(0.5);
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

        // Enable start button
        this.startButtonBg.setFillStyle(0x00aa00);
        this.startButton.setColor('#ffffff');
        this.startButtonBg.setInteractive({ useHandCursor: true });

        console.log('Character selected:', characterId);
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
                this.startGame();
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

    private capitalize(str: string): string {
        return str.charAt(0).toUpperCase() + str.slice(1);
    }
}
