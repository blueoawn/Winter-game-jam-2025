import NetworkManager from '../../managers/NetworkManager';
import { LobbyUI } from '../ui/LobbyUI';
import { Team } from '../types/Team';
import { audioManager } from '../../managers/AudioManager';

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
    teamAssignments: TeamAssignments;
}

interface TeamAssignments {
    [playerId: string]: Team;
}

//TODO Background image?

export class Lobby extends Phaser.Scene {
    private ui: LobbyUI | null = null;
    private connectedPlayers: string[] = [];
    private teamAssignments: TeamAssignments = {};
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
        audioManager.init(this);
        audioManager.play('character-select-music', { loop: true, volume: 0.5 });

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

        // Assign host to red team by default
        if (stats.playerId) {
            this.teamAssignments[stats.playerId] = Team.Red;
        }

        // Initialize teamAssignments in storage
        const socket = NetworkManager.getSocket();
        if (socket) {
            socket.updateStorage('teamAssignments', 'set', this.teamAssignments);
        }

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

            // Assign new player to a team (alternate between Red and Blue)
            if (!this.teamAssignments[peerId]) {
                // Count current team sizes
                const redCount = Object.values(this.teamAssignments).filter(t => t === Team.Red).length;
                const blueCount = Object.values(this.teamAssignments).filter(t => t === Team.Blue).length;

                // Assign to team with fewer players
                this.teamAssignments[peerId] = redCount <= blueCount ? Team.Red : Team.Blue;

                // Sync team assignments to all clients
                const socket = NetworkManager.getSocket();
                if (socket) {
                    socket.updateStorage('teamAssignments', 'set', this.teamAssignments);
                }
            }

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
            this.ui!.updateStatus('Connected! Waiting for host to start...', '#00ff00');

            // Get current players and team assignments from storage
            // Wait a bit for storage to sync
            setTimeout(() => {
                const storage = NetworkManager.getStorage();
                this.connectedPlayers = storage?.players || [];
                this.teamAssignments = storage?.teamAssignments || {};
                console.log('Initial storage after join:', storage);
                this.updatePlayerList();
            }, 100);

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
        }
    }

    setupStorageHandlers(): void {
        // Listen for storage updates
        NetworkManager.onStorageUpdate((storage: any) => {
            console.log('Lobby storage updated:', storage);

            // Update player list
            if (storage.players) {
                this.connectedPlayers = storage.players;
                console.log('Updated connected players:', this.connectedPlayers);
            }

            // Update team assignments from server
            if (storage.teamAssignments) {
                this.teamAssignments = storage.teamAssignments;
                console.log('Updated team assignments:', this.teamAssignments);
            }

            // Update UI with latest data
            this.updatePlayerList();

            // Check if character selection phase has started - trigger for ALL clients when flag is true
            if (storage.characterSelectionInProgress === true) {
                console.log('Character selection phase starting from storage update!');
                this.startCharacterSelection(this.connectedPlayers);
            }
        });
    }

    updatePlayerList(): void {
        this.ui!.updatePlayerList(this.connectedPlayers, this.teamAssignments, this.isHost);
    }

    assignPlayerTeam(playerId: string, team: Team): void {
        // Update local assignment
        this.teamAssignments[playerId] = team;

        // Sync to storage - both host and clients update storage
        // Server is authoritative and will broadcast to all clients
        const socket = NetworkManager.getSocket();
        if (socket) {
            // Get current assignments from storage to avoid overwriting other players
            const storage = NetworkManager.getStorage();
            const currentAssignments = { ...(storage?.teamAssignments || {}), [playerId]: team };
            console.log(`Updating teamAssignments in storage:`, currentAssignments);
            socket.updateStorage('teamAssignments', 'set', currentAssignments);
        }

        // Update UI immediately for responsive feedback
        this.updatePlayerList();
    }

    switchPlayerTeam(playerId: string, newTeam: Team): void {
        console.log(`Switching player ${playerId} to team ${newTeam}`);
        // All clients can update storage directly - server will sync to everyone
        this.assignPlayerTeam(playerId, newTeam);
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
        console.log('Team assignments:', this.teamAssignments);

        const gameData: GameSceneData = {
            networkEnabled: true,
            isHost: this.isHost,
            players: players,
            teamAssignments: this.teamAssignments
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
