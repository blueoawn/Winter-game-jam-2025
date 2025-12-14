/**
 * StateSerializer Tests
 *
 * Tests for delta-based state serialization used in multiplayer sync.
 * The StateSerializer tracks previous state and only sends changes (deltas).
 *
 * Key behaviors to test:
 * - New entities are included in delta
 * - Unchanged entities are NOT included
 * - Removed entities are marked as null
 * - Meta fields only include changed values
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { DeltaSerializer, FullGameState } from './StateSerializer';

// Helper to create a mock syncable entity
function createMockEntity(id: string, x: number, y: number, type: string = 'TestEntity') {
    return {
        id,
        getNetworkState: () => ({
            id,
            type,
            x,
            y,
            netVersion: 1,
            isDead: false,
        }),
    };
}

// Helper to create a full game state for testing
function createGameState(overrides: Partial<FullGameState> = {}): FullGameState {
    return {
        tick: 1,
        players: {},
        enemies: {},
        projectiles: [],
        walls: [],
        score: 0,
        scrollMovement: 0,
        spawnEnemyCounter: 0,
        gameStarted: false,
        ...overrides,
    };
}

describe('DeltaSerializer', () => {
    beforeEach(() => {
        // Reset static state between tests by serializing an empty state
        // This clears the lastPlayers, lastEnemies, etc. caches
        DeltaSerializer.serializeDelta(createGameState());
        DeltaSerializer.serializeDelta(createGameState()); // Second call to ensure clean slate
    });

    describe('serializeDelta', () => {
        it('should include tick and timestamp in every delta', () => {
            const state = createGameState({ tick: 42 });
            const delta = DeltaSerializer.serializeDelta(state);

            expect(delta.tick).toBe(42);
            expect(delta.timestamp).toBeDefined();
            expect(typeof delta.timestamp).toBe('number');
        });

        it('should include new players in delta', () => {
            // First call with no players (baseline)
            DeltaSerializer.serializeDelta(createGameState());

            // Second call adds a player
            const state = createGameState({
                tick: 2,
                players: {
                    'player-1': { id: 'player-1', x: 100, y: 200, health: 100 },
                },
            });

            const delta = DeltaSerializer.serializeDelta(state);

            expect(delta.players).toBeDefined();
            expect(delta.players!['player-1']).toEqual({
                id: 'player-1',
                x: 100,
                y: 200,
                health: 100,
            });
        });

        it('should NOT include unchanged players in delta', () => {
            const player = { id: 'player-1', x: 100, y: 200, health: 100 };

            // First call
            DeltaSerializer.serializeDelta(createGameState({
                tick: 1,
                players: { 'player-1': player },
            }));

            // Second call with same player state
            const delta = DeltaSerializer.serializeDelta(createGameState({
                tick: 2,
                players: { 'player-1': player },
            }));

            // Player should not be in delta since it hasn't changed
            expect(delta.players!['player-1']).toBeUndefined();
        });

        it('should include changed player properties in delta', () => {
            // First call
            DeltaSerializer.serializeDelta(createGameState({
                tick: 1,
                players: {
                    'player-1': { id: 'player-1', x: 100, y: 200, health: 100 },
                },
            }));

            // Second call with moved player
            const delta = DeltaSerializer.serializeDelta(createGameState({
                tick: 2,
                players: {
                    'player-1': { id: 'player-1', x: 150, y: 250, health: 100 },
                },
            }));

            expect(delta.players!['player-1']).toEqual({
                id: 'player-1',
                x: 150,
                y: 250,
                health: 100,
            });
        });

        it('should mark removed players as null', () => {
            // First call with player
            DeltaSerializer.serializeDelta(createGameState({
                tick: 1,
                players: {
                    'player-1': { id: 'player-1', x: 100, y: 200, health: 100 },
                },
            }));

            // Second call without player
            const delta = DeltaSerializer.serializeDelta(createGameState({
                tick: 2,
                players: {},
            }));

            expect(delta.players!['player-1']).toBeNull();
        });

        it('should serialize projectiles from entity array', () => {
            const projectile = createMockEntity('proj-1', 50, 60, 'MagicMissile');

            // First empty state
            DeltaSerializer.serializeDelta(createGameState());

            // Add projectile
            const delta = DeltaSerializer.serializeDelta(createGameState({
                tick: 2,
                projectiles: [projectile as any],
            }));

            expect(delta.projectiles).toBeDefined();
            expect(delta.projectiles!['proj-1']).toEqual({
                id: 'proj-1',
                type: 'MagicMissile',
                x: 50,
                y: 60,
                netVersion: 1,
                isDead: false,
            });
        });

        it('should mark removed projectiles as null', () => {
            const projectile = createMockEntity('proj-1', 50, 60);

            // First state with projectile
            DeltaSerializer.serializeDelta(createGameState({
                tick: 1,
                projectiles: [projectile as any],
            }));

            // Second state without projectile
            const delta = DeltaSerializer.serializeDelta(createGameState({
                tick: 2,
                projectiles: [],
            }));

            expect(delta.projectiles!['proj-1']).toBeNull();
        });

        it('should only include changed meta fields', () => {
            // First state
            DeltaSerializer.serializeDelta(createGameState({
                tick: 1,
                score: 100,
                scrollMovement: 50,
                spawnEnemyCounter: 5,
                gameStarted: true,
            }));

            // Second state with only score changed
            const delta = DeltaSerializer.serializeDelta(createGameState({
                tick: 2,
                score: 150, // Changed
                scrollMovement: 50, // Same
                spawnEnemyCounter: 5, // Same
                gameStarted: true, // Same
            }));

            expect(delta.meta).toBeDefined();
            expect(delta.meta!.score).toBe(150);
            // Unchanged fields should not be in meta
            expect(delta.meta!.scrollMovement).toBeUndefined();
            expect(delta.meta!.spawnEnemyCounter).toBeUndefined();
            expect(delta.meta!.gameStarted).toBeUndefined();
        });

        it('should handle multiple entity types in single delta', () => {
            // Set up initial state
            DeltaSerializer.serializeDelta(createGameState());

            // Add multiple entity types
            const state = createGameState({
                tick: 2,
                players: { 'p1': { id: 'p1', x: 0, y: 0 } },
                enemies: { 'e1': { id: 'e1', x: 100, y: 100 } },
                projectiles: [createMockEntity('proj-1', 50, 50) as any],
                walls: [createMockEntity('wall-1', 200, 200) as any],
            });

            const delta = DeltaSerializer.serializeDelta(state);

            expect(delta.players!['p1']).toBeDefined();
            expect(delta.enemies!['e1']).toBeDefined();
            expect(delta.projectiles!['proj-1']).toBeDefined();
            expect(delta.walls!['wall-1']).toBeDefined();
        });
    });

    describe('edge cases', () => {
        it('should handle empty initial state', () => {
            const delta = DeltaSerializer.serializeDelta(createGameState());

            expect(delta.tick).toBe(1);
            expect(delta.players).toEqual({});
            expect(delta.enemies).toEqual({});
        });

        it('should handle entities with null getNetworkState', () => {
            const badEntity = {
                id: 'bad-1',
                getNetworkState: () => null,
            };

            DeltaSerializer.serializeDelta(createGameState());

            // Should not throw
            const delta = DeltaSerializer.serializeDelta(createGameState({
                tick: 2,
                projectiles: [badEntity as any],
            }));

            expect(delta.projectiles!['bad-1']).toBeUndefined();
        });
    });
});
