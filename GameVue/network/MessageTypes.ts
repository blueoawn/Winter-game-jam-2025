// Message type constants for P2P communication
export const MessageTypes = {
    // Lobby messages
    PLAYER_JOIN: 'PLAYER_JOIN',
    PLAYER_LEAVE: 'PLAYER_LEAVE',
    PLAYER_READY: 'PLAYER_READY',
    START_GAME: 'START_GAME',

    // Game messages
    INPUT: 'INPUT',
    STATE_SYNC: 'STATE_SYNC',

    // Event messages
    EXPLOSION: 'EXPLOSION',
    SCORE_UPDATE: 'SCORE_UPDATE',

    // Connection messages
    PING: 'PING',
    PONG: 'PONG'
} as const;

export type MessageType = typeof MessageTypes[keyof typeof MessageTypes];

export interface Message<T = any> {
    type: MessageType;
    timestamp: number;
    payload: T;
}

// Create a standardized message structure
export function createMessage<T>(type: MessageType, payload: T): Message<T> {
    return {
        type,
        timestamp: Date.now(),
        payload
    };
}

// Validate message structure
export function isValidMessage(message: any): message is Message {
    return (
        message &&
        typeof message === 'object' &&
        message.type &&
        message.timestamp &&
        message.payload !== undefined
    );
}
