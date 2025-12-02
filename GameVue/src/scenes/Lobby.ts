import NetworkManager from '../../network/NetworkManager';
import { MessageTypes } from '../../network/MessageTypes';
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

        // Initialize PeerJS if not already initialized
        if (!(NetworkManager as any).peer) {
            await NetworkManager.initialize();
        }

        // Setup message handlers
        this.setupMessageHandlers();

        if (this.mode === 'host') {
            this.hostGame();
        } else if (this.mode === 'join') {
            this.joinGame();
        }
    }

    hostGame(): void {
        this.isHost = true;
        const roomCode = NetworkManager.hostGame();

        this.ui!.updateRoomCode(roomCode);
        this.ui!.updateStatus('Waiting for players to join...', '#00ff00');

        // Add self to player list
        const stats = NetworkManager.getStats();
        this.connectedPlayers = stats.playerId ? [stats.playerId] : [];
        this.updatePlayerList();

        // Listen for players joining
        NetworkManager.onPlayerJoin((peerId: string) => {
            console.log('Player joined:', peerId);
            this.connectedPlayers.push(peerId);
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

        // Use browser prompt for room code input
        // In a production app, you'd create a proper Phaser text input
        setTimeout(() => {
            const roomCode = prompt('Enter Room Code:');

            if (!roomCode || !roomCode.trim()) {
                this.ui!.showError('No room code entered');
                setTimeout(() => this.onBackToMenu(), 2000);
                return;
            }

            // Don't change case - PeerJS IDs are case-sensitive!
            this.connectToHost(roomCode.trim());
        }, 100);
    }

    async connectToHost(roomCode: string): Promise<void> {
        this.ui!.updateStatus('Connecting to host...', '#ffff00');

        try {
            await NetworkManager.joinGame(roomCode);

            this.ui!.updateRoomCode(roomCode);
            this.ui!.updateStatus('Connected! Waiting for host to start game...', '#00ff00');

            // Add self to player list
            const stats = NetworkManager.getStats();
            this.connectedPlayers = stats.playerId ? [stats.playerId] : [];
            this.updatePlayerList();

            // Listen for start game message from host
            NetworkManager.onMessage(MessageTypes.START_GAME, (_fromPeerId: string, payload: StartGamePayload) => {
                console.log('Game starting!');
                this.startGame(payload);
            });

            // Listen for connection lost
            NetworkManager.onPlayerLeave((peerId: string) => {
                const hostConn = (NetworkManager as any).hostConnection;
                if (peerId === hostConn?.peer) {
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

    setupMessageHandlers(): void {
        // Handle player join acknowledgment (if needed)
        NetworkManager.onMessage(MessageTypes.PLAYER_JOIN, (_fromPeerId: string, payload: any) => {
            console.log('Player join message:', payload);
        });
    }

    updatePlayerList(): void {
        this.ui!.updatePlayerList(this.connectedPlayers, this.isHost);
    }

    onStartGame(): void {
        if (!this.isHost) {
            console.warn('Only host can start game');
            return;
        }

        if (this.connectedPlayers.length < 1) {
            this.ui!.showError('Need at least 1 player to start');
            return;
        }

        // Broadcast start game message to all clients
        NetworkManager.broadcast(MessageTypes.START_GAME, {
            players: this.connectedPlayers
        });

        // Start game for host
        this.startGame({ players: this.connectedPlayers });
    }

    startGame(data: StartGamePayload): void {
        console.log('Starting game with players:', data.players);

        const gameData: GameSceneData = {
            networkEnabled: true,
            isHost: this.isHost,
            players: data.players || this.connectedPlayers
        };

        // Transition to Game scene
        this.scene.start('GameScene', gameData);
    }

    onBackToMenu(): void {
        // Clean up and return to Start scene
        NetworkManager.destroy();
        this.scene.start('Start');
    }

    shutdown(): void {
        // Clean up UI
        if (this.ui) {
            this.ui.destroy();
        }
    }
}
