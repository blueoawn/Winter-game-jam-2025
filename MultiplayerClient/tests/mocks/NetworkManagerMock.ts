/**
 * Mock NetworkManager for testing
 * Simulates network operations without actual WebSocket connections
 */

import { vi } from 'vitest';

export const mockNetworkManager = {
    socket: null,
    playerId: 'test-player-1',
    roomCode: 'TEST123',
    isHost: false,
    isConnected: false,

    // Core methods
    initialize: vi.fn(),
    hostGame: vi.fn().mockResolvedValue('TEST123'),
    joinGame: vi.fn().mockResolvedValue(true),
    disconnect: vi.fn(),

    // Storage methods
    getStorage: vi.fn(),
    setStorage: vi.fn(),
    onStorageUpdate: vi.fn(),
    onStorageKey: vi.fn(),

    // Request methods
    sendRequest: vi.fn(),
    sendInput: vi.fn(),

    // Reset all mocks
    reset: () => {
        mockNetworkManager.socket = null;
        mockNetworkManager.playerId = 'test-player-1';
        mockNetworkManager.roomCode = 'TEST123';
        mockNetworkManager.isHost = false;
        mockNetworkManager.isConnected = false;

        vi.clearAllMocks();
    },
};

// Default export mimics the singleton pattern used in NetworkManager
export default mockNetworkManager;
