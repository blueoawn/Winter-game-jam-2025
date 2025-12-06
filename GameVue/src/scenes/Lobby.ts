import NetworkManager from '../../managers/NetworkManager';
import { LobbyUI } from '../ui/LobbyUI';

interface LobbyInitData {
    mode?: 'host' | 'join';
}

interface StartGamePayload {
    players: string[];
}

interface GameSceneData {
    networkEnabled: boolean;
    isHost: boolean;
    players: string[];
}

//TODO Background image?

export class Lobby extends Phaser.Scene {
    private ui: LobbyUI | null = null;
    private connectedPlayers: string[] = [];
    private isHost: boolean = false;
    private mode: 'host' | 'join' | null = null;

    constructor() {
        super('Lobby');
    }

    init(data: LobbyInitData): void {
        // Data passed from Start scene: { mode: 'host' | 'join' }
        this.mode = data.mode || 'host';
    }

    async create(): Promise<void> {
        // Create UI
        this.ui = new LobbyUI(this);
        this.ui.create();

        // Initialize networking
        try {
            await this.initializeNetworking();
        } catch (error) {
            console.error('Failed to initialize networking:', error);
            this.ui.showError('Failed to connect. Please try again.');
        }
    }

    async initializeNetworking(): Promise<void> {
        this.ui!.updateStatus('Connecting...', '#ffff00');

        // Initialize PlaySocket
        await NetworkManager.initialize();

        if (this.mode === 'host') {
            this.ui!.changeMode('host');
            // Setup storage handlers before hosting
            this.setupStorageHandlers();
            await this.hostGame();
        } else if (this.mode === 'join') {
            this.ui!.changeMode('join');
            this.joinGame();
        }
    }

    //TODO add field to enter player name after clicking host/join (backend can still use existing clientId system, but display names are nicer)

    async hostGame(): Promise<void> {
        this.isHost = true;
        const roomCode = await NetworkManager.hostGame();

        this.ui!.updateRoomCode(roomCode);
        this.ui!.updateStatus('Waiting for players to join...', '#00ff00');

        // Add self to player list
        const stats = NetworkManager.getStats();
        this.connectedPlayers = stats.playerId ? [stats.playerId] : [];
        this.updatePlayerList();

        // Listen for players joining
        NetworkManager.onPlayerJoin((peerId: string) => {
            console.log('Player joined:', peerId);

            // Update players list in storage
            const storage = NetworkManager.getStorage();
            const players = storage?.players || [];
            if (!players.includes(peerId)) {
                players.push(peerId);
            }

            this.connectedPlayers = players;
            this.updatePlayerList();
            this.ui!.updateStatus(`${this.connectedPlayers.length} player(s) connected`, '#00ff00');
        });

        NetworkManager.onPlayerLeave((peerId: string) => {
            console.log('Player left:', peerId);
            this.connectedPlayers = this.connectedPlayers.filter(id => id !== peerId);
            this.updatePlayerList();
            this.ui!.updateStatus(`${this.connectedPlayers.length} player(s) connected`, '#ffff00');
        });
    }

    joinGame(): void {
        this.isHost = false;

        // Show join dialog
        this.ui!.updateStatus('Enter room code to join', '#ffff00');
    }

    async connectToHost(roomCode: string): Promise<void> {
        this.ui!.updateStatus('Connecting to host...', '#ffff00');

        try {
            await NetworkManager.joinGame(roomCode);

            // Setup storage handlers AFTER joining the room
            this.setupStorageHandlers();

            this.ui!.updateRoomCode(roomCode);
            this.ui!.changeMode('host');
            this.ui!.updateStatus('Connected! Waiting for host to initiate character select ', '#00ff00');

            // Get current players from storage
            const storage = NetworkManager.getStorage();
            this.connectedPlayers = storage?.players || [];
            this.updatePlayerList();

            // Listen for host disconnect
            NetworkManager.onPlayerLeave((peerId: string) => {
                const storage = NetworkManager.getStorage();
                if (peerId === storage?.hostId) {
                    this.ui!.showError('Connection to host lost');
                    setTimeout(() => this.onBackToMenu(), 2000);
                }
            });

        } catch (error) {
            console.error('Failed to join game:', error);
            this.ui!.showError('Failed to join game. Check the room code.');
            setTimeout(() => this.onBackToMenu(), 2000);
        }
    }

    setupStorageHandlers(): void {
        // Listen for storage updates
        NetworkManager.onStorageUpdate((storage: any) => {
            console.log('Lobby storage updated:', storage, 'characterSelectionInProgress:', storage.characterSelectionInProgress);

            // Update player list
            if (storage.players) {
                this.connectedPlayers = storage.players;
                this.updatePlayerList();
            }

            // Check if character selection phase has started - trigger for ALL clients when flag is true
            if (storage.characterSelectionInProgress === true) {
                console.log('Character selection phase starting from storage update!');
                this.startCharacterSelection(this.connectedPlayers);
            }
        });
    }

    updatePlayerList(): void {
        this.ui!.updatePlayerList(this.connectedPlayers, this.isHost);
    }

    onSelectCharacters(): void {
        if (!this.isHost) {
            console.warn('Only host can initiate character selection');
            return;
        }

        if (this.connectedPlayers.length < 1) {
            this.ui!.showError('Need at least 1 player to proceed');
            return;
        }

        console.log('Host initiating character selection phase');

        // Update storage to signal character selection phase (will sync to all clients)
        const socket = NetworkManager.getSocket();
        if (socket) {
            console.log('Writing characterSelectionInProgress=true to storage');
            socket.updateStorage('characterSelectionInProgress', 'set', true);
        } else {
            console.error('Socket not available, cannot update storage');
        }

        // Start character selection for host immediately
        this.startCharacterSelection(this.connectedPlayers);
    }

    startCharacterSelection(players: string[]): void {
        console.log('Starting character selection with players:', players);

        const gameData: GameSceneData = {
            networkEnabled: true,
            isHost: this.isHost,
            players: players
        };

        // Transition to Character Select scene
        this.scene.start('CharacterSelectScene', gameData);
    }

    onBackToMenu(): void {
        // Clean up and return to Start scene
        NetworkManager.destroy();
        this.scene.start('Start');
    }

    // Alias for LobbyUI button handlers
    selectCharacters(): void {
        this.onSelectCharacters();
    }

    shutdown(): void {
        // Clean up UI
        if (this.ui) {
            this.ui.destroy();
        }
    }
}
