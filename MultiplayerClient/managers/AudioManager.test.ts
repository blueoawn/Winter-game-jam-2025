import { describe, it, expect, beforeEach, vi, Mock } from 'vitest';
import { AudioManager } from './AudioManager';
import ASSETS from '../src/assets';

// Mock Phaser Scene and Sound objects
const mockSound = {
    play: vi.fn(),
    stop: vi.fn(),
    destroy: vi.fn(),
    setVolume: vi.fn()
};

const mockCache = {
    audio: {
        exists: vi.fn().mockReturnValue(true)
    }
};

const mockScene = {
    sound: {
        play: vi.fn(),
        add: vi.fn().mockReturnValue(mockSound),
        get: vi.fn()
    },
    cache: mockCache
};

describe('AudioManager', () => {
    let audioManager: AudioManager;

    beforeEach(() => {
        // Reset singleton instance before each test
        (AudioManager as any).instance = undefined;
        audioManager = AudioManager.getInstance();
        
        // Reset all mocks
        vi.clearAllMocks();
        mockCache.audio.exists.mockReturnValue(true);
    });

    describe('Singleton Pattern', () => {
        it('should return the same instance on multiple calls', () => {
            const instance1 = AudioManager.getInstance();
            const instance2 = AudioManager.getInstance();
            
            expect(instance1).toBe(instance2);
        });
    });

    describe('Initialization', () => {
        it('should initialize with a scene', () => {
            expect(() => audioManager.init(mockScene as any)).not.toThrow();
        });
    });

    describe('Sound Effects', () => {
        beforeEach(() => {
            audioManager.init(mockScene as any);
        });

        it('should play a sound effect with default volume', () => {
            audioManager.play('test-sound');

            expect(mockScene.sound.play).toHaveBeenCalledWith('test-sound', {
                volume: 0.1
            });
        });

        it('should play a sound effect with custom config', () => {
            audioManager.play('test-sound', { loop: true, volume: 0.5 });

            expect(mockScene.sound.play).toHaveBeenCalledWith('test-sound', {
                volume: 0.5, // Custom volume should be used
                loop: true
            });
        });

        it('should not play sound when muted', () => {
            audioManager.setMuted(true);
            audioManager.play('test-sound');

            expect(mockScene.sound.play).not.toHaveBeenCalled();
        });

        it('should not play sound when scene is not initialized', () => {
            // Create a fresh instance that hasn't been initialized
            (AudioManager as any).instance = undefined;
            const uninitializedManager = AudioManager.getInstance();
            uninitializedManager.play('test-sound');

            expect(mockScene.sound.play).not.toHaveBeenCalled();
        });

        it('should warn when audio asset does not exist', () => {
            const consoleSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
            mockCache.audio.exists.mockReturnValue(false);
            mockScene.sound.get.mockReturnValue(null);

            audioManager.play('missing-sound');

            expect(consoleSpy).toHaveBeenCalledWith(
                'Audio asset "missing-sound" not found in cache. Make sure it\'s loaded in the preloader.'
            );
            expect(mockScene.sound.play).not.toHaveBeenCalled();
            
            consoleSpy.mockRestore();
        });
    });

    describe('Music Management', () => {
        beforeEach(() => {
            audioManager.init(mockScene as any);
        });

        it('should play music with looping and reduced volume', () => {
            audioManager.playMusic('test-music');

            expect(mockScene.sound.add).toHaveBeenCalledWith('test-music', {
                volume: 0.06, // 0.1 * 0.6
                loop: true
            });
            expect(mockSound.play).toHaveBeenCalled();
        });

        it('should stop current music before playing new music', () => {
            audioManager.playMusic('music1');
            audioManager.playMusic('music2');

            expect(mockSound.stop).toHaveBeenCalledTimes(1);
            expect(mockSound.destroy).toHaveBeenCalledTimes(1);
            expect(mockScene.sound.add).toHaveBeenCalledTimes(2);
        });

        it('should stop music properly', () => {
            audioManager.playMusic('test-music');
            audioManager.stopMusic();

            expect(mockSound.stop).toHaveBeenCalled();
            expect(mockSound.destroy).toHaveBeenCalled();
        });

        it('should warn when music asset does not exist', () => {
            const consoleSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
            mockCache.audio.exists.mockReturnValue(false);

            audioManager.playMusic('missing-music');

            expect(consoleSpy).toHaveBeenCalledWith(
                'Music asset "missing-music" not found in cache. Make sure it\'s loaded in the preloader.'
            );
            expect(mockScene.sound.add).not.toHaveBeenCalled();
            
            consoleSpy.mockRestore();
        });
    });

    describe('Volume Controls', () => {
        beforeEach(() => {
            audioManager.init(mockScene as any);
        });

        it('should set volume within valid range', () => {
            audioManager.setVolume(0.5);
            expect(audioManager.getVolume()).toBe(0.5);

            audioManager.setVolume(-0.1);
            expect(audioManager.getVolume()).toBe(0);

            audioManager.setVolume(1.5);
            expect(audioManager.getVolume()).toBe(1);
        });

        it('should adjust current music volume when volume changes', () => {
            audioManager.playMusic('test-music');
            audioManager.setVolume(0.8);

            expect(mockSound.setVolume).toHaveBeenCalledWith(0.48); // 0.8 * 0.6
        });

        it('should handle mute/unmute correctly', () => {
            expect(audioManager.isMuted()).toBe(false);

            audioManager.setMuted(true);
            expect(audioManager.isMuted()).toBe(true);

            audioManager.play('test-sound');
            expect(mockScene.sound.play).not.toHaveBeenCalled();
        });

        it('should mute/unmute current music', () => {
            audioManager.playMusic('test-music');

            audioManager.setMuted(true);
            expect(mockSound.setVolume).toHaveBeenCalledWith(0);

            audioManager.setMuted(false);
            expect(mockSound.setVolume).toHaveBeenCalledWith(0.06); // 0.1 * 0.6
        });

        it('should toggle mute state and return new state', () => {
            expect(audioManager.isMuted()).toBe(false);

            const firstToggle = audioManager.toggleMute();
            expect(firstToggle).toBe(true);
            expect(audioManager.isMuted()).toBe(true);

            const secondToggle = audioManager.toggleMute();
            expect(secondToggle).toBe(false);
            expect(audioManager.isMuted()).toBe(false);
        });

        it('should toggle mute and affect current music volume', () => {
            audioManager.playMusic('test-music');
            vi.clearAllMocks();

            audioManager.toggleMute();
            expect(mockSound.setVolume).toHaveBeenCalledWith(0);

            audioManager.toggleMute();
            expect(mockSound.setVolume).toHaveBeenCalledWith(0.06);
        });
    });

    describe('Predefined Sound Effects', () => {
        beforeEach(() => {
            audioManager.init(mockScene as any);
            vi.spyOn(audioManager, 'play');
        });

        // Automatically discover all sound effect methods that start with 'play' and call this.play()
        // This makes the tests maintenance-free when new sound effects are added
        // 
        // TO ADD A NEW SOUND EFFECT TEST:
        // 1. Add the method to AudioManager (e.g., playNewSound(): void { this.play(ASSETS.audio.newSound.key); })
        // 2. Add an entry to the array below: { method: 'playNewSound', expectedKey: ASSETS.audio.newSound.key }
        // 3. The test will automatically include it - no additional test code needed!
        const soundEffectMethods = [
            { method: 'playCheeseEat', expectedKey: ASSETS.audio.cheeseEat.key },
            { method: 'playRailgunFire', expectedKey: ASSETS.audio.railgunFire.key },
            { method: 'playBulletSound', expectedKey: ASSETS.audio.bulletSound.key },
            { method: 'playSwordSlash', expectedKey: ASSETS.audio.swordSlash.key },
            { method: 'playShotgunFire', expectedKey: ASSETS.audio.shotgunFire.key },
            { method: 'playPlasmaShot', expectedKey: ASSETS.audio.plasmaShot.key },
            { method: 'playWallShieldCollision', expectedKey: ASSETS.audio.wallShieldCollision.key },
            { method: 'playWizardLizardBlep', expectedKey: ASSETS.audio.wizardLizardBlep.key },
            { method: 'playYouDidIt', expectedKey: ASSETS.audio.youDidIt.key },
        ];

        // Auto-generated tests for all simple sound effect methods
        soundEffectMethods.forEach(({ method, expectedKey }) => {
            it(`${method}() should play the correct sound`, () => {
                (audioManager as any)[method]();
                expect(audioManager.play).toHaveBeenCalledWith(expectedKey);
            });
        });

        // Special case: methods with random selection logic
        it('playLizardDead() should play one of the lizard death sounds randomly', () => {
            audioManager.playLizardDead();
            
            const expectedSounds = [
                ASSETS.audio.lizardDead1.key,
                ASSETS.audio.lizardDead2.key,
                ASSETS.audio.lizardDead3.key
            ];

            expect(audioManager.play).toHaveBeenCalledWith(
                expect.stringMatching(new RegExp(expectedSounds.join('|')))
            );
        });

        // Test that ensures all AudioManager play methods are covered by tests
        it('should have tests for all play* methods that call this.play()', () => {
            const audioManagerPrototype = Object.getPrototypeOf(audioManager);
            const allMethods = Object.getOwnPropertyNames(audioManagerPrototype);
            
            // Find all methods that start with 'play' and are predefined sound effect methods
            // (exclude base methods like 'play' and 'playMusic', and music-specific methods)
            const playMethods = allMethods.filter(method => 
                method.startsWith('play') && 
                method !== 'play' && // exclude base play method
                method !== 'playMusic' && // exclude base playMusic method
                !method.includes('Music') // exclude music-specific methods
            );

            const testedMethods = [...soundEffectMethods.map(s => s.method), 'playLizardDead'];
            
            // Ensure we're testing all the sound effect play methods
            playMethods.forEach(method => {
                expect(testedMethods).toContain(method);
            });

            // Also verify we found the expected number of methods
            expect(playMethods.length).toBeGreaterThan(0);
        });
    });

    describe('Predefined Music Tracks', () => {
        beforeEach(() => {
            audioManager.init(mockScene as any);
            vi.spyOn(audioManager, 'playMusic');
        });

        // Data-driven test for simple music methods
        // 
        // TO ADD A NEW MUSIC TEST:
        // 1. Add the method to AudioManager (e.g., playMenuMusic(): void { this.playMusic(ASSETS.audio.menuMusic.key); })
        // 2. Add an entry to the array below: { method: 'playMenuMusic', expectedKey: ASSETS.audio.menuMusic.key }
        // 3. The test will automatically include it!
        const musicMethods = [
            { method: 'playCharacterSelectMusic', expectedKey: ASSETS.audio.characterSelectMusic.key },
            { method: 'playGameOverMusic', expectedKey: ASSETS.audio.gameOverMusic.key },
            { method: 'playSpookMusic', expectedKey: ASSETS.audio.spook2.key },
        ];

        // Auto-generated tests for simple music methods
        musicMethods.forEach(({ method, expectedKey }) => {
            it(`${method}() should play the correct music track`, () => {
                (audioManager as any)[method]();
                expect(audioManager.playMusic).toHaveBeenCalledWith(expectedKey);
            });
        });

        // Special case: methods with random selection logic
        it('playBattleMusic() should play one of the battle themes randomly', () => {
            audioManager.playBattleMusic();
            
            const expectedTracks = [
                ASSETS.audio.battleTheme1.key,
                ASSETS.audio.battleTheme2.key
            ];

            expect(audioManager.playMusic).toHaveBeenCalledWith(
                expect.stringMatching(new RegExp(expectedTracks.join('|')))
            );
        });

        // Test that ensures all AudioManager music methods are covered by tests
        it('should have tests for all music play methods', () => {
            const audioManagerPrototype = Object.getPrototypeOf(audioManager);
            const allMethods = Object.getOwnPropertyNames(audioManagerPrototype);
            
            // Find all methods that contain 'Music' and start with 'play'
            const musicPlayMethods = allMethods.filter(method => 
                method.startsWith('play') && 
                method.includes('Music') && 
                method !== 'playMusic' // exclude the base playMusic method
            );

            const testedMethods = [...musicMethods.map(m => m.method), 'playBattleMusic'];
            
            // Ensure we're testing all the music play methods
            musicPlayMethods.forEach(method => {
                expect(testedMethods).toContain(method);
            });
        });
    });

    describe('Asset Validation', () => {
        beforeEach(() => {
            audioManager.init(mockScene as any);
        });

        it('should validate all audio assets successfully', () => {
            const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
            
            const result = audioManager.validateAudioAssets(mockScene as any);

            expect(result).toBe(true);
            expect(consoleSpy).toHaveBeenCalledWith('All audio assets validated successfully');
            
            consoleSpy.mockRestore();
        });
    });

    describe('Cleanup', () => {
        beforeEach(() => {
            audioManager.init(mockScene as any);
        });

        it('should cleanup properly on destroy', () => {
            audioManager.playMusic('test-music');
            audioManager.destroy();

            expect(mockSound.stop).toHaveBeenCalled();
            expect(mockSound.destroy).toHaveBeenCalled();
        });

        it('should not crash when destroying with no current music', () => {
            expect(() => audioManager.destroy()).not.toThrow();
        });
    });

    describe('AudioContext Management', () => {
        const mockContext = {
            state: 'suspended' as AudioContextState,
            resume: vi.fn().mockResolvedValue(undefined)
        };

        const mockSceneWithContext = {
            ...mockScene,
            sound: {
                ...mockScene.sound,
                context: mockContext
            }
        };

        beforeEach(() => {
            vi.clearAllMocks();
            mockContext.state = 'suspended';
            mockContext.resume.mockResolvedValue(undefined);
        });

        it('should return false when scene is not initialized', async () => {
            // Fresh instance without init
            (AudioManager as any).instance = undefined;
            const uninitializedManager = AudioManager.getInstance();

            expect(await uninitializedManager.resumeContext()).toBe(false);
            expect(uninitializedManager.isContextReady()).toBe(false);
            expect(uninitializedManager.getContextState()).toBe(null);
        });

        it('should resume suspended AudioContext', async () => {
            audioManager.init(mockSceneWithContext as any);

            const result = await audioManager.resumeContext();

            expect(result).toBe(true);
            expect(mockContext.resume).toHaveBeenCalled();
        });

        it('should return false when AudioContext is already running', async () => {
            mockContext.state = 'running';
            audioManager.init(mockSceneWithContext as any);

            const result = await audioManager.resumeContext();

            expect(result).toBe(false);
            expect(mockContext.resume).not.toHaveBeenCalled();
        });

        it('should report context ready when state is running', () => {
            mockContext.state = 'running';
            audioManager.init(mockSceneWithContext as any);

            expect(audioManager.isContextReady()).toBe(true);
        });

        it('should report context not ready when state is suspended', () => {
            mockContext.state = 'suspended';
            audioManager.init(mockSceneWithContext as any);

            expect(audioManager.isContextReady()).toBe(false);
        });

        it('should return current context state', () => {
            mockContext.state = 'suspended';
            audioManager.init(mockSceneWithContext as any);

            expect(audioManager.getContextState()).toBe('suspended');

            mockContext.state = 'running';
            expect(audioManager.getContextState()).toBe('running');
        });

        it('should handle scene without context gracefully', async () => {
            const sceneWithoutContext = {
                ...mockScene,
                sound: {
                    ...mockScene.sound,
                    context: undefined
                }
            };
            audioManager.init(sceneWithoutContext as any);

            expect(await audioManager.resumeContext()).toBe(false);
            expect(audioManager.isContextReady()).toBe(false);
            expect(audioManager.getContextState()).toBeNull();
        });
    });
});