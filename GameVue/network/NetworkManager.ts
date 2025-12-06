import PlaySocket from 'playsocketjs';

type StorageKeyHandler = (value: any) => void;
type PlayerEventHandler = (playerId: string) => void;
export class NetworkManager {
    private static instance: NetworkManager;

    private socket: PlaySocket | null = null;
    private localPlayerId: string | null = null;
    private roomCode: string | null = null;
    private isHost = false;

    private playerJoinedHandler?: PlayerEventHandler;
    private playerLeftHandler?: PlayerEventHandler;

    private connectedPlayers = new Set<string>();

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

        this.socket.onEvent('clientConnected', (id: string) => {
            this.connectedPlayers.add(id);
            this.playerJoinedHandler?.(id);
        });

        this.socket.onEvent('clientDisconnected', (id: string) => {
            this.connectedPlayers.delete(id);
            this.playerLeftHandler?.(id);
        });
    }

    async hostGame(): Promise<string> {
        if (!this.socket) throw new Error('Network not initialized');

        const roomCode = await this.socket.createRoom({
            hostId: this.localPlayerId,
            players: [this.localPlayerId],
            meta: { started: false }
        });

        this.roomCode = roomCode;
        this.isHost = true;
        this.connectedPlayers.add(this.localPlayerId!);

        return roomCode;
    }

    async joinGame(room: string) {
        if (!this.socket) throw new Error('Network not initialized');

        this.roomCode = room;
        this.isHost = false;
        await this.socket.joinRoom(room);

        this.socket.updateStorage(`players.${this.localPlayerId}`, 'set', {
            id: this.localPlayerId,
            joinedAt: Date.now()
        });
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
        this.socket.emitVolatile('state', state);
    }

    // Subscribe to volatile state packets
    onState(handler: (state: any) => void) {
        if (!this.socket) return;
        this.socket.onEvent('state', handler);
    }

    // Subscribe to specific storage keys (way faster than full storage listener)
    onStorageKey(key: string, handler: StorageKeyHandler) {
        this.socket?.onStorageKey(key, handler);
    }

    onPlayerJoined(handler: PlayerEventHandler) {
        this.playerJoinedHandler = handler;
    }

    onPlayerLeft(handler: PlayerEventHandler) {
        this.playerLeftHandler = handler;
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
