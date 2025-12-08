// Type declarations for PlaySocketJS
declare module 'playsocketjs' {
    export interface PlaySocketOptions {
        endpoint: string;
    }

    export default class PlaySocket {
        constructor(clientId: string, options: PlaySocketOptions);

        init(): Promise<string>;
        createRoom(initialStorage?: any): Promise<string>;
        joinRoom(roomId: string): Promise<void>;
        updateStorage(key: string, operation: 'set' | 'array-add' | 'array-add-unique' | 'array-remove-matching' | 'array-update-matching', value: any, updateValue?: any): void;
        readonly getStorage: any;  // Getter property, not a method
        readonly connectionCount: number;
        readonly isHost: boolean;
        readonly id: string;
        sendRequest(requestName: string, data?: any): void;
        onEvent(eventName: string, handler: (data: any) => void): void;
        destroy(): void;

        // Volatile messaging (undocumented but used in codebase)
        emitVolatile(eventName: string, data: any): void;
        onStorageKey(key: string, handler: (value: any) => void): void;
    }

    export class PlaySocketServer {
        constructor(options?: { port?: number; server?: any; path?: string; debug?: boolean });
        onEvent(eventName: string, handler: (...args: any[]) => void): void;
        getRoomStorage(roomId: string): any;
        updateRoomStorage(roomId: string, key: string, type: 'set' | 'array-add' | 'array-add-unique' | 'array-remove-matching' | 'array-update-matching', value: any, updateValue?: any): void;
        createRoom(initialStorage?: any, size?: number, host?: string): { state: any, id: string };
        destroyRoom(roomId: string): void;
        kick(clientId: string, reason?: string): void;
        stop(): void;

        // Volatile messaging (undocumented but used in codebase)
        emitToRoomVolatile(roomId: string, eventName: string, data: any, options?: { except?: string }): void;
    }
}
