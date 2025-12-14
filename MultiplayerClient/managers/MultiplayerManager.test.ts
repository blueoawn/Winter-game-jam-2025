/**
 * MultiplayerManager (PlayerManager) Tests
 *
 * Tests for the PlayerManager class that handles multiple players
 * in multiplayer games.
 *
 * Key behaviors to test:
 * - Player creation and storage
 * - Local player tracking
 * - Player removal
 * - CPU control conversion
 * - State collection and application
 * - Input handling
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';

// Mock all character classes before importing PlayerManager
vi.mock('../src/gameObjects/Characters/PlayerController.ts', () => ({
    PlayerController: class MockPlayerController {
        x = 0;
        y = 0;
        health = 100;
        rotation = 0;
        frame = { name: 0 };
        playerId = '';
        isLocal = false;
        isCpuControlled = false;
        body = { velocity: { x: 0, y: 0 } };

        destroy = vi.fn();
        applyInput = vi.fn();
        applyState = vi.fn();
        getCurrentInput = vi.fn(() => ({ up: false, down: false, left: false, right: false }));
        enableCpuControl = vi.fn(function(this: any) { this.isCpuControlled = true; });
        disableCpuControl = vi.fn(function(this: any) { this.isCpuControlled = false; });
        update = vi.fn();
    },
}));

vi.mock('../src/gameObjects/Characters/LizardWizard', () => ({
    LizardWizard: class MockLizardWizard {
        x = 0;
        y = 0;
        health = 100;
        rotation = 0;
        frame = { name: 0 };
        playerId = '';
        isLocal = false;
        isCpuControlled = false;
        body = { velocity: { x: 0, y: 0 } };

        destroy = vi.fn();
        applyInput = vi.fn();
        applyState = vi.fn();
        getCurrentInput = vi.fn(() => ({ up: false, down: false, left: false, right: false }));
        enableCpuControl = vi.fn(function(this: any) { this.isCpuControlled = true; });
        disableCpuControl = vi.fn(function(this: any) { this.isCpuControlled = false; });
        update = vi.fn();
    },
}));

vi.mock('../src/gameObjects/Characters/SwordAndBoard', () => ({
    SwordAndBoard: class MockSwordAndBoard {
        x = 0;
        y = 0;
        health = 100;
        rotation = 0;
        frame = { name: 0 };
        playerId = '';
        isLocal = false;
        isCpuControlled = false;
        body = { velocity: { x: 0, y: 0 } };

        destroy = vi.fn();
        applyInput = vi.fn();
        applyState = vi.fn();
        getCurrentInput = vi.fn(() => ({ up: false, down: false, left: false, right: false }));
        enableCpuControl = vi.fn(function(this: any) { this.isCpuControlled = true; });
        disableCpuControl = vi.fn(function(this: any) { this.isCpuControlled = false; });
        update = vi.fn();
    },
}));

vi.mock('../src/gameObjects/Characters/CheeseTouch', () => ({
    CheeseTouch: class MockCheeseTouch {
        x = 0;
        y = 0;
        health = 100;
        rotation = 0;
        frame = { name: 0 };
        playerId = '';
        isLocal = false;
        isCpuControlled = false;
        body = { velocity: { x: 0, y: 0 } };

        destroy = vi.fn();
        applyInput = vi.fn();
        applyState = vi.fn();
        getCurrentInput = vi.fn(() => ({ up: false, down: false, left: false, right: false }));
        enableCpuControl = vi.fn(function(this: any) { this.isCpuControlled = true; });
        disableCpuControl = vi.fn(function(this: any) { this.isCpuControlled = false; });
        update = vi.fn();
    },
}));

vi.mock('../src/gameObjects/Characters/BigSword', () => ({
    BigSword: class MockBigSword {
        x = 0;
        y = 0;
        health = 100;
        rotation = 0;
        frame = { name: 0 };
        playerId = '';
        isLocal = false;
        isCpuControlled = false;
        body = { velocity: { x: 0, y: 0 } };

        destroy = vi.fn();
        applyInput = vi.fn();
        applyState = vi.fn();
        getCurrentInput = vi.fn(() => ({ up: false, down: false, left: false, right: false }));
        enableCpuControl = vi.fn(function(this: any) { this.isCpuControlled = true; });
        disableCpuControl = vi.fn(function(this: any) { this.isCpuControlled = false; });
        update = vi.fn();
    },
}));

vi.mock('../src/behaviorScripts/FollowAndAttack', () => ({
    FollowAndAttackBehavior: class MockBehavior {
        constructor() {}
    },
}));

// Mock CharacterNamesEnum
vi.mock('../src/gameObjects/Characters/CharactersEnum.ts', () => ({
    CharacterNamesEnum: {
        LizardWizard: 'LizardWizard',
        SwordAndBoard: 'SwordAndBoard',
        CheeseTouch: 'CheeseTouch',
        BigSword: 'BigSword',
    },
}));

// Import after mocks are set up
import { PlayerManager } from './MultiplayerManager';
import { CharacterNamesEnum } from '../src/gameObjects/Characters/CharactersEnum';

// Create a mock scene
function createMockScene() {
    return {
        currentMap: {
            spawnPoints: {
                default: { x: 800, y: 1000 },
            },
        },
    } as any;
}

describe('PlayerManager', () => {
    let manager: PlayerManager;
    let mockScene: any;

    beforeEach(() => {
        mockScene = createMockScene();
        manager = new PlayerManager(mockScene);
        vi.clearAllMocks();
    });

    describe('createPlayer', () => {
        it('should create a new player and return it', () => {
            const player = manager.createPlayer('player-1', false, CharacterNamesEnum.LizardWizard);

            expect(player).toBeDefined();
            expect(manager.getPlayer('player-1')).toBe(player);
        });

        it('should return existing player if already created', () => {
            const player1 = manager.createPlayer('player-1', false, CharacterNamesEnum.LizardWizard);
            const player2 = manager.createPlayer('player-1', false, CharacterNamesEnum.LizardWizard);

            expect(player1).toBe(player2);
        });

        it('should mark local player correctly', () => {
            manager.createPlayer('player-1', true, CharacterNamesEnum.LizardWizard);

            const localPlayer = manager.getLocalPlayer();
            expect(localPlayer).not.toBeNull();
            expect((localPlayer as any).playerId).toBe('player-1');
        });

        it('should track player count', () => {
            expect(manager.getPlayerCount()).toBe(0);

            manager.createPlayer('player-1', false, CharacterNamesEnum.LizardWizard);
            expect(manager.getPlayerCount()).toBe(1);

            manager.createPlayer('player-2', false, CharacterNamesEnum.SwordAndBoard);
            expect(manager.getPlayerCount()).toBe(2);
        });

        it('should create different character types', () => {
            const lizard = manager.createPlayer('p1', false, CharacterNamesEnum.LizardWizard);
            const sword = manager.createPlayer('p2', false, CharacterNamesEnum.SwordAndBoard);
            const cheese = manager.createPlayer('p3', false, CharacterNamesEnum.CheeseTouch);
            const bigSword = manager.createPlayer('p4', false, CharacterNamesEnum.BigSword);

            expect(lizard).toBeDefined();
            expect(sword).toBeDefined();
            expect(cheese).toBeDefined();
            expect(bigSword).toBeDefined();
            expect(manager.getPlayerCount()).toBe(4);
        });
    });

    describe('removePlayer', () => {
        it('should remove player and call destroy', () => {
            const player = manager.createPlayer('player-1', false, CharacterNamesEnum.LizardWizard);

            manager.removePlayer('player-1');

            expect(manager.getPlayer('player-1')).toBeUndefined();
            expect(player.destroy).toHaveBeenCalled();
        });

        it('should handle removing non-existent player gracefully', () => {
            // Should not throw
            expect(() => manager.removePlayer('non-existent')).not.toThrow();
        });
    });

    describe('CPU control', () => {
        it('should convert player to CPU control', () => {
            const player = manager.createPlayer('player-1', false, CharacterNamesEnum.LizardWizard);

            const result = manager.convertToCpu('player-1');

            expect(result).toBe(true);
            expect(player.enableCpuControl).toHaveBeenCalled();
        });

        it('should return false when converting non-existent player', () => {
            const result = manager.convertToCpu('non-existent');

            expect(result).toBe(false);
        });

        it('should return true when player is already CPU controlled', () => {
            const player = manager.createPlayer('player-1', false, CharacterNamesEnum.LizardWizard);
            (player as any).isCpuControlled = true;

            const result = manager.convertToCpu('player-1');

            expect(result).toBe(true);
        });

        it('should restore player from CPU control', () => {
            const player = manager.createPlayer('player-1', false, CharacterNamesEnum.LizardWizard);
            manager.convertToCpu('player-1');

            const result = manager.restoreFromCpu('player-1');

            expect(result).toBe(true);
            expect(player.disableCpuControl).toHaveBeenCalled();
        });

        it('should check if player is CPU controlled', () => {
            manager.createPlayer('player-1', false, CharacterNamesEnum.LizardWizard);

            expect(manager.isCpuControlled('player-1')).toBe(false);

            manager.convertToCpu('player-1');

            expect(manager.isCpuControlled('player-1')).toBe(true);
        });
    });

    describe('player state', () => {
        it('should collect player states for all players', () => {
            manager.createPlayer('player-1', false, CharacterNamesEnum.LizardWizard);
            manager.createPlayer('player-2', false, CharacterNamesEnum.SwordAndBoard);

            const states = manager.collectPlayerStates();

            expect(states).toHaveLength(2);
            expect(states.find(s => s.id === 'player-1')).toBeDefined();
            expect(states.find(s => s.id === 'player-2')).toBeDefined();
        });

        it('should include position, velocity, health in collected state', () => {
            const player = manager.createPlayer('player-1', false, CharacterNamesEnum.LizardWizard);
            player.x = 100;
            player.y = 200;
            player.health = 75;
            (player as any).body = { velocity: { x: 50, y: -30 } };

            const states = manager.collectPlayerStates();

            expect(states[0].x).toBe(100);
            expect(states[0].y).toBe(200);
            expect(states[0].health).toBe(75);
            expect(states[0].velocityX).toBe(50);
            expect(states[0].velocityY).toBe(-30);
        });

        it('should apply player states to existing players', () => {
            const player = manager.createPlayer('player-1', false, CharacterNamesEnum.LizardWizard);

            const states = [
                { id: 'player-1', x: 500, y: 600, health: 50 },
            ];

            manager.applyPlayerState(states);

            expect(player.applyState).toHaveBeenCalledWith(states[0]);
        });

        it('should handle applyPlayerState with non-array gracefully', () => {
            // Should not throw
            expect(() => manager.applyPlayerState(null as any)).not.toThrow();
            expect(() => manager.applyPlayerState({} as any)).not.toThrow();
        });

        it('should skip invalid player states', () => {
            manager.createPlayer('player-1', false, CharacterNamesEnum.LizardWizard);

            const states = [
                null,
                { x: 100, y: 200 }, // Missing id
                { id: 'player-1', x: 100, y: 200 },
            ];

            // Should not throw
            expect(() => manager.applyPlayerState(states as any)).not.toThrow();
        });
    });

    describe('input handling', () => {
        it('should apply input to specific player', () => {
            const player = manager.createPlayer('player-1', false, CharacterNamesEnum.LizardWizard);

            const input = { up: true, down: false, left: true, right: false };
            manager.applyInput('player-1', input as any);

            expect(player.applyInput).toHaveBeenCalledWith(input);
        });

        it('should collect local input', () => {
            manager.createPlayer('player-1', true, CharacterNamesEnum.LizardWizard);

            const input = manager.collectLocalInput();

            expect(input).toBeDefined();
        });

        it('should return null when no local player exists', () => {
            const input = manager.collectLocalInput();

            expect(input).toBeNull();
        });
    });

    describe('utility methods', () => {
        it('should get all players as array', () => {
            manager.createPlayer('player-1', false, CharacterNamesEnum.LizardWizard);
            manager.createPlayer('player-2', false, CharacterNamesEnum.SwordAndBoard);

            const players = manager.getAllPlayers();

            expect(players).toHaveLength(2);
        });

        it('should get all player IDs', () => {
            manager.createPlayer('player-1', false, CharacterNamesEnum.LizardWizard);
            manager.createPlayer('player-2', false, CharacterNamesEnum.SwordAndBoard);

            const ids = manager.getAllPlayerIds();

            expect(ids).toContain('player-1');
            expect(ids).toContain('player-2');
        });

        it('should clear all players', () => {
            const p1 = manager.createPlayer('player-1', true, CharacterNamesEnum.LizardWizard);
            const p2 = manager.createPlayer('player-2', false, CharacterNamesEnum.SwordAndBoard);

            manager.clear();

            expect(manager.getPlayerCount()).toBe(0);
            expect(manager.getLocalPlayer()).toBeNull();
            expect(p1.destroy).toHaveBeenCalled();
            expect(p2.destroy).toHaveBeenCalled();
        });

        it('should update all players', () => {
            const p1 = manager.createPlayer('player-1', false, CharacterNamesEnum.LizardWizard);
            const p2 = manager.createPlayer('player-2', false, CharacterNamesEnum.SwordAndBoard);

            manager.update();

            expect(p1.update).toHaveBeenCalled();
            expect(p2.update).toHaveBeenCalled();
        });
    });
});
