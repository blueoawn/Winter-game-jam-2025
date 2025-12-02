import Peer, { DataConnection } from 'peerjs';
import { MessageTypes, createMessage, isValidMessage, MessageType } from './MessageTypes';

type MessageHandler = (fromPeerId: string, payload: any) => void;
type PlayerJoinHandler = (playerId: string) => void;
type PlayerLeaveHandler = (playerId: string) => void;
type ConnectionErrorHandler = (playerId: string, error: Error) => void;

interface ConnectionHandlers {
    onPlayerJoin: PlayerJoinHandler | null;
    onPlayerLeave: PlayerLeaveHandler | null;
    onConnectionError: ConnectionErrorHandler | null;
}

interface NetworkStats {
    isHost: boolean;
    playerId: string | null;
    roomCode: string | null;
    connectedPlayers: number;
    isConnected: boolean;
}

// Singleton NetworkManager for P2P communication
class NetworkManager {
    private static instance: NetworkManager;

    private peer: Peer | null = null;
    private connections: Map<string, DataConnection> = new Map();
    private isHost: boolean = false;
    private hostConnection: DataConnection | null = null;
    private localPlayerId: string | null = null;
    private roomCode: string | null = null;
    private messageHandlers: Map<MessageType, MessageHandler> = new Map();
    private connectionHandlers: ConnectionHandlers = {
        onPlayerJoin: null,
        onPlayerLeave: null,
        onConnectionError: null
    };

    constructor() {
        if (NetworkManager.instance) {
            return NetworkManager.instance;
        }

        NetworkManager.instance = this;
    }

    // Initialize PeerJS with public server
    async initialize(): Promise<string> {
        return new Promise((resolve, reject) => {
            try {
                // Use public PeerJS cloud server
                this.peer = new Peer(undefined, {
                    host: '0.peerjs.com',
                    port: 443,
                    path: '/',
                    secure: true,
                    debug: 2  // Enable debug logging
                });

                this.peer.on('open', (id: string) => {
                    console.log('PeerJS initialized with ID:', id);
                    console.log('Peer is open and ready');
                    this.localPlayerId = id;
                    resolve(id);
                });

                this.peer.on('error', (error: Error) => {
                    console.error('PeerJS error:', error);
                    reject(error);
                });

                // Listen for incoming connections (host only)
                this.peer.on('connection', (conn: DataConnection) => {
                    console.log('!!! Peer received connection event from:', conn.peer);
                    this.handleIncomingConnection(conn);
                });

                console.log('PeerJS connection listener registered');

            } catch (error) {
                console.error('Failed to initialize PeerJS:', error);
                reject(error);
            }
        });
    }

    // Host a new game session
    hostGame(): string {
        if (!this.peer) {
            throw new Error('NetworkManager not initialized');
        }

        if (!this.peer.open) {
            throw new Error('Peer connection not open yet');
        }

        this.isHost = true;
        this.roomCode = this.generateRoomCode(this.localPlayerId!);
        console.log('Hosting game with room code:', this.roomCode);
        console.log('Host peer is ready to accept connections');

        return this.roomCode;
    }

    // Join an existing game session
    async joinGame(roomCode: string): Promise<DataConnection> {
        if (!this.peer) {
            throw new Error('NetworkManager not initialized');
        }

        if (!this.peer.open) {
            throw new Error('Peer not ready yet');
        }

        this.isHost = false;
        this.roomCode = roomCode;

        const hostPeerId = this.parseRoomCode(roomCode);
        console.log('Joining game, connecting to host:', hostPeerId);
        console.log('My peer ID:', this.localPlayerId);

        return new Promise((resolve, reject) => {
            try {
                console.log('Attempting to connect...');
                const conn = this.peer!.connect(hostPeerId, {
                    reliable: true,
                    serialization: 'json'
                });

                console.log('Connection object created:', conn);

                conn.on('open', () => {
                    console.log('✓ Connected to host successfully!');
                    this.hostConnection = conn;
                    this.setupConnectionHandlers(conn);

                    // Send join message
                    this.sendToHost(MessageTypes.PLAYER_JOIN, {
                        playerId: this.localPlayerId
                    });

                    resolve(conn);
                });

                conn.on('error', (error: Error) => {
                    console.error('✗ Connection error:', error);
                    reject(error);
                });

                conn.on('close', () => {
                    console.log('Connection closed');
                });

            } catch (error) {
                console.error('✗ Failed to create connection:', error);
                reject(error);
            }
        });
    }

    // Handle incoming connection (host receives client connection)
    private handleIncomingConnection(conn: DataConnection): void {
        console.log('Incoming connection from:', conn.peer);

        conn.on('open', () => {
            console.log('Connection opened with:', conn.peer);
            this.connections.set(conn.peer, conn);
            this.setupConnectionHandlers(conn);

            // Notify game of new player
            if (this.connectionHandlers.onPlayerJoin) {
                this.connectionHandlers.onPlayerJoin(conn.peer);
            }
        });

        conn.on('error', (err: Error) => {
            console.error('Connection error with peer:', conn.peer, err);
        });
    }

    // Set up handlers for a connection
    private setupConnectionHandlers(conn: DataConnection): void {
        conn.on('data', (data: any) => {
            this.handleMessage(conn.peer, data);
        });

        conn.on('close', () => {
            console.log('Connection closed:', conn.peer);
            this.connections.delete(conn.peer);

            if (this.connectionHandlers.onPlayerLeave) {
                this.connectionHandlers.onPlayerLeave(conn.peer);
            }
        });

        conn.on('error', (error: Error) => {
            console.error('Connection error:', conn.peer, error);
            if (this.connectionHandlers.onConnectionError) {
                this.connectionHandlers.onConnectionError(conn.peer, error);
            }
        });
    }

    // Handle received message
    private handleMessage(fromPeerId: string, data: any): void {
        if (!isValidMessage(data)) {
            console.warn('Invalid message received:', data);
            return;
        }

        // Call registered handler for this message type
        const handler = this.messageHandlers.get(data.type);
        if (handler) {
            handler(fromPeerId, data.payload);
        }
    }

    // Register a message handler
    onMessage(messageType: MessageType, handler: MessageHandler): void {
        this.messageHandlers.set(messageType, handler);
    }

    // Register connection event handlers
    onPlayerJoin(handler: PlayerJoinHandler): void {
        this.connectionHandlers.onPlayerJoin = handler;
    }

    onPlayerLeave(handler: PlayerLeaveHandler): void {
        this.connectionHandlers.onPlayerLeave = handler;
    }

    onConnectionError(handler: ConnectionErrorHandler): void {
        this.connectionHandlers.onConnectionError = handler;
    }

    // Send message to host (client only)
    sendToHost(messageType: MessageType, payload: any): void {
        if (this.isHost) {
            console.warn('Host cannot send to itself');
            return;
        }

        if (!this.hostConnection) {
            console.error('No connection to host');
            return;
        }

        const message = createMessage(messageType, payload);
        this.hostConnection.send(message);
    }

    // Send message to specific peer (host only)
    sendToPeer(peerId: string, messageType: MessageType, payload: any): void {
        if (!this.isHost) {
            console.warn('Only host can send to specific peers');
            return;
        }

        const conn = this.connections.get(peerId);
        if (!conn) {
            console.error('No connection to peer:', peerId);
            return;
        }

        const message = createMessage(messageType, payload);
        conn.send(message);
    }

    // Broadcast message to all connected peers (host only)
    broadcast(messageType: MessageType, payload: any): void {
        if (!this.isHost) {
            console.warn('Only host can broadcast');
            return;
        }

        const message = createMessage(messageType, payload);
        this.connections.forEach((conn) => {
            conn.send(message);
        });
    }

    // Get list of connected player IDs
    getConnectedPlayers(): string[] {
        const players: string[] = this.localPlayerId ? [this.localPlayerId] : [];

        if (this.isHost) {
            // Host: add all connected clients
            this.connections.forEach((conn, peerId) => {
                players.push(peerId);
            });
        } else if (this.hostConnection) {
            // Client: we don't know about other clients directly
            // This will be handled by receiving state from host
        }

        return players;
    }

    // Check if playing solo (no network)
    isSoloPlay(): boolean {
        return this.peer === null;
    }

    // Generate a room code from peer ID
    private generateRoomCode(peerId: string): string {
        // For now, use the full peer ID as the room code
        // In production, you'd use a mapping server for short codes
        return peerId;
    }

    // Parse room code back to peer ID
    private parseRoomCode(roomCode: string): string {
        // Room code IS the peer ID
        return roomCode;
    }

    // Clean up connections
    destroy(): void {
        if (this.peer) {
            this.connections.forEach(conn => conn.close());
            this.peer.destroy();
        }

        this.connections.clear();
        this.peer = null;
        this.isHost = false;
        this.hostConnection = null;
        this.localPlayerId = null;
        this.roomCode = null;
    }

    // Get network stats
    getStats(): NetworkStats {
        return {
            isHost: this.isHost,
            playerId: this.localPlayerId,
            roomCode: this.roomCode,
            connectedPlayers: this.connections.size,
            isConnected: this.peer !== null && this.peer.open
        };
    }
}

// Export singleton instance
export default new NetworkManager();
