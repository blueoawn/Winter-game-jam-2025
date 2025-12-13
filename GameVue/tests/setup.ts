/**
 * Test setup file
 * Runs before each test file
 * Sets up global mocks and test utilities
 */

import { vi } from 'vitest';

// Mock console methods to keep test output clean (optional - comment out to see logs)
// vi.spyOn(console, 'log').mockImplementation(() => {});
// vi.spyOn(console, 'warn').mockImplementation(() => {});
// vi.spyOn(console, 'debug').mockImplementation(() => {});

// Create mock Phaser Scene class
class MockScene {
    add = { existing: vi.fn() };
    scene = { start: vi.fn() };
    scale = { width: 800, height: 600 };
    events = { on: vi.fn(), off: vi.fn(), emit: vi.fn() };
    physics = {
        add: {
            existing: vi.fn(),
            group: vi.fn(() => ({
                add: vi.fn(),
                remove: vi.fn(),
                getChildren: vi.fn(() => []),
            })),
        },
    };
}

// Define Phaser globally so classes can extend Phaser.Scene
(globalThis as any).Phaser = {
    Scene: MockScene,
    Physics: {
        Arcade: {
            Sprite: class MockSprite {
                x = 0;
                y = 0;
                body = { velocity: { x: 0, y: 0 }, setVelocity: vi.fn() };
                setPosition = vi.fn();
                destroy = vi.fn();
            },
            Body: class MockBody {
                velocity = { x: 0, y: 0 };
                setVelocity = vi.fn();
            },
        },
    },
    GameObjects: {
        Sprite: class MockSprite {},
    },
};

// Also mock the phaser module for imports
vi.mock('phaser', () => ({
    default: (globalThis as any).Phaser,
    Scene: MockScene,
}));

// Mock PlaySocketJS
vi.mock('playsocketjs', () => ({
    PlaySocket: class MockPlaySocket {
        storage = new Map();
        onStorageUpdate = vi.fn();
        setStorage = vi.fn();
        getStorage = vi.fn();
        sendRequest = vi.fn();
        connect = vi.fn();
        disconnect = vi.fn();
    },
}));
