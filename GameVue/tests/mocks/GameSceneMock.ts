/**
 * Mock GameScene for testing sync functions
 * Provides minimal implementation needed for network sync tests
 */

import { vi } from 'vitest';

export function createMockGameScene(overrides: Partial<MockGameScene> = {}): MockGameScene {
    const mockScene: MockGameScene = {
        // Host/client state
        isHost: false,
        lastReceivedTick: 0,

        // Game state
        score: 0,
        scrollMovement: 0,
        spawnEnemyCounter: 0,
        gameStarted: false,

        // UI elements
        scoreText: {
            setText: vi.fn(),
        },

        // Entity caches
        enemyIdCache: new Set<string>(),
        enemyBulletIdCache: new Set<string>(),
        syncedEnemies: new Map(),
        syncedEnemyBullets: new Map(),
        syncedWalls: new Map(),

        // Groups (Phaser physics groups)
        enemyGroup: {
            add: vi.fn(),
            remove: vi.fn(),
            getChildren: vi.fn(() => []),
        },
        enemyBulletGroup: {
            add: vi.fn(),
            remove: vi.fn(),
            getChildren: vi.fn(() => []),
        },
        playerBulletGroup: {
            add: vi.fn(),
            remove: vi.fn(),
            getChildren: vi.fn(() => []),
        },

        // Managers
        playerManager: {
            applyPlayerState: vi.fn(),
            createPlayer: vi.fn(),
            getPlayer: vi.fn(),
            getAllPlayers: vi.fn(() => []),
        },

        // Delta deserializer
        deltaDeserializer: {
            applyDelta: vi.fn((delta) => ({
                tick: delta.tick,
                timestamp: delta.timestamp,
                players: delta.players || {},
                enemies: delta.enemies || {},
                projectiles: delta.projectiles || {},
                walls: delta.walls || {},
                meta: delta.meta || {},
            })),
        },

        // Enemy factory methods
        addLizardWizardEnemy: vi.fn((x, y) => ({
            x,
            y,
            enemyId: '',
            setPosition: vi.fn(),
            destroy: vi.fn(),
        })),
        addSlimeEnemy: vi.fn((x, y) => ({
            x,
            y,
            enemyId: '',
            setPosition: vi.fn(),
            destroy: vi.fn(),
        })),

        // Apply overrides
        ...overrides,
    };

    return mockScene;
}

export interface MockGameScene {
    isHost: boolean;
    lastReceivedTick: number;
    score: number;
    scrollMovement: number;
    spawnEnemyCounter: number;
    gameStarted: boolean;
    scoreText: { setText: ReturnType<typeof vi.fn> };
    enemyIdCache: Set<string>;
    enemyBulletIdCache: Set<string>;
    syncedEnemies: Map<string, any>;
    syncedEnemyBullets: Map<string, any>;
    syncedWalls: Map<string, any>;
    enemyGroup: any;
    enemyBulletGroup: any;
    playerBulletGroup: any;
    playerManager: any;
    deltaDeserializer: any;
    addLizardWizardEnemy: ReturnType<typeof vi.fn>;
    addSlimeEnemy: ReturnType<typeof vi.fn>;
}
