/**
 * DeltaDeserializer Tests
 *
 * Tests for reconstructing full game state from delta packets.
 * The DeltaDeserializer maintains accumulated state and applies
 * incremental updates from the server.
 *
 * Key behaviors to test:
 * - New entities are added to accumulated state
 * - Updated entities are overwritten
 * - Null values remove entities from state
 * - Meta fields are accumulated over time
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { DeltaDeserializer } from './DeltaDeserializer';

describe('DeltaDeserializer', () => {
    let deserializer: DeltaDeserializer;

    beforeEach(() => {
        deserializer = new DeltaDeserializer();
    });

    describe('applyDelta', () => {
        it('should return tick and timestamp from delta', () => {
            const delta = {
                tick: 42,
                timestamp: 1234567890,
            };

            const result = deserializer.applyDelta(delta);

            expect(result.tick).toBe(42);
            expect(result.timestamp).toBe(1234567890);
        });

        it('should add new players to state', () => {
            const delta = {
                tick: 1,
                timestamp: Date.now(),
                players: {
                    'player-1': { id: 'player-1', x: 100, y: 200, health: 100 },
                },
            };

            const result = deserializer.applyDelta(delta);

            expect(result.players['player-1']).toEqual({
                id: 'player-1',
                x: 100,
                y: 200,
                health: 100,
            });
        });

        it('should accumulate players across multiple deltas', () => {
            // First delta adds player 1
            deserializer.applyDelta({
                tick: 1,
                timestamp: Date.now(),
                players: {
                    'player-1': { id: 'player-1', x: 100, y: 200 },
                },
            });

            // Second delta adds player 2
            const result = deserializer.applyDelta({
                tick: 2,
                timestamp: Date.now(),
                players: {
                    'player-2': { id: 'player-2', x: 300, y: 400 },
                },
            });

            // Both players should be in state
            expect(result.players['player-1']).toBeDefined();
            expect(result.players['player-2']).toBeDefined();
        });

        it('should update existing player when changed', () => {
            // First delta
            deserializer.applyDelta({
                tick: 1,
                timestamp: Date.now(),
                players: {
                    'player-1': { id: 'player-1', x: 100, y: 200 },
                },
            });

            // Second delta updates player position
            const result = deserializer.applyDelta({
                tick: 2,
                timestamp: Date.now(),
                players: {
                    'player-1': { id: 'player-1', x: 150, y: 250 },
                },
            });

            expect(result.players['player-1'].x).toBe(150);
            expect(result.players['player-1'].y).toBe(250);
        });

        it('should remove player when delta value is null', () => {
            // Add player
            deserializer.applyDelta({
                tick: 1,
                timestamp: Date.now(),
                players: {
                    'player-1': { id: 'player-1', x: 100, y: 200 },
                },
            });

            // Remove player
            const result = deserializer.applyDelta({
                tick: 2,
                timestamp: Date.now(),
                players: {
                    'player-1': null,
                },
            });

            expect(result.players['player-1']).toBeUndefined();
        });

        it('should handle enemies independently from players', () => {
            const delta = {
                tick: 1,
                timestamp: Date.now(),
                players: {
                    'player-1': { id: 'player-1', x: 0, y: 0 },
                },
                enemies: {
                    'enemy-1': { id: 'enemy-1', x: 500, y: 500, health: 50 },
                },
            };

            const result = deserializer.applyDelta(delta);

            expect(result.players['player-1']).toBeDefined();
            expect(result.enemies['enemy-1']).toBeDefined();
            expect(result.enemies['enemy-1'].health).toBe(50);
        });

        it('should accumulate and update meta fields', () => {
            // First delta sets initial meta
            deserializer.applyDelta({
                tick: 1,
                timestamp: Date.now(),
                meta: {
                    score: 100,
                    gameStarted: true,
                },
            });

            // Second delta updates only score
            const result = deserializer.applyDelta({
                tick: 2,
                timestamp: Date.now(),
                meta: {
                    score: 200,
                },
            });

            // Score should be updated, gameStarted should persist
            expect(result.meta.score).toBe(200);
            expect(result.meta.gameStarted).toBe(true);
        });

        it('should handle projectiles', () => {
            const delta = {
                tick: 1,
                timestamp: Date.now(),
                projectiles: {
                    'proj-1': { id: 'proj-1', type: 'MagicMissile', x: 50, y: 60 },
                },
            };

            const result = deserializer.applyDelta(delta);

            expect(result.projectiles['proj-1']).toBeDefined();
            expect(result.projectiles['proj-1'].type).toBe('MagicMissile');
        });

        it('should handle walls', () => {
            const delta = {
                tick: 1,
                timestamp: Date.now(),
                walls: {
                    'wall-1': { id: 'wall-1', type: 'DestructibleWall', x: 200, y: 200 },
                },
            };

            const result = deserializer.applyDelta(delta);

            expect(result.walls['wall-1']).toBeDefined();
        });

        it('should return copies of state (not references)', () => {
            deserializer.applyDelta({
                tick: 1,
                timestamp: Date.now(),
                players: {
                    'player-1': { id: 'player-1', x: 100, y: 200 },
                },
            });

            const result1 = deserializer.applyDelta({ tick: 2, timestamp: Date.now() });
            const result2 = deserializer.applyDelta({ tick: 3, timestamp: Date.now() });

            // Modifying result1 should not affect result2
            result1.players['player-1'].x = 999;

            expect(result2.players['player-1'].x).toBe(100);
        });
    });

    describe('edge cases', () => {
        it('should handle empty delta', () => {
            const result = deserializer.applyDelta({
                tick: 1,
                timestamp: Date.now(),
            });

            expect(result.players).toEqual({});
            expect(result.enemies).toEqual({});
            expect(result.projectiles).toEqual({});
            expect(result.walls).toEqual({});
            expect(result.meta).toEqual({});
        });

        it('should handle delta with empty objects', () => {
            const result = deserializer.applyDelta({
                tick: 1,
                timestamp: Date.now(),
                players: {},
                enemies: {},
            });

            expect(result.players).toEqual({});
            expect(result.enemies).toEqual({});
        });

        it('should handle removing non-existent entity gracefully', () => {
            // Try to remove entity that was never added
            const result = deserializer.applyDelta({
                tick: 1,
                timestamp: Date.now(),
                players: {
                    'non-existent': null,
                },
            });

            // Should not throw and entity should not exist
            expect(result.players['non-existent']).toBeUndefined();
        });
    });
});
