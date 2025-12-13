/**
 * Lobby Scene Tests
 *
 * Focused on scene transitions and multiplayer synchronization:
 * - Host can initiate character selection when players connected
 * - All players transition to CharacterSelectScene together
 * - Storage sync triggers scene transitions for non-host players
 */

import { describe, it, expect, beforeEach, vi, type Mock } from 'vitest';

// Mock NetworkManager
vi.mock('../../managers/NetworkManager', () => ({
    default: {
        initialize: vi.fn().mockResolvedValue(undefined),
        hostGame: vi.fn().mockResolvedValue('ABC123'),
        joinGame: vi.fn().mockResolvedValue(true),
        destroy: vi.fn(),
        getStorage: vi.fn().mockReturnValue({ players: [] }),
        getStats: vi.fn().mockReturnValue({ playerId: 'host-id' }),
        getSocket: vi.fn().mockReturnValue({ updateStorage: vi.fn() }),
        onPlayerJoin: vi.fn(),
        onPlayerLeave: vi.fn(),
        onStorageUpdate: vi.fn(),
    },
}));

// Mock LobbyUI
vi.mock('../ui/LobbyUI', () => ({
    LobbyUI: class MockLobbyUI {
        create = vi.fn();
        destroy = vi.fn();
        updateStatus = vi.fn();
        updateRoomCode = vi.fn();
        changeMode = vi.fn();
        updatePlayerList = vi.fn();
        showError = vi.fn();
        lobbyCodeRegex = /^[A-Z1-9]{6}$/;
    },
}));

import { Lobby } from './Lobby';
import NetworkManager from '../../managers/NetworkManager';

function setupMockScene(lobby: Lobby): void {
    Object.defineProperty(lobby, 'scale', { value: { width: 800, height: 600 } });
    (lobby as any).add = {
        text: vi.fn().mockReturnValue({ setOrigin: vi.fn().mockReturnThis(), destroy: vi.fn() }),
        container: vi.fn().mockReturnValue({ add: vi.fn().mockReturnThis(), destroy: vi.fn() }),
        dom: vi.fn().mockReturnValue({ setInteractive: vi.fn().mockReturnThis(), addListener: vi.fn().mockReturnThis(), on: vi.fn().mockReturnThis(), destroy: vi.fn() }),
    };
    (lobby as any).scene = { start: vi.fn(), isActive: vi.fn().mockReturnValue(true) };
    (lobby as any).events = { on: vi.fn(), off: vi.fn(), emit: vi.fn() };
}

describe('Lobby Scene Transitions', () => {
    let lobby: Lobby;

    beforeEach(() => {
        vi.clearAllMocks();
        lobby = new Lobby();
        setupMockScene(lobby);
        (NetworkManager.getStats as Mock).mockReturnValue({ playerId: 'host-id' });
    });

    describe('Host initiating character selection', () => {
        beforeEach(async () => {
            lobby.init({ mode: 'host' });
            await lobby.create();
            (lobby as any).isHost = true;
            (lobby as any).connectedPlayers = ['host-id', 'player-2'];
        });

        it('should transition all players to CharacterSelectScene', () => {
            lobby.onSelectCharacters();

            expect((lobby as any).scene.start).toHaveBeenCalledWith(
                'CharacterSelectScene',
                expect.objectContaining({
                    networkEnabled: true,
                    isHost: true,
                    players: ['host-id', 'player-2'],
                })
            );
        });

        it('should update storage to signal character selection to other players', () => {
            const mockSocket = { updateStorage: vi.fn() };
            (NetworkManager.getSocket as Mock).mockReturnValue(mockSocket);

            lobby.onSelectCharacters();

            expect(mockSocket.updateStorage).toHaveBeenCalledWith(
                'characterSelectionInProgress',
                'set',
                true
            );
        });

        it('should not allow starting with zero players', () => {
            (lobby as any).connectedPlayers = [];

            lobby.onSelectCharacters();

            expect((lobby as any).ui.showError).toHaveBeenCalledWith('Need at least 1 player to proceed');
            expect((lobby as any).scene.start).not.toHaveBeenCalled();
        });
    });

    describe('Non-host player receiving character selection signal', () => {
        beforeEach(async () => {
            lobby.init({ mode: 'join' });
            await lobby.create();
            (lobby as any).isHost = false;
            (lobby as any).connectedPlayers = ['host-id', 'player-2'];
        });

        it('should transition to CharacterSelectScene when storage flag is set', () => {
            lobby.setupStorageHandlers();

            // Simulate storage update from host
            const callback = (NetworkManager.onStorageUpdate as Mock).mock.calls[0][0];
            callback({ players: ['host-id', 'player-2'], characterSelectionInProgress: true });

            expect((lobby as any).scene.start).toHaveBeenCalledWith(
                'CharacterSelectScene',
                expect.objectContaining({
                    networkEnabled: true,
                    isHost: false,
                    players: ['host-id', 'player-2'],
                })
            );
        });

        it('should not transition if characterSelectionInProgress is false', () => {
            lobby.setupStorageHandlers();

            const callback = (NetworkManager.onStorageUpdate as Mock).mock.calls[0][0];
            callback({ players: ['host-id', 'player-2'], characterSelectionInProgress: false });

            expect((lobby as any).scene.start).not.toHaveBeenCalled();
        });
    });

    describe('Player joining and leaving', () => {
        beforeEach(async () => {
            lobby.init({ mode: 'host' });
            await lobby.create();
            vi.clearAllMocks();
        });

        it('should add joining player to list and update UI', async () => {
            await lobby.hostGame();

            const joinCallback = (NetworkManager.onPlayerJoin as Mock).mock.calls[0][0];
            (NetworkManager.getStorage as Mock).mockReturnValue({ players: ['host-id', 'new-player'] });
            joinCallback('new-player');

            expect((lobby as any).connectedPlayers).toContain('new-player');
            expect((lobby as any).ui.updatePlayerList).toHaveBeenCalled();
        });

        it('should remove leaving player from list', async () => {
            (lobby as any).connectedPlayers = ['host-id', 'player-2'];
            await lobby.hostGame();

            const leaveCallback = (NetworkManager.onPlayerLeave as Mock).mock.calls[0][0];
            leaveCallback('player-2');

            expect((lobby as any).connectedPlayers).not.toContain('player-2');
        });
    });

    describe('Back to menu', () => {
        it('should clean up network and return to Start scene', async () => {
            lobby.init({ mode: 'host' });
            await lobby.create();

            lobby.onBackToMenu();

            expect(NetworkManager.destroy).toHaveBeenCalled();
            expect((lobby as any).scene.start).toHaveBeenCalledWith('Start');
        });
    });
});
