import PlaySocket from 'playsocketjs';

type StorageKeyHandler = (value: any) => void;
type StorageUpdateHandler = (storage: any) => void; //keeping this to keep track of players in lobby until I figure out a better way to do this
type PlayerEventHandler = (playerId: string) => void;
export class NetworkManager {
    private static instance: NetworkManager;

    private socket: PlaySocket | null = null;
    private localPlayerId: string | null = null;
    private roomCode: string | null = null;
    private storageUpdateHandlers: StorageUpdateHandler[] = []; // Changed to array
    private isHost = false;

    private playerJoinedHandler?: PlayerEventHandler;
    private playerLeftHandler?: PlayerEventHandler;

    private connectedPlayers = new Set<string>();
    private storage: any = null;
    private heartbeatInterval: NodeJS.Timeout | null = null;
    private storageListenerAttached = false;

    private constructor() {}

    static getInstance(): NetworkManager {
        if (!NetworkManager.instance) {
            NetworkManager.instance = new NetworkManager();
        }
        return NetworkManager.instance;
    }

    async initialize(): Promise<string> {
        const clientId = `player_${Date.now()}_${Math.random().toString(36).slice(2)}`;

        // Use secure WebSocket in production, localhost for development
        const wsEndpoint = window.location.hostname === 'localhost'
            ? 'ws://localhost:3001'
            : `wss://${window.location.host}/ws`;

        this.socket = new PlaySocket(clientId, {
            endpoint: wsEndpoint
        });

        this.localPlayerId = await this.socket.init();

        this.registerCoreEvents();
        this.startHeartbeat();

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

    private startHeartbeat() {
        if (this.heartbeatInterval) {
            clearInterval(this.heartbeatInterval);
        }

        // Send heartbeat every 10 seconds (server timeout is 30 seconds)
        this.heartbeatInterval = setInterval(() => {
            if (this.socket) {
                this.socket.sendRequest('heartbeat');
            }
        }, 10000);
    }

    private stopHeartbeat() {
        if (this.heartbeatInterval) {
            clearInterval(this.heartbeatInterval);
            this.heartbeatInterval = null;
        }
    }

    async hostGame(): Promise<string> {
        if (!this.socket) throw new Error('Network not initialized');

        try {
            const initialStorage = {
                hostId: this.localPlayerId,
                players: [this.localPlayerId],
                inputs: {},
                characterSelections: {},
                allPlayersReady: false,
                characterSelectionInProgress: false,
                readyToStartGame: false,
                isGameStarted: false,
                startGameData: null,
                lastStateDelta: null,
                meta: { started: false }
            };

            const roomCode = await this.socket.createRoom(initialStorage);

            this.roomCode = roomCode;
            this.isHost = true;
            this.storage = initialStorage;
            this.connectedPlayers.add(this.localPlayerId!);

            // Attach storage listener early to capture all updates
            this.attachStorageListener();

            console.log('Hosting game with room code:', roomCode);
            return roomCode;
        } catch (error) {
            console.error('Failed to create room:', error);
            throw error;
        }
    }

    // Attach storage listener early to capture all storage updates
    private attachStorageListener() {
        if (!this.storageListenerAttached && this.socket) {
            console.debug('[NetworkManager] Attaching storageUpdated listener');
            this.socket.onEvent('storageUpdated', (storage: any) => {
                this.storage = storage;
                for (const h of this.storageUpdateHandlers) {
                    h(storage);
                }
            });
            this.storageListenerAttached = true;
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

            // Attach storage listener early to capture all updates
            this.attachStorageListener();

            // Add self to players list in storage
            this.socket.updateStorage('players', 'array-add-unique', this.localPlayerId);

            console.log('Successfully joined room');
        } catch (error) {
            console.error('Failed to join room:', error);
            throw error;
        }
    }

    // (Deprecated) updatePlayerInput removed - use sendInput which includes seq

    // (Removed duplicate joinGame)

    // Send input update (adds seq and timestamp)
    sendInput(input: any) {
        if (!this.socket) {
            console.warn(`[NetworkManager] sendInput: socket is null! NetworkManager not properly initialized`);
            return;
        }
        if (!this.localPlayerId) {
            console.warn(`[NetworkManager] sendInput: localPlayerId is null!`);
            return;
        }

        // Initialize seq counter if missing
        if ((this as any).inputSeq === undefined) {
            (this as any).inputSeq = 0;
        }
        const seq = ++(this as any).inputSeq;

        const payload = {
            ...input,
            t: Date.now(),
            seq
        };

        this.socket.updateStorage(`inputs.${this.localPlayerId}`, 'set', payload);
    }


    // Volatile state broadcasting (host)
    sendVolatileState(state: any) {
        if (!this.isHost || !this.socket) return;
        // Use sendRequest to transmit delta state to server
        // Server will re-broadcast to other clients via storage or other mechanism
        this.sendRequest('state', state);
    }

    // Subscribe to storage updates and filter by changes
    onStorageKey(key: string, handler: StorageKeyHandler) {
        if (!this.socket) {
            console.warn(`[NetworkManager] onStorageKey called but socket not ready for key: ${key}`);
            return;
        }
        
        //console.log(`[NetworkManager] Registering listener for storage key: ${key}`); //Debug
        
        // Listen to all storage updates and call handler when the specific key changes
        this.socket.onEvent('storageUpdated', (storage: any) => {
            if (storage && storage[key] !== undefined) {
                //console.log(`[NetworkManager] Storage key "${key}" updated:`, storage[key]); //Debug
                handler(storage[key]);
            }
        });
    }

    // Listen for general storage updates
    onStorageUpdate(handler: StorageUpdateHandler) {
        // Add handler to list instead of replacing
        this.storageUpdateHandlers.push(handler);

        // If we already have storage, invoke immediately
        if (this.storage) {
            handler(this.storage);
        }

        // Attach listener if not already attached (fallback for late registration)
        this.attachStorageListener();
    }

    // Stop listening to storage updates
    offStorageUpdate() {
        this.storageUpdateHandlers = [];
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
        // Return the locally tracked storage which is updated via storageUpdated events
        // This ensures we get the most up-to-date storage including updates from other clients
        if (this.storage) {
            return this.storage;
        }
        // Fallback to socket's internal storage if local storage not yet initialized
        if (this.socket) {
            return this.socket.getStorage;
        }
        return null;
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
        if (!this.socket) {
            console.error(`[NetworkManager] sendRequest: socket is null! Cannot send ${requestName}`);
            return;
        }
        console.debug(`[NetworkManager] Sending request: ${requestName}`);
        this.socket.sendRequest(requestName, data);
    }

    destroy() {
        this.stopHeartbeat();
        this.socket?.destroy();
        this.socket = null;
        this.connectedPlayers.clear();
        this.roomCode = null;
        this.localPlayerId = null;
        this.isHost = false;
        this.storageListenerAttached = false;
        this.storageUpdateHandlers = [];
    }
}

// Lazy singleton export - prevents early instantiation before initialize() is called
let instanceExport: NetworkManager | null = null;

export default {
    getInstance(): NetworkManager {
        if (!instanceExport) {
            instanceExport = NetworkManager.getInstance();
        }
        return instanceExport;
    },
    // Proxy common methods for convenience
    initialize: (...args: any[]) => NetworkManager.getInstance().initialize(...args),
    hostGame: (...args: any[]) => NetworkManager.getInstance().hostGame(...args),
    joinGame: (...args: any[]) => NetworkManager.getInstance().joinGame(...args),
    sendInput: (...args: any[]) => NetworkManager.getInstance().sendInput(...args),
    sendRequest: (...args: any[]) => NetworkManager.getInstance().sendRequest(...args),
    sendVolatileState: (...args: any[]) => NetworkManager.getInstance().sendVolatileState(...args),
    onStorageKey: (...args: any[]) => NetworkManager.getInstance().onStorageKey(...args),
    onStorageUpdate: (...args: any[]) => NetworkManager.getInstance().onStorageUpdate(...args),
    offStorageUpdate: (...args: any[]) => NetworkManager.getInstance().offStorageUpdate(...args),
    onPlayerJoined: (...args: any[]) => NetworkManager.getInstance().onPlayerJoined(...args),
    onPlayerLeft: (...args: any[]) => NetworkManager.getInstance().onPlayerLeft(...args),
    onPlayerJoin: (...args: any[]) => NetworkManager.getInstance().onPlayerJoin(...args),
    onPlayerLeave: (...args: any[]) => NetworkManager.getInstance().onPlayerLeave(...args),
    getPlayerId: (...args: any[]) => NetworkManager.getInstance().getPlayerId(...args),
    getRoomCode: (...args: any[]) => NetworkManager.getInstance().getRoomCode(...args),
    getConnectedPlayers: (...args: any[]) => NetworkManager.getInstance().getConnectedPlayers(...args),
    getIsHost: (...args: any[]) => NetworkManager.getInstance().getIsHost(...args),
    getStorage: (...args: any[]) => NetworkManager.getInstance().getStorage(...args),
    getStats: (...args: any[]) => NetworkManager.getInstance().getStats(...args),
    getSocket: (...args: any[]) => NetworkManager.getInstance().getSocket(...args),
    destroy: (...args: any[]) => NetworkManager.getInstance().destroy(...args)
} as any;

