import PlaySocket from 'playsocketjs';

type StorageKeyHandler = (value: any) => void;
type StorageUpdateHandler = (storage: any) => void; //keeping this to keep track of players in lobby until I figure out a better way to do this
type PlayerEventHandler = (playerId: string) => void;
export class NetworkManager {
    private static instance: NetworkManager;

    private socket: PlaySocket | null = null;
    private localPlayerId: string | null = null;
    private roomCode: string | null = null;
    private storageUpdateHandler: StorageUpdateHandler | null = null; //update when player joins or leaves the lobby via disconnect
    private isHost = false;

    private playerJoinedHandler?: PlayerEventHandler;
    private playerLeftHandler?: PlayerEventHandler;

    private connectedPlayers = new Set<string>();
    private storage: any = null;

    private constructor() {}

    static getInstance(): NetworkManager {
        if (!NetworkManager.instance) {
            NetworkManager.instance = new NetworkManager();
        }
        return NetworkManager.instance;
    }

    async initialize(): Promise<string> {
        const clientId = `player_${Date.now()}_${Math.random().toString(36).slice(2)}`;

        this.socket = new PlaySocket(clientId, {
            endpoint: 'ws://localhost:3001'
        });

        this.localPlayerId = await this.socket.init();

        this.registerCoreEvents();

        return this.localPlayerId!; // Non-null assertion since init() always returns a string
    }

    private registerCoreEvents() {
        if (!this.socket) return;

        // Listen to client connected/disconnected events from PlaySocket
        this.socket.onEvent('clientConnected', (clientId: string) => {
            this.connectedPlayers.add(clientId);
            this.playerJoinedHandler?.(clientId);
        });

        this.socket.onEvent('clientDisconnected', (clientId: string) => {
            this.connectedPlayers.delete(clientId);
            this.playerLeftHandler?.(clientId);
        });
    }

    async hostGame(): Promise<string> {
        if (!this.socket) throw new Error('Network not initialized');

        const initialStorage = {
            hostId: this.localPlayerId,
            players: [this.localPlayerId],
            inputs: {},
            isGameStarted: false,
            startGameData: null,
            meta: { started: false }
        };

        const roomCode = await this.socket.createRoom(initialStorage);

        this.roomCode = roomCode;
        this.isHost = true;
        this.storage = initialStorage;
        this.connectedPlayers.add(this.localPlayerId!);

        return roomCode;
    }

    async joinGame(room: string) {
        if (!this.socket) throw new Error('Network not initialized');

        this.roomCode = room;
        this.isHost = false;
        await this.socket.joinRoom(room);

        // Get current room storage
        this.storage = this.socket.getStorage;

        // Add self to players list
        if (Array.isArray(this.storage?.players)) {
            if (!this.storage.players.includes(this.localPlayerId)) {
                this.storage.players.push(this.localPlayerId);
            }
        }

        this.socket.updateStorage(`players`, 'array-add-unique', this.localPlayerId);
    }

    //input update
    sendInput(input: any) {
        if (!this.socket || !this.localPlayerId) return;

        this.socket.updateStorage(`inputs.${this.localPlayerId}`, 'set', {
            ...input,
            t: Date.now()
        });
    }

    // Volatile state broadcasting (host)
    sendVolatileState(state: any) {
        if (!this.isHost || !this.socket) return;
        // PlaySocket doesn't support volatile/unreliable messages
        // For frequent state updates, use storage or implement a custom protocol
        // For now, this is a no-op
    }

    // Subscribe to storage updates and filter by changes
    onStorageKey(key: string, handler: StorageKeyHandler) {
        if (!this.socket) return;
        
        // Listen to all storage updates and call handler when the specific key changes
        this.socket.onEvent('storageUpdated', (storage: any) => {
            if (storage && storage[key] !== undefined) {
                handler(storage[key]);
            }
        });
    }

    // Listen for general storage updates
    onStorageUpdate(handler: StorageUpdateHandler) {
        this.storageUpdateHandler = handler;

        // If we already have storage, invoke immediately
        if (this.storage) {
            handler(this.storage);
        }

        // Listen to storage updates from PlaySocket
        if (this.socket) {
            this.socket.onEvent('storageUpdated', (storage: any) => {
                this.storage = storage;
                this.storageUpdateHandler?.(storage);
            });
        }
    }

    // Stop listening to storage updates
    offStorageUpdate() {
        this.storageUpdateHandler = null;
    }

    onPlayerJoined(handler: PlayerEventHandler) {
        this.playerJoinedHandler = handler;
    }

    onPlayerLeft(handler: PlayerEventHandler) {
        this.playerLeftHandler = handler;
    }

    // Aliases for convenience
    onPlayerJoin(handler: PlayerEventHandler) {
        this.onPlayerJoined(handler);
    }

    onPlayerLeave(handler: PlayerEventHandler) {
        this.onPlayerLeft(handler);
    }

    getPlayerId() {
        return this.localPlayerId;
    }

    getRoomCode() {
        return this.roomCode;
    }

    getConnectedPlayers() {
        return Array.from(this.connectedPlayers);
    }

    getIsHost() {
        return this.isHost;
    }

    getStorage() {
        if (this.socket) {
            return this.socket.getStorage;
        }
        return this.storage;
    }

    getStats() {
        return {
            isHost: this.isHost,
            playerId: this.localPlayerId,
            roomCode: this.roomCode,
            connectedPlayers: this.connectedPlayers.size,
            isConnected: this.socket !== null
        };
    }

    getSocket() {
        return this.socket;
    }

    sendRequest(requestName: string, data?: any) {
        this.socket?.sendRequest(requestName, data);
    }

    destroy() {
        this.socket?.destroy();
        this.socket = null;
        this.connectedPlayers.clear();
        this.roomCode = null;
        this.localPlayerId = null;
        this.isHost = false;
    }
}

export default NetworkManager.getInstance();
