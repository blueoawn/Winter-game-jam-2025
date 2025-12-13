/**
 * CharacterSelectScene Tests
 *
 * Tests for multiplayer character selection and game transition:
 * - Host sees "Start Game" when all players have selected
 * - Host clicking start triggers transition for all players
 * - Non-host players transition when they receive the storage signal
 */

import { describe, it, expect, beforeEach, vi, type Mock } from 'vitest';

// Mock NetworkManager
vi.mock('../../managers/NetworkManager', () => ({
    default: {
        initialize: vi.fn().mockResolvedValue(undefined),
        getStorage: vi.fn().mockReturnValue({ characterSelections: {} }),
        getSocket: vi.fn().mockReturnValue({ updateStorage: vi.fn() }),
        getPlayerId: vi.fn().mockReturnValue('host-id'),
        onStorageUpdate: vi.fn(),
        offStorageUpdate: vi.fn(),
    },
}));

import { CharacterSelectScene } from './CharacterSelect';
import NetworkManager from '../../managers/NetworkManager';

function setupMockScene(scene: CharacterSelectScene): void {
    Object.defineProperty(scene, 'scale', { value: { width: 800, height: 600 } });

    const mockText = {
        setOrigin: vi.fn().mockReturnThis(),
        setText: vi.fn().mockReturnThis(),
        setColor: vi.fn().mockReturnThis(),
        setInteractive: vi.fn().mockReturnThis(),
        setScale: vi.fn().mockReturnThis(),
        setAlpha: vi.fn().mockReturnThis(),
        on: vi.fn().mockReturnThis(),
        destroy: vi.fn(),
    };

    const mockRect = {
        setStrokeStyle: vi.fn().mockReturnThis(),
        setFillStyle: vi.fn().mockReturnThis(),
        setInteractive: vi.fn().mockReturnThis(),
        on: vi.fn().mockReturnThis(),
        destroy: vi.fn(),
    };

    const mockContainer = {
        add: vi.fn().mockReturnThis(),
        setDepth: vi.fn().mockReturnThis(),
        setPosition: vi.fn().mockReturnThis(),
        setScale: vi.fn().mockReturnThis(),
        setAlpha: vi.fn().mockReturnThis(),
        setData: vi.fn().mockReturnThis(),
        getData: vi.fn().mockReturnValue(mockRect),
        destroy: vi.fn(),
    };

    (scene as any).add = {
        text: vi.fn().mockReturnValue(mockText),
        rectangle: vi.fn().mockReturnValue(mockRect),
        container: vi.fn().mockReturnValue(mockContainer),
        image: vi.fn().mockReturnValue({ setDisplaySize: vi.fn().mockReturnThis(), setTint: vi.fn(), setAlpha: vi.fn() }),
    };

    (scene as any).scene = { start: vi.fn(), isActive: vi.fn().mockReturnValue(true) };
    (scene as any).events = { on: vi.fn(), off: vi.fn(), emit: vi.fn() };
    (scene as any).input = { keyboard: { on: vi.fn() } };
    (scene as any).tweens = { add: vi.fn() };
    (scene as any).time = { delayedCall: vi.fn() };
    (scene as any).textures = { exists: vi.fn().mockReturnValue(false) };

    // Mock the UI elements that get created
    (scene as any).startButton = mockText;
    (scene as any).startButtonBg = mockRect;
    (scene as any).playerStatusText = mockText;
}

describe('CharacterSelectScene Multiplayer Flow', () => {
    let scene: CharacterSelectScene;

    beforeEach(() => {
        vi.clearAllMocks();

        // Mock localStorage
        const storage: Record<string, string> = {};
        vi.stubGlobal('localStorage', {
            getItem: vi.fn((key) => storage[key] || null),
            setItem: vi.fn((key, value) => { storage[key] = value; }),
        });

        scene = new CharacterSelectScene();
        setupMockScene(scene);
    });

    describe('Host with all players ready', () => {
        beforeEach(() => {
            scene.init({
                networkEnabled: true,
                isHost: true,
                players: ['host-id', 'player-2'],
            });
            scene.create();

            // Simulate both players selecting characters
            (scene as any).characterSelections.set('host-id', { characterId: 'lizard-wizard', ready: true });
            (scene as any).characterSelections.set('player-2', { characterId: 'sword-and-board', ready: true });
            (scene as any).selectedCharacterId = 'lizard-wizard';
        });

        it('should detect all players are ready', () => {
            const allReady = (scene as any).checkAllPlayersReady();
            expect(allReady).toBe(true);
        });

        it('should update storage with readyToStartGame when host clicks start', () => {
            const mockSocket = { updateStorage: vi.fn() };
            (NetworkManager.getSocket as Mock).mockReturnValue(mockSocket);

            (scene as any).onStartButtonClick();

            expect(mockSocket.updateStorage).toHaveBeenCalledWith('readyToStartGame', 'set', true);
        });

        it('should transition to GameScene with correct data', () => {
            (scene as any).transitionToGameScene();

            expect((scene as any).scene.start).toHaveBeenCalledWith('GameScene', {
                characterId: 'lizard-wizard',
                networkEnabled: true,
                isHost: true,
                players: ['host-id', 'player-2'],
            });
        });
    });

    describe('Host with players not ready', () => {
        beforeEach(() => {
            scene.init({
                networkEnabled: true,
                isHost: true,
                players: ['host-id', 'player-2'],
            });
            scene.create();

            // Only host has selected
            (scene as any).characterSelections.set('host-id', { characterId: 'lizard-wizard', ready: true });
            (scene as any).selectedCharacterId = 'lizard-wizard';
        });

        it('should detect not all players are ready', () => {
            const allReady = (scene as any).checkAllPlayersReady();
            expect(allReady).toBe(false);
        });

        it('should not transition when clicking start if not all ready', () => {
            const mockSocket = { updateStorage: vi.fn() };
            (NetworkManager.getSocket as Mock).mockReturnValue(mockSocket);

            (scene as any).onStartButtonClick();

            expect(mockSocket.updateStorage).not.toHaveBeenCalledWith('readyToStartGame', 'set', true);
            expect((scene as any).scene.start).not.toHaveBeenCalled();
        });
    });

    describe('Non-host player receiving start signal', () => {
        beforeEach(() => {
            scene.init({
                networkEnabled: true,
                isHost: false,
                players: ['host-id', 'player-2'],
            });
            (NetworkManager.getPlayerId as Mock).mockReturnValue('player-2');
            scene.create();

            // Player has selected their character
            (scene as any).selectedCharacterId = 'sword-and-board';
        });

        it('should transition to GameScene when storage readyToStartGame is true', () => {
            (scene as any).setupStorageHandlers();

            // Simulate storage update from host
            const callback = (NetworkManager.onStorageUpdate as Mock).mock.calls[0][0];
            callback({
                characterSelections: {
                    'host-id': { characterId: 'lizard-wizard', ready: true },
                    'player-2': { characterId: 'sword-and-board', ready: true },
                },
                readyToStartGame: true
            });

            expect((scene as any).scene.start).toHaveBeenCalledWith('GameScene', {
                characterId: 'sword-and-board',
                networkEnabled: true,
                isHost: false,
                players: ['host-id', 'player-2'],
            });
        });

        it('should not transition if readyToStartGame is false', () => {
            (scene as any).setupStorageHandlers();

            const callback = (NetworkManager.onStorageUpdate as Mock).mock.calls[0][0];
            callback({
                characterSelections: {},
                readyToStartGame: false
            });

            expect((scene as any).scene.start).not.toHaveBeenCalled();
        });

        it('should not transition if no character selected', () => {
            (scene as any).selectedCharacterId = null;
            (scene as any).setupStorageHandlers();

            const callback = (NetworkManager.onStorageUpdate as Mock).mock.calls[0][0];
            callback({ readyToStartGame: true });

            expect((scene as any).scene.start).not.toHaveBeenCalled();
        });
    });

    describe('Character selection sync', () => {
        beforeEach(() => {
            scene.init({
                networkEnabled: true,
                isHost: true,
                players: ['host-id', 'player-2'],
            });
            scene.create();
        });

        it('should update character selections from storage updates', () => {
            (scene as any).setupStorageHandlers();

            const callback = (NetworkManager.onStorageUpdate as Mock).mock.calls[0][0];
            callback({
                characterSelections: {
                    'host-id': { characterId: 'lizard-wizard', ready: true },
                    'player-2': { characterId: 'cheese-touch', ready: true },
                },
            });

            expect((scene as any).characterSelections.get('player-2')).toEqual({
                characterId: 'cheese-touch',
                ready: true,
            });
        });

        it('should broadcast character selection to storage when player selects', () => {
            const mockSocket = { updateStorage: vi.fn() };
            (NetworkManager.getSocket as Mock).mockReturnValue(mockSocket);
            (NetworkManager.getPlayerId as Mock).mockReturnValue('host-id');
            (NetworkManager.getStorage as Mock).mockReturnValue({ characterSelections: {} });

            // Simulate selecting a character (bypass the unlock check)
            (scene as any).unlockedCharacters.add('lizard-wizard');
            (scene as any).selectCharacter('lizard-wizard');

            expect(mockSocket.updateStorage).toHaveBeenCalledWith(
                'characterSelections',
                'set',
                expect.objectContaining({
                    'host-id': expect.objectContaining({
                        characterId: 'lizard-wizard',
                        ready: true,
                    }),
                })
            );
        });
    });

    describe('Transition guard', () => {
        it('should prevent duplicate transitions', () => {
            scene.init({
                networkEnabled: true,
                isHost: true,
                players: ['host-id'],
            });
            scene.create();
            (scene as any).selectedCharacterId = 'lizard-wizard';

            // First transition
            (scene as any).transitionToGameScene();
            expect((scene as any).scene.start).toHaveBeenCalledTimes(1);

            // Second transition attempt should be blocked
            (scene as any).transitionToGameScene();
            expect((scene as any).scene.start).toHaveBeenCalledTimes(1);
        });
    });
});
