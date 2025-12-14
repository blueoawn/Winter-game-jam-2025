/**
 * LobbyUI Tests
 *
 * Tests for the LobbyUI class that handles the multiplayer lobby interface.
 *
 * Key behaviors tested:
 * - UI element creation
 * - Room code display and updates
 * - Player list rendering
 * - Status message updates
 * - Mode switching (host/join)
 * - Button visibility and interactions
 * - Cleanup on destroy
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { LobbyUI } from './LobbyUI';

// Create mock Phaser text object
function createMockText() {
    return {
        setOrigin: vi.fn().mockReturnThis(),
        setColor: vi.fn().mockReturnThis(),
        setScale: vi.fn().mockReturnThis(),
        setVisible: vi.fn().mockReturnThis(),
        setInteractive: vi.fn().mockReturnThis(),
        disableInteractive: vi.fn().mockReturnThis(),
        setText: vi.fn().mockReturnThis(),
        on: vi.fn().mockReturnThis(),
        destroy: vi.fn(),
        text: 'Mock Text',
        visible: true,
    };
}

// Create mock Phaser container
function createMockContainer() {
    return {
        add: vi.fn().mockReturnThis(),
        destroy: vi.fn(),
        list: [] as any[],
    };
}

// Create mock DOM element
function createMockDomElement() {
    return {
        setInteractive: vi.fn().mockReturnThis(),
        addListener: vi.fn().mockReturnThis(),
        on: vi.fn().mockReturnThis(),
        destroy: vi.fn(),
        visible: true,
        pointerEvents: 'auto',
    };
}

// Create mock Lobby scene
function createMockLobbyScene() {
    const mockText = createMockText();
    const mockContainer = createMockContainer();
    const mockDom = createMockDomElement();

    return {
        scale: { width: 800, height: 600 },
        add: {
            text: vi.fn().mockImplementation(() => {
                const text = createMockText();
                // Track created texts in container if needed
                return text;
            }),
            container: vi.fn().mockImplementation(() => {
                const container = createMockContainer();
                return container;
            }),
            dom: vi.fn().mockReturnValue(mockDom),
        },
        connectToHost: vi.fn(),
        selectCharacters: vi.fn(),
        onBackToMenu: vi.fn(),
    } as any;
}

describe('LobbyUI', () => {
    let lobbyUI: LobbyUI;
    let mockScene: ReturnType<typeof createMockLobbyScene>;

    beforeEach(() => {
        vi.clearAllMocks();
        mockScene = createMockLobbyScene();
        lobbyUI = new LobbyUI(mockScene);
    });

    describe('constructor', () => {
        it('should store reference to lobby scene', () => {
            expect((lobbyUI as any).lobbyScene).toBe(mockScene);
        });

        it('should have lobbyCodeRegex for 6-character codes', () => {
            expect(lobbyUI.lobbyCodeRegex).toBeDefined();
            expect(lobbyUI.lobbyCodeRegex.test('ABC123')).toBe(true);
            expect(lobbyUI.lobbyCodeRegex.test('VALID9')).toBe(true);
        });

        it('should reject invalid lobby codes', () => {
            expect(lobbyUI.lobbyCodeRegex.test('abc123')).toBe(false); // lowercase
            expect(lobbyUI.lobbyCodeRegex.test('AB12')).toBe(false); // too short
            expect(lobbyUI.lobbyCodeRegex.test('ABC1234')).toBe(false); // too long
            expect(lobbyUI.lobbyCodeRegex.test('ABC120')).toBe(false); // contains 0 (zero, not allowed - only 1-9)
        });
    });

    describe('create', () => {
        it('should create title text', () => {
            lobbyUI.create();

            expect(mockScene.add.text).toHaveBeenCalledWith(
                400, // centerX
                50,
                'Multiplayer Lobby',
                expect.any(Object)
            );
        });

        it('should create room code container', () => {
            lobbyUI.create();

            expect(mockScene.add.container).toHaveBeenCalled();
        });

        it('should create room code label', () => {
            lobbyUI.create();

            // Check that text was created for room code label
            const textCalls = mockScene.add.text.mock.calls;
            const labelCall = textCalls.find((call: any[]) =>
                call[2] === 'Enter Room Code:'
            );
            expect(labelCall).toBeDefined();
        });

        it('should create room code input DOM element', () => {
            lobbyUI.create();

            expect(mockScene.add.dom).toHaveBeenCalled();
        });

        it('should create player list container', () => {
            lobbyUI.create();

            // Should create at least 2 containers (roomCode and playerList)
            expect(mockScene.add.container).toHaveBeenCalledTimes(2);
        });

        it('should create status text', () => {
            lobbyUI.create();

            const textCalls = mockScene.add.text.mock.calls;
            // Status text is created with empty string
            const statusCall = textCalls.find((call: any[]) => call[2] === '');
            expect(statusCall).toBeDefined();
        });

        it('should create start button (initially hidden)', () => {
            const elements = lobbyUI.create();

            // Start button should exist
            expect(elements.startButton).toBeDefined();
        });

        it('should create back button', () => {
            const elements = lobbyUI.create();

            expect(elements.backButton).toBeDefined();
        });

        it('should return UIElements object', () => {
            const elements = lobbyUI.create();

            expect(elements).toBeDefined();
            expect(typeof elements).toBe('object');
        });
    });

    describe('updateRoomCode', () => {
        it('should update room code text', () => {
            const elements = lobbyUI.create();
            const mockRoomCodeText = elements.roomCodeText;

            lobbyUI.updateRoomCode('XYZ789');

            expect(mockRoomCodeText?.setText).toHaveBeenCalledWith('XYZ789');
        });

        it('should handle missing roomCodeText gracefully', () => {
            // Don't create UI first
            expect(() => lobbyUI.updateRoomCode('ABC123')).not.toThrow();
        });
    });

    describe('updateStatus', () => {
        it('should update status text and color', () => {
            const elements = lobbyUI.create();
            const mockStatusText = elements.statusText;

            lobbyUI.updateStatus('Connected!', '#00ff00');

            expect(mockStatusText?.setText).toHaveBeenCalledWith('Connected!');
            expect(mockStatusText?.setColor).toHaveBeenCalledWith('#00ff00');
        });

        it('should use default yellow color if not specified', () => {
            const elements = lobbyUI.create();
            const mockStatusText = elements.statusText;

            lobbyUI.updateStatus('Waiting...');

            expect(mockStatusText?.setColor).toHaveBeenCalledWith('#ffff00');
        });

        it('should handle missing statusText gracefully', () => {
            expect(() => lobbyUI.updateStatus('Test')).not.toThrow();
        });
    });

    describe('showError', () => {
        it('should call updateStatus with red color', () => {
            lobbyUI.create();
            const updateSpy = vi.spyOn(lobbyUI, 'updateStatus');

            lobbyUI.showError('Connection failed!');

            expect(updateSpy).toHaveBeenCalledWith('Connection failed!', '#ff0000');
        });
    });

    describe('updatePlayerList', () => {
        let elements: ReturnType<typeof lobbyUI.create>;

        beforeEach(() => {
            // Create a more sophisticated mock for player list container
            const playerListContainer = {
                add: vi.fn().mockReturnThis(),
                destroy: vi.fn(),
                list: [{ destroy: vi.fn() }], // Title element
            };
            mockScene.add.container.mockReturnValueOnce(createMockContainer()); // room code container
            mockScene.add.container.mockReturnValueOnce(playerListContainer); // player list container

            elements = lobbyUI.create();
        });

        it('should add player text entries', () => {
            lobbyUI.updatePlayerList(['player-1', 'player-2'], true);

            // Should create text for each player
            expect(mockScene.add.text).toHaveBeenCalled();
        });

        it('should show start button for host with players', () => {
            const startButton = elements.startButton;

            lobbyUI.updatePlayerList(['player-1'], true);

            expect(startButton?.setVisible).toHaveBeenCalledWith(true);
        });

        it('should hide start button for non-host', () => {
            const startButton = elements.startButton;

            lobbyUI.updatePlayerList(['player-1'], false);

            expect(startButton?.setVisible).toHaveBeenCalledWith(false);
        });

        it('should hide start button when no players', () => {
            const startButton = elements.startButton;

            lobbyUI.updatePlayerList([], true);

            expect(startButton?.setVisible).toHaveBeenCalledWith(false);
        });
    });

    describe('changeMode', () => {
        beforeEach(() => {
            lobbyUI.create();
        });

        it('should hide input and show copyable code in host mode', () => {
            const elements = (lobbyUI as any).elements;

            lobbyUI.changeMode('host');

            expect(elements.roomCodeInput.visible).toBe(false);
            expect(elements.roomCodeText?.setInteractive).toHaveBeenCalled();
        });

        it('should show input in join mode', () => {
            const elements = (lobbyUI as any).elements;

            lobbyUI.changeMode('join');

            expect(elements.roomCodeInput.visible).toBe(true);
            expect(elements.roomCodeText?.disableInteractive).toHaveBeenCalled();
        });

        it('should update label text for host mode', () => {
            lobbyUI.changeMode('host');

            const elements = (lobbyUI as any).elements;
            expect(elements.roomCodeLabel.text).toBe('Room Code (Click to copy) :');
        });

        it('should update label text for join mode', () => {
            lobbyUI.changeMode('join');

            const elements = (lobbyUI as any).elements;
            expect(elements.roomCodeLabel.text).toBe('Enter Room Code:');
        });
    });

    describe('destroy', () => {
        it('should destroy all UI elements', () => {
            const elements = lobbyUI.create();

            lobbyUI.destroy();

            // Each element should have destroy called
            expect(elements.title?.destroy).toHaveBeenCalled();
            expect(elements.roomCodeContainer?.destroy).toHaveBeenCalled();
        });

        it('should clear elements object', () => {
            lobbyUI.create();

            lobbyUI.destroy();

            expect((lobbyUI as any).elements).toEqual({});
        });

        it('should handle empty elements gracefully', () => {
            expect(() => lobbyUI.destroy()).not.toThrow();
        });
    });

    describe('createButton', () => {
        it('should create interactive text button', () => {
            lobbyUI.create();

            const button = lobbyUI.createButton(100, 200, 'Test Button', vi.fn());

            expect(button).toBeDefined();
            expect(button.setOrigin).toHaveBeenCalledWith(0.5);
            expect(button.setInteractive).toHaveBeenCalledWith({ useHandCursor: true });
        });

        it('should register hover effects', () => {
            lobbyUI.create();

            const button = lobbyUI.createButton(100, 200, 'Test', vi.fn());

            expect(button.on).toHaveBeenCalledWith('pointerover', expect.any(Function));
            expect(button.on).toHaveBeenCalledWith('pointerout', expect.any(Function));
        });

        it('should register click handler', () => {
            lobbyUI.create();
            const clickHandler = vi.fn();

            const button = lobbyUI.createButton(100, 200, 'Test', clickHandler);

            expect(button.on).toHaveBeenCalledWith('pointerdown', clickHandler);
        });
    });

    describe('room code validation', () => {
        it('should accept valid 6-char uppercase alphanumeric codes', () => {
            const validCodes = ['ABC123', 'XYZ789', 'TEST99', 'GAME11'];
            validCodes.forEach(code => {
                expect(lobbyUI.lobbyCodeRegex.test(code)).toBe(true);
            });
        });

        it('should reject codes with lowercase letters', () => {
            expect(lobbyUI.lobbyCodeRegex.test('abc123')).toBe(false);
            expect(lobbyUI.lobbyCodeRegex.test('AbC123')).toBe(false);
        });

        it('should reject codes with zero (PlaySocketJS uses 1-9)', () => {
            expect(lobbyUI.lobbyCodeRegex.test('ABC120')).toBe(false);
            expect(lobbyUI.lobbyCodeRegex.test('000000')).toBe(false);
        });

        it('should reject codes of wrong length', () => {
            expect(lobbyUI.lobbyCodeRegex.test('ABC12')).toBe(false);
            expect(lobbyUI.lobbyCodeRegex.test('ABC1234')).toBe(false);
            expect(lobbyUI.lobbyCodeRegex.test('')).toBe(false);
        });

        it('should reject codes with special characters', () => {
            expect(lobbyUI.lobbyCodeRegex.test('ABC-12')).toBe(false);
            expect(lobbyUI.lobbyCodeRegex.test('ABC_12')).toBe(false);
            expect(lobbyUI.lobbyCodeRegex.test('ABC 12')).toBe(false);
        });
    });
});
