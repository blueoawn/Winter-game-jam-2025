/**
 * Sync.ts Tests
 *
 * Tests for the network synchronization logic that applies delta states
 * from the server to the client game scene.
 *
 * Key behaviors to test:
 * - Host should NOT apply delta state (host is source of truth)
 * - Invalid deltas should be rejected
 * - Stale updates (older ticks) should be skipped
 * - Large tick gaps should trigger snapshot request (desync detection)
 * - Player, enemy, projectile, and wall states should be applied correctly
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { createMockGameScene } from '../tests/mocks/GameSceneMock';

// We need to mock the NetworkManager before importing Sync
vi.mock('../managers/NetworkManager', () => ({
    default: {
        sendRequest: vi.fn(),
    },
}));

// Mock the game object imports to prevent Phaser dependency issues
vi.mock('../src/gameObjects/Projectile/EnemyBullet', () => ({
    default: class MockEnemyBullet {},
}));

vi.mock('../src/gameObjects/NPC/EnemyFlying', () => ({
    default: class MockEnemyFlying {
        constructor() {
            this.x = 0;
            this.y = 0;
        }
        setPosition = vi.fn();
        body = { setVelocity: vi.fn() };
    },
}));

vi.mock('../src/gameObjects/NPC/EnemySlime', () => ({
    default: class MockEnemySlime {},
}));

vi.mock('../src/gameObjects/Projectile/MagicMissile', () => ({
    MagicMissile: class MockMagicMissile {
        id = '';
        updateFromNetworkState = vi.fn();
    },
}));

vi.mock('../src/gameObjects/Projectile/ShotgunPellet', () => ({
    ShotgunPellet: class MockShotgunPellet {
        id = '';
        updateFromNetworkState = vi.fn();
    },
}));

vi.mock('../src/gameObjects/Projectile/NinjaStar', () => ({
    NinjaStar: class MockNinjaStar {
        id = '';
        updateFromNetworkState = vi.fn();
    },
}));

// Now import the functions we're testing
import { applyDeltaState } from './Sync';
import NetworkManager from '../managers/NetworkManager';

describe('Sync', () => {
    let mockScene: ReturnType<typeof createMockGameScene>;

    beforeEach(() => {
        mockScene = createMockGameScene();
        vi.clearAllMocks();
    });

    describe('applyDeltaState', () => {
        it('should NOT apply delta state when scene is host', () => {
            mockScene.isHost = true;
            mockScene.lastReceivedTick = 0;

            const delta = {
                tick: 10,
                timestamp: Date.now(),
                players: { 'p1': { id: 'p1', x: 100, y: 100 } },
            };

            applyDeltaState(mockScene as any, delta);

            // lastReceivedTick should not be updated
            expect(mockScene.lastReceivedTick).toBe(0);
            // playerManager.applyPlayerState should not be called
            expect(mockScene.playerManager.applyPlayerState).not.toHaveBeenCalled();
        });

        it('should reject invalid delta (null)', () => {
            applyDeltaState(mockScene as any, null);

            expect(mockScene.lastReceivedTick).toBe(0);
        });

        it('should reject invalid delta (missing tick)', () => {
            const delta = {
                timestamp: Date.now(),
                players: {},
            };

            applyDeltaState(mockScene as any, delta);

            expect(mockScene.lastReceivedTick).toBe(0);
        });

        it('should reject invalid delta (non-number tick)', () => {
            const delta = {
                tick: 'not-a-number',
                timestamp: Date.now(),
            };

            applyDeltaState(mockScene as any, delta);

            expect(mockScene.lastReceivedTick).toBe(0);
        });

        it('should skip stale updates (tick <= lastReceivedTick)', () => {
            mockScene.lastReceivedTick = 50;

            const delta = {
                tick: 40, // Older than current
                timestamp: Date.now(),
                players: { 'p1': { id: 'p1', x: 100, y: 100 } },
            };

            applyDeltaState(mockScene as any, delta);

            // Should not update lastReceivedTick
            expect(mockScene.lastReceivedTick).toBe(50);
            // Should not apply player state
            expect(mockScene.playerManager.applyPlayerState).not.toHaveBeenCalled();
        });

        it('should update lastReceivedTick on valid delta', () => {
            mockScene.lastReceivedTick = 10;

            const delta = {
                tick: 20,
                timestamp: Date.now(),
            };

            // Make deltaDeserializer return a proper state
            mockScene.deltaDeserializer.applyDelta = vi.fn().mockReturnValue({
                tick: 20,
                timestamp: Date.now(),
                players: {},
                enemies: {},
                projectiles: {},
                walls: {},
                meta: {},
            });

            applyDeltaState(mockScene as any, delta);

            expect(mockScene.lastReceivedTick).toBe(20);
        });

        it('should request snapshot on large tick gap (desync detection)', () => {
            mockScene.lastReceivedTick = 10;

            const delta = {
                tick: 100, // Gap of 90 ticks (> 60 threshold)
                timestamp: Date.now(),
            };

            mockScene.deltaDeserializer.applyDelta = vi.fn().mockReturnValue({
                tick: 100,
                timestamp: Date.now(),
                players: {},
                enemies: {},
                projectiles: {},
                walls: {},
                meta: {},
            });

            applyDeltaState(mockScene as any, delta);

            // Should request snapshot
            expect(NetworkManager.sendRequest).toHaveBeenCalledWith('snapshot');
        });

        it('should NOT request snapshot when lastReceivedTick is 0 (initial state)', () => {
            mockScene.lastReceivedTick = 0;

            const delta = {
                tick: 100,
                timestamp: Date.now(),
            };

            mockScene.deltaDeserializer.applyDelta = vi.fn().mockReturnValue({
                tick: 100,
                timestamp: Date.now(),
                players: {},
                enemies: {},
                projectiles: {},
                walls: {},
                meta: {},
            });

            applyDeltaState(mockScene as any, delta);

            // Should NOT request snapshot on first update
            expect(NetworkManager.sendRequest).not.toHaveBeenCalled();
        });

        it('should apply player states from delta', () => {
            const delta = {
                tick: 10,
                timestamp: Date.now(),
            };

            mockScene.deltaDeserializer.applyDelta = vi.fn().mockReturnValue({
                tick: 10,
                timestamp: Date.now(),
                players: {
                    'p1': { id: 'p1', x: 100, y: 200 },
                    'p2': { id: 'p2', x: 300, y: 400 },
                },
                enemies: {},
                projectiles: {},
                walls: {},
                meta: {},
            });

            applyDeltaState(mockScene as any, delta);

            expect(mockScene.playerManager.applyPlayerState).toHaveBeenCalledWith([
                { id: 'p1', x: 100, y: 200 },
                { id: 'p2', x: 300, y: 400 },
            ]);
        });

        it('should NOT apply player states when players is empty', () => {
            const delta = {
                tick: 10,
                timestamp: Date.now(),
            };

            mockScene.deltaDeserializer.applyDelta = vi.fn().mockReturnValue({
                tick: 10,
                timestamp: Date.now(),
                players: {},
                enemies: {},
                projectiles: {},
                walls: {},
                meta: {},
            });

            applyDeltaState(mockScene as any, delta);

            expect(mockScene.playerManager.applyPlayerState).not.toHaveBeenCalled();
        });

        it('should apply meta state (score, scrollMovement, etc.)', () => {
            const delta = {
                tick: 10,
                timestamp: Date.now(),
            };

            mockScene.deltaDeserializer.applyDelta = vi.fn().mockReturnValue({
                tick: 10,
                timestamp: Date.now(),
                players: {},
                enemies: {},
                projectiles: {},
                walls: {},
                meta: {
                    score: 500,
                    scrollMovement: 100,
                    spawnEnemyCounter: 10,
                    gameStarted: true,
                },
            });

            applyDeltaState(mockScene as any, delta);

            expect(mockScene.score).toBe(500);
            expect(mockScene.scrollMovement).toBe(100);
            expect(mockScene.spawnEnemyCounter).toBe(10);
            expect(mockScene.gameStarted).toBe(true);
            expect(mockScene.scoreText.setText).toHaveBeenCalledWith('Score: 500');
        });

        it('should handle errors gracefully without crashing', () => {
            mockScene.deltaDeserializer.applyDelta = vi.fn().mockImplementation(() => {
                throw new Error('Test error');
            });

            const delta = {
                tick: 10,
                timestamp: Date.now(),
            };

            // Should not throw
            expect(() => applyDeltaState(mockScene as any, delta)).not.toThrow();
        });
    });

    describe('enemy syncing', () => {
        it('should track synced enemies in enemyIdCache', () => {
            const delta = { tick: 10, timestamp: Date.now() };

            mockScene.deltaDeserializer.applyDelta = vi.fn().mockReturnValue({
                tick: 10,
                timestamp: Date.now(),
                players: {},
                enemies: {
                    'enemy-1': { id: 'enemy-1', x: 100, y: 100, enemyType: 'EnemyFlying' },
                    'enemy-2': { id: 'enemy-2', x: 200, y: 200, enemyType: 'EnemyFlying' },
                },
                projectiles: {},
                walls: {},
                meta: {},
            });

            applyDeltaState(mockScene as any, delta);

            expect(mockScene.enemyIdCache.has('enemy-1')).toBe(true);
            expect(mockScene.enemyIdCache.has('enemy-2')).toBe(true);
        });

        it('should call addLizardWizardEnemy for EnemyLizardWizard type', () => {
            const delta = { tick: 10, timestamp: Date.now() };

            mockScene.deltaDeserializer.applyDelta = vi.fn().mockReturnValue({
                tick: 10,
                timestamp: Date.now(),
                players: {},
                enemies: {
                    'enemy-1': { id: 'enemy-1', x: 150, y: 250, enemyType: 'EnemyLizardWizard' },
                },
                projectiles: {},
                walls: {},
                meta: {},
            });

            applyDeltaState(mockScene as any, delta);

            expect(mockScene.addLizardWizardEnemy).toHaveBeenCalledWith(150, 250);
        });

        it('should call addSlimeEnemy for EnemySlime type', () => {
            const delta = { tick: 10, timestamp: Date.now() };

            mockScene.deltaDeserializer.applyDelta = vi.fn().mockReturnValue({
                tick: 10,
                timestamp: Date.now(),
                players: {},
                enemies: {
                    'enemy-1': { id: 'enemy-1', x: 150, y: 250, enemyType: 'EnemySlime' },
                },
                projectiles: {},
                walls: {},
                meta: {},
            });

            applyDeltaState(mockScene as any, delta);

            expect(mockScene.addSlimeEnemy).toHaveBeenCalledWith(150, 250);
        });

        it('should skip null enemy entries (removed enemies)', () => {
            const delta = { tick: 10, timestamp: Date.now() };

            mockScene.deltaDeserializer.applyDelta = vi.fn().mockReturnValue({
                tick: 10,
                timestamp: Date.now(),
                players: {},
                enemies: {
                    'enemy-1': null, // Removed enemy
                },
                projectiles: {},
                walls: {},
                meta: {},
            });

            applyDeltaState(mockScene as any, delta);

            // Should not be in cache since it's null (removed)
            expect(mockScene.enemyIdCache.has('enemy-1')).toBe(false);
        });
    });
});
