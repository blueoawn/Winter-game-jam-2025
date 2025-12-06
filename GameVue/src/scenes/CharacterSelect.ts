import { Scene } from 'phaser';
import ASSETS from '../assets';
import NetworkManager from '../../network/NetworkManager';
import { CharacterIdsEnum } from "../gameObjects/Characters/CharactersEnum.ts";

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
        },
        //why is this locked, I can't seem to figure it out lol
        {
            id: 'rail-gun',
            name: 'Rail Gun',
            frame: 5,
            description: 'Stop and pop',
            stats: {
                speed: 'Medium',
                health: 'Low',
                fireRate: ''
            },
            ability1: 'Ninja stars',
            ability2: 'Rail gun'
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

    // Carousel state
    private currentIndex: number = 0;
    private carouselContainer!: Phaser.GameObjects.Container;
    private isAnimating: boolean = false;
    private leftArrow!: Phaser.GameObjects.Text;
    private rightArrow!: Phaser.GameObjects.Text;

    // Unlocked characters - only these can be selected
    private unlockedCharacters: Set<string> = new Set();
    private static readonly STORAGE_KEY = 'unlockedCharacters';
    // TODO modify this variable to have less characters when the game is ready
    private static readonly DEFAULT_UNLOCKED: string[] = [
        CharacterIdsEnum.LizardWizard,
        CharacterIdsEnum.BigSword,
        CharacterIdsEnum.SwordAndBoard,
        CharacterIdsEnum.BoomStick,
        CharacterIdsEnum.CheeseTouch,
        CharacterIdsEnum.Railgun
    ];

    constructor() {
        super('CharacterSelectScene');
        this.loadUnlockedCharacters();
    }

    private loadUnlockedCharacters(): void {
        try {
            const stored = localStorage.getItem(CharacterSelectScene.STORAGE_KEY);
            if (stored) {
                const parsed = JSON.parse(stored) as string[];
                this.unlockedCharacters = new Set(parsed);
                // Ensure any new default unlocks are present (migration)
                let added = false;
                (CharacterSelectScene.DEFAULT_UNLOCKED as string[]).forEach(def => {
                    if (!this.unlockedCharacters.has(def)) {
                        this.unlockedCharacters.add(def);
                        added = true;
                    }
                });
                if (added) {
                    // Persist migration changes
                    this.saveUnlockedCharacters();
                }
            } else {
                // First time - set defaults
                this.unlockedCharacters = new Set(CharacterSelectScene.DEFAULT_UNLOCKED);
                this.saveUnlockedCharacters();
            }
        } catch (e) {
            console.warn('Failed to load unlocked characters from storage:', e);
            this.unlockedCharacters = new Set(CharacterSelectScene.DEFAULT_UNLOCKED);
        }
        console.log('Unlocked characters:', Array.from(this.unlockedCharacters));
    }

    private saveUnlockedCharacters(): void {
        try {
            const data = Array.from(this.unlockedCharacters);
            localStorage.setItem(CharacterSelectScene.STORAGE_KEY, JSON.stringify(data));
        } catch (e) {
            console.warn('Failed to save unlocked characters to storage:', e);
        }
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
        // Reset carousel state
        this.currentIndex = 0;
        this.isAnimating = false;
        this.characterCards.clear();

        // Create carousel container centered on screen
        this.carouselContainer = this.add.container(centerX, centerY);

        // Create all character cards at position 0,0 (we'll position them in updateCarouselPositions)
        this.characters.forEach((character, index) => {
            const card = this.createCharacterCard(character, 0, 0, 320, 420, index);
            this.characterCards.set(character.id, card);
            this.carouselContainer.add(card);
        });

        // Create navigation arrows
        this.createCarouselArrows(centerY);

        // Set initial positions
        this.updateCarouselPositions(false);

        // Add keyboard navigation
        this.input.keyboard?.on('keydown-LEFT', () => this.navigateCarousel(-1));
        this.input.keyboard?.on('keydown-RIGHT', () => this.navigateCarousel(1));
        this.input.keyboard?.on('keydown-A', () => this.navigateCarousel(-1));
        this.input.keyboard?.on('keydown-D', () => this.navigateCarousel(1));
    }

    private createCarouselArrows(centerY: number): void {
        this.leftArrow = this.add.text(60, centerY, '◀', {
            fontSize: '64px',
            color: '#ffffff',
            stroke: '#000000',
            strokeThickness: 4
        }).setOrigin(0.5).setInteractive({ useHandCursor: true });

        this.rightArrow = this.add.text(this.scale.width - 60, centerY, '▶', {
            fontSize: '64px',
            color: '#ffffff',
            stroke: '#000000',
            strokeThickness: 4
        }).setOrigin(0.5).setInteractive({ useHandCursor: true });

        this.leftArrow.on('pointerdown', () => this.navigateCarousel(-1));
        this.rightArrow.on('pointerdown', () => this.navigateCarousel(1));

        this.leftArrow.on('pointerover', () => this.leftArrow.setScale(1.2));
        this.leftArrow.on('pointerout', () => this.leftArrow.setScale(1));
        this.rightArrow.on('pointerover', () => this.rightArrow.setScale(1.2));
        this.rightArrow.on('pointerout', () => this.rightArrow.setScale(1));

        this.updateArrowVisibility();
    }

    private navigateCarousel(direction: number): void {
        if (this.isAnimating) return;

        const newIndex = this.currentIndex + direction;
        if (newIndex < 0 || newIndex >= this.characters.length) return;

        this.currentIndex = newIndex;
        this.isAnimating = true;
        this.updateCarouselPositions(true);
        this.updateArrowVisibility();
    }

    private updateCarouselPositions(animate: boolean): void {
        const centerScale = 1.0;
        const sideScale = 0.7;
        const sideOffset = 320;
        const duration = 300;

        let completed = 0;
        const total = this.characters.length;

        this.characters.forEach((character, index) => {
            const card = this.characterCards.get(character.id);
            if (!card) return;

            const offset = index - this.currentIndex;
            let targetX = 0;
            let targetScale = 0;
            let targetAlpha = 0;
            let depth = 0;

            if (offset === 0) {
                // Center card - fully visible and large
                targetX = 0;
                targetScale = centerScale;
                targetAlpha = 1;
                depth = 10;
            } else if (offset === -1) {
                // Left card - smaller and darkened
                targetX = -sideOffset;
                targetScale = sideScale;
                targetAlpha = 0.6;
                depth = 5;
            } else if (offset === 1) {
                // Right card - smaller and darkened
                targetX = sideOffset;
                targetScale = sideScale;
                targetAlpha = 0.6;
                depth = 5;
            } else {
                // Hidden cards
                targetX = offset < 0 ? -sideOffset * 2 : sideOffset * 2;
                targetScale = 0.5;
                targetAlpha = 0;
                depth = 0;
            }

            card.setDepth(depth);

            if (animate) {
                this.tweens.add({
                    targets: card,
                    x: targetX,
                    scaleX: targetScale,
                    scaleY: targetScale,
                    alpha: targetAlpha,
                    duration: duration,
                    ease: 'Power2',
                    onComplete: () => {
                        completed++;
                        if (completed === total) {
                            this.isAnimating = false;
                        }
                    }
                });
            } else {
                card.setPosition(targetX, 0);
                card.setScale(targetScale);
                card.setAlpha(targetAlpha);
            }
        });

        if (!animate) {
            this.isAnimating = false;
        }
    }

    private updateArrowVisibility(): void {
        if (this.leftArrow) {
            this.leftArrow.setAlpha(this.currentIndex > 0 ? 1 : 0.3);
        }
        if (this.rightArrow) {
            this.rightArrow.setAlpha(this.currentIndex < this.characters.length - 1 ? 1 : 0.3);
        }
    }

    private onCardClick(index: number, characterId: string): void {
        // Don't allow selecting locked characters
        if (!this.isCharacterUnlocked(characterId)) {
            console.log('Character is locked:', characterId);
            return;
        }

        const offset = index - this.currentIndex;

        if (offset === 0) {
            // Center card clicked - select it
            this.selectCharacter(characterId);
        } else if (offset === -1 || offset === 1) {
            // Side card clicked - navigate to it then select
            this.navigateCarousel(offset);
            // Select after animation
            this.time.delayedCall(350, () => {
                this.selectCharacter(characterId);
            });
        }
    }

    private isCharacterUnlocked(characterId: string): boolean {
        return this.unlockedCharacters.has(characterId);
    }

    public unlockCharacter(characterId: string): void {
        if (!this.unlockedCharacters.has(characterId)) {
            this.unlockedCharacters.add(characterId);
            this.saveUnlockedCharacters();
        }
    }

    public lockCharacter(characterId: string): void {
        // Don't allow locking default characters
        if ((CharacterSelectScene.DEFAULT_UNLOCKED as string[]).includes(characterId)) {
            console.warn('Cannot lock default character:', characterId);
            return;
        }
        if (this.unlockedCharacters.has(characterId)) {
            this.unlockedCharacters.delete(characterId);
            this.saveUnlockedCharacters();
        }
    }

    public unlockAllCharacters(): void {
        this.characters.forEach(c => this.unlockedCharacters.add(c.id));
        this.saveUnlockedCharacters();
    }

    public resetUnlockedCharacters(): void {
        this.unlockedCharacters = new Set(CharacterSelectScene.DEFAULT_UNLOCKED);
        this.saveUnlockedCharacters();
    }

    private createCharacterCard(character: CharacterData, x: number, y: number, cardWidth: number = 300, cardHeight: number = 450, index: number = 0): Phaser.GameObjects.Container {
        const container = this.add.container(x, y);
        const isLocked = !this.isCharacterUnlocked(character.id);

        // Card background - darker for locked characters
        const bg = this.add.rectangle(0, 0, cardWidth, cardHeight, isLocked ? 0x111111 : 0x222222, 0.95);
        bg.setStrokeStyle(4, isLocked ? 0x333333 : 0x666666);
        container.add(bg);

        // Add decorative background image above character name if available
        // Using the lizard-wizard background image as an example and repeating for all cards
        if (this.textures.exists(ASSETS.image.lizardWizardBackgroundSmall.key)) {
            const cardBgImage = this.add.image(0, -120, ASSETS.image.lizardWizardBackgroundSmall.key);

            // Calculate scale to fit within 200x150 while maintaining aspect ratio
            const maxWidth = 200;
            const maxHeight = 150;
            const texture = this.textures.get(ASSETS.image.lizardWizardBackgroundSmall.key);
            const textureWidth = texture.source[0].width;
            const textureHeight = texture.source[0].height;

            const scaleX = maxWidth / textureWidth;
            const scaleY = maxHeight / textureHeight;
            const fitScale = Math.min(scaleX, scaleY);

            cardBgImage.setScale(fitScale);
            cardBgImage.setDepth(1);
            cardBgImage.setAlpha(1);
            if (isLocked) {
                cardBgImage.setTint(0x000000);
            }
            container.add(cardBgImage);
        }

        // Character sprite - black silhouette for locked characters
        // const sprite = this.add.sprite(0, -100, ASSETS.spritesheet.ships.key, character.frame);
        // sprite.setScale(3.5);
        // if (isLocked) {
        //     sprite.setTint(0x000000);
        // }
        // container.add(sprite);

        // Name - show "???" for locked characters
        const nameText = this.add.text(0, -10, isLocked ? '???' : character.name, {
            fontFamily: 'Arial Black',
            fontSize: '26px',
            color: isLocked ? '#444444' : '#ffffff',
            stroke: '#000000',
            strokeThickness: 4,
            align: 'center'
        }).setOrigin(0.5);
        container.add(nameText);

        // Description - hidden for locked characters
        const descText = this.add.text(0, 25, isLocked ? 'LOCKED' : character.description, {
            fontFamily: 'Arial',
            fontSize: '16px',
            color: isLocked ? '#ff4444' : '#aaaaaa',
            align: 'center',
            wordWrap: { width: cardWidth - 30 }
        }).setOrigin(0.5);
        container.add(descText);

        // Stats and abilities layout
        const leftX = -70;
        const rightX = 70;
        const startY = 60;

        if (isLocked) {
            // Show lock icon/message for locked characters
            const lockText = this.add.text(0, startY + 50, '🔒', {
                fontSize: '48px'
            }).setOrigin(0.5);
            container.add(lockText);

            const unlockHint = this.add.text(0, startY + 100, 'Complete challenges\nto unlock!', {
                fontFamily: 'Arial',
                fontSize: '14px',
                color: '#666666',
                align: 'center'
            }).setOrigin(0.5);
            container.add(unlockHint);
        } else {
            // Show stats for unlocked characters
            const statsTitle = this.add.text(leftX, startY, 'Stats:', {
                fontFamily: 'Arial Black',
                fontSize: '16px',
                color: '#ffff00'
            }).setOrigin(0.5);
            container.add(statsTitle);

            let statsY = startY + 25;
            Object.entries(character.stats).forEach(([key, value]) => {
                const statText = this.add.text(leftX, statsY, `${this.capitalize(key)}:`, {
                    fontFamily: 'Arial',
                    fontSize: '12px',
                    color: '#ffffff'
                }).setOrigin(0.5);
                container.add(statText);
                statsY += 16;
                const valueText = this.add.text(leftX, statsY, value, {
                    fontFamily: 'Arial',
                    fontSize: '11px',
                    color: '#cccccc'
                }).setOrigin(0.5);
                container.add(valueText);
                statsY += 20;
            });

            // Show abilities for unlocked characters
            const abilitiesTitle = this.add.text(rightX, startY, 'Abilities:', {
                fontFamily: 'Arial Black',
                fontSize: '16px',
                color: '#00ffff'
            }).setOrigin(0.5);
            container.add(abilitiesTitle);

            const ability1Text = this.add.text(rightX, startY + 30, '1: ' + character.ability1, {
                fontFamily: 'Arial',
                fontSize: '11px',
                color: '#ffffff',
                wordWrap: { width: 120 },
                align: 'center'
            }).setOrigin(0.5);
            container.add(ability1Text);

            const ability2Text = this.add.text(rightX, startY + 80, '2: ' + character.ability2, {
                fontFamily: 'Arial',
                fontSize: '11px',
                color: '#ffffff',
                wordWrap: { width: 120 },
                align: 'center'
            }).setOrigin(0.5);
            container.add(ability2Text);
        }

        // Only make unlocked characters interactive for selection
        if (!isLocked) {
            bg.setInteractive({ useHandCursor: true });
            bg.on('pointerdown', () => this.onCardClick(index, character.id));
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
        } else {
            // Locked characters can still be clicked to navigate carousel, but not selected
            bg.setInteractive({ useHandCursor: false });
            bg.on('pointerdown', () => {
                const offset = index - this.currentIndex;
                if (offset === -1 || offset === 1) {
                    this.navigateCarousel(offset);
                }
            });
        }

        container.setData('bg', bg);
        container.setData('characterId', character.id);
        container.setData('index', index);
        container.setData('isLocked', isLocked);

        return container;
    }

    private selectCharacter(characterId: string): void {
        // Safety check - don't allow selecting locked characters
        if (!this.isCharacterUnlocked(characterId)) {
            console.log('Cannot select locked character:', characterId);
            return;
        }

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
