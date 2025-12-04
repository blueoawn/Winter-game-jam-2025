import PlaySocket from 'playsocketjs';

type StorageUpdateHandler = (storage: any) => void;
type PlayerJoinHandler = (playerId: string) => void;
type PlayerLeaveHandler = (playerId: string) => void;

interface NetworkStats {
    isHost: boolean;
    playerId: string | null;
    roomCode: string | null;
    connectedPlayers: number;
    isConnected: boolean;
}

// Singleton NetworkManager wrapping PlaySocketJS with storage-based sync
class NetworkManager {
    private static instance: NetworkManager;

    private socket: PlaySocket | null = null;
    private isHost: boolean = false;
    private localPlayerId: string | null = null;
    private roomCode: string | null = null;
    private storageUpdateHandler: StorageUpdateHandler | null = null;
    private playerJoinHandler: PlayerJoinHandler | null = null;
    private playerLeaveHandler: PlayerLeaveHandler | null = null;
    private connectedPlayers: Set<string> = new Set();

    constructor() {
        if (NetworkManager.instance) {
            return NetworkManager.instance;
        }

        NetworkManager.instance = this;
    }

    // Initialize PlaySocket connection to server
    async initialize(): Promise<string> {
        try {
            // Generate a unique client ID
            const clientId = `player_${Date.now()}_${Math.random().toString(36).substring(2, 11)}`;

            // Create PlaySocket instance connected to local server
            this.socket = new PlaySocket(clientId, {
                endpoint: 'ws://localhost:3001'
            });

            // Initialize connection
            const playerId = await this.socket.init();
            this.localPlayerId = playerId;

            console.log('PlaySocket initialized with ID:', playerId);

            // Set up event listeners
            this.setupEventListeners();

            return playerId;
        } catch (error) {
            console.error('Failed to initialize PlaySocket:', error);
            throw error;
        }
    }

    // Set up PlaySocket event listeners
    private setupEventListeners(): void {
        if (!this.socket) return;

        // Listen for status changes
        this.socket.onEvent('status', (status: string) => {
            //console.log('PlaySocket status:', status); //DEBUG
        });

        // Listen for storage updates (main synchronization mechanism)
        this.socket.onEvent('storageUpdated', (storage: any) => {
            //console.log('Storage updated:', storage); //DEBUG

            // Notify game of storage changes
            if (this.storageUpdateHandler) {
                this.storageUpdateHandler(storage);
            }
        });

        // Listen for other clients connecting to room
        this.socket.onEvent('clientConnected', (clientId: string) => {
            console.log('Client connected to room:', clientId);
            this.connectedPlayers.add(clientId);

            if (this.playerJoinHandler) {
                this.playerJoinHandler(clientId);
            }
        });

        // Listen for clients disconnecting
        this.socket.onEvent('clientDisconnected', (clientId: string) => {
            console.log('Client disconnected from room:', clientId);
            this.connectedPlayers.delete(clientId);

            if (this.playerLeaveHandler) {
                this.playerLeaveHandler(clientId);
            }
        });
    }

    // Host a new game session (create room)
    async hostGame(): Promise<string> {
        if (!this.socket) {
            throw new Error('NetworkManager not initialized');
        }

        try {
            // Create room with initial storage
            const roomCode = await this.socket.createRoom({
                hostId: this.localPlayerId,
                players: [this.localPlayerId],
                isGameStarted: false,
                playerInputs: {},  // Store player inputs here
                gameState: null     // Host will update this
            });

            this.roomCode = roomCode;
            this.isHost = true;
            this.connectedPlayers.add(this.localPlayerId!);

            console.log('Hosting game with room code:', roomCode);
            return roomCode;
        } catch (error) {
            console.error('Failed to create room:', error);
            throw error;
        }
    }

    // Join an existing game session
    async joinGame(roomCode: string): Promise<void> {
        if (!this.socket) {
            throw new Error('NetworkManager not initialized');
        }

        try {
            this.roomCode = roomCode;
            this.isHost = false;

            console.log('Joining room:', roomCode);
            await this.socket.joinRoom(roomCode);

            // Add self to players list in storage
            this.socket.updateStorage('players', 'array-add-unique', this.localPlayerId);

            console.log('Successfully joined room');
        } catch (error) {
            console.error('Failed to join room:', error);
            throw error;
        }
    }

    // Update player's input in shared storage
    updatePlayerInput(inputState: any): void {
        if (!this.socket) {
            console.error('NetworkManager not initialized');
            return;
        }

        // Get current playerInputs from storage
        const storage = this.socket.getStorage;
        const playerInputs = storage?.playerInputs || {};

        // Update this player's input
        playerInputs[this.localPlayerId!] = {
            ...inputState,
            timestamp: Date.now()
        };

        // Write back to storage (will sync to all clients)
        this.socket.updateStorage('playerInputs', 'set', playerInputs);
    }

    // Update game state (host only)
    updateGameState(gameState: any): void {
        if (!this.socket) {
            console.error('NetworkManager not initialized');
            return;
        }

        if (!this.isHost) {
            console.warn('Only host can update game state');
            return;
        }

        // Update game state in storage (will sync to all clients)
        this.socket.updateStorage('gameState', 'set', {
            ...gameState,
            timestamp: Date.now()
        });
    }

    // Get current storage snapshot
    getStorage(): any {
        if (!this.socket) {
            return null;
        }
        return this.socket.getStorage;  // It's a getter property, not a method
    }

    // Register storage update handler
    onStorageUpdate(handler: StorageUpdateHandler): void {
        this.storageUpdateHandler = handler;
    }

    // Register player join handler
    onPlayerJoin(handler: PlayerJoinHandler): void {
        this.playerJoinHandler = handler;
    }

    // Register player leave handler
    onPlayerLeave(handler: PlayerLeaveHandler): void {
        this.playerLeaveHandler = handler;
    }

    // Get list of connected player IDs
    getConnectedPlayers(): string[] {
        return Array.from(this.connectedPlayers);
    }

    // Check if playing solo (no network)
    isSoloPlay(): boolean {
        return this.socket === null;
    }

    // Check if this client is the host
    getIsHost(): boolean {
        return this.isHost;
    }

    // Get local player ID
    getPlayerId(): string | null {
        return this.localPlayerId;
    }

    // Clean up connections
    destroy(): void {
        if (this.socket) {
            this.socket.destroy();
        }

        this.socket = null;
        this.isHost = false;
        this.localPlayerId = null;
        this.roomCode = null;
        this.connectedPlayers.clear();
        this.storageUpdateHandler = null;
        this.playerJoinHandler = null;
        this.playerLeaveHandler = null;
    }

    // Get network stats
    getStats(): NetworkStats {
        return {
            isHost: this.isHost,
            playerId: this.localPlayerId,
            roomCode: this.roomCode,
            connectedPlayers: this.connectedPlayers.size,
            isConnected: this.socket !== null
        };
    }
}

// Export singleton instance
export default new NetworkManager();
