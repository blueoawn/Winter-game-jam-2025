import { Scene } from 'phaser';
import ASSETS from '../src/assets';

// Simple audio manager for playing sound effects and music
export class AudioManager {
    private static instance: AudioManager;
    private scene: Scene | null = null;
    private volume: number = 0.1;
    private muted: boolean = false;
    private currentMusic: Phaser.Sound.BaseSound | null = null;

    private constructor() {}

    static getInstance(): AudioManager {
        if (!AudioManager.instance) {
            AudioManager.instance = new AudioManager();
        }
        return AudioManager.instance;
    }

    // Initialize with a scene reference (call this when game scene starts)
    init(scene: Scene): void {
        this.scene = scene;
    }

    // Resume AudioContext if suspended (required for browser autoplay policy)
    // Returns a promise that resolves to true if context was resumed
    async resumeContext(): Promise<boolean> {
        if (!this.scene) return false;

        const soundManager = this.scene.sound as Phaser.Sound.WebAudioSoundManager;
        if (soundManager.context?.state === 'suspended') {
            await soundManager.context.resume();
            console.log('[Audio Debug] Context state after await:', soundManager.context.state);
            return true;
        }
        return false;
    }

    // Check if AudioContext is in a playable state
    isContextReady(): boolean {
        if (!this.scene) return false;

        const soundManager = this.scene.sound as Phaser.Sound.WebAudioSoundManager;
        return soundManager.context?.state === 'running';
    }

    // Get the current AudioContext state
    getContextState(): AudioContextState | null {
        if (!this.scene) return null;

        const soundManager = this.scene.sound as Phaser.Sound.WebAudioSoundManager;
        return soundManager.context?.state ?? null;
    }

    // Play a sound effect by key
    play(key: string, config?: Phaser.Types.Sound.SoundConfig): void {
        if (!this.scene || this.muted) return;

        const soundConfig: Phaser.Types.Sound.SoundConfig = {
            volume: this.volume,
            ...config
        };

        // Check if the audio asset exists in cache before playing
        if (!this.scene.sound.get(key) && !this.scene.cache.audio.exists(key)) {
            console.warn(`Audio asset "${key}" not found in cache. Make sure it's loaded in the preloader.`);
            return;
        }

        this.scene.sound.play(key, soundConfig);
    }

    // Play music (background music with looping)
    playMusic(key: string, config?: Phaser.Types.Sound.SoundConfig): void {
        if (!this.scene || this.muted) return;

        // Stop current music first
        this.stopMusic();

        const musicConfig: Phaser.Types.Sound.SoundConfig = {
            volume: this.volume * 0.6, // Music should be quieter than SFX
            loop: true,
            ...config
        };

        // Check if the audio asset exists in cache before playing
        if (!this.scene.cache.audio.exists(key)) {
            console.warn(`Music asset "${key}" not found in cache. Make sure it's loaded in the preloader.`);
            return;
        }

        this.currentMusic = this.scene.sound.add(key, musicConfig);
        this.currentMusic.play();
    }

    // Stop current music
    stopMusic(): void {
        if (this.currentMusic) {
            this.currentMusic.stop();
            this.currentMusic.destroy();
            this.currentMusic = null;
        }
    }

    // Predefined sound effects for easy access
    playCheeseEat(): void {
        this.play(ASSETS.audio.cheeseEat.key);
    }

    playRailgunFire(): void {
        this.play(ASSETS.audio.railgunFire.key);
    }

    playBulletSound(): void {
        this.play(ASSETS.audio.bulletSound.key);
    }

    playSwordSlash(): void {
        this.play(ASSETS.audio.swordSlash.key);
    }

    playShotgunFire(): void {
        this.play(ASSETS.audio.shotgunFire.key);
    }

    playLizardDead(): void {
        // Randomly play one of the lizard death sounds
        const deathSounds = [
            ASSETS.audio.lizardDead1.key,
            ASSETS.audio.lizardDead2.key,
            ASSETS.audio.lizardDead3.key
        ];
        const randomSound = deathSounds[Math.floor(Math.random() * deathSounds.length)];
        this.play(randomSound);
    }

    playPlasmaShot(): void {
        this.play(ASSETS.audio.plasmaShot.key);
    }

    playWallShieldCollision(): void {
        this.play(ASSETS.audio.wallShieldCollision.key);
    }

    playWizardLizardBlep(): void {
        this.play(ASSETS.audio.wizardLizardBlep.key);
    }

    playYouDidIt(): void {
        this.play(ASSETS.audio.youDidIt.key);
    }

    // Predefined music tracks
    playBattleMusic(): void {
        const battleTracks = [
            ASSETS.audio.battleTheme1.key,
            ASSETS.audio.battleTheme2.key
        ];
        const randomTrack = battleTracks[Math.floor(Math.random() * battleTracks.length)];
        this.playMusic(randomTrack);
    }

    playCharacterSelectMusic(): void {
        this.playMusic(ASSETS.audio.characterSelectMusic.key);
    }

    playGameOverMusic(): void {
        this.playMusic(ASSETS.audio.gameOverMusic.key);
    }

    playSpookMusic(): void {
        this.playMusic(ASSETS.audio.spook2.key);
    }

    // Volume and mute controls
    setVolume(volume: number): void {
        this.volume = Math.max(0, Math.min(1, volume)); // Clamp between 0 and 1

        // Adjust current music volume if playing
        if (this.currentMusic) {
            this.currentMusic.setVolume(this.volume * 0.6);
        }
    }

    getVolume(): number {
        return this.volume;
    }

    setMuted(muted: boolean): void {
        this.muted = muted;
        
        // Mute/unmute current music
        if (this.currentMusic) {
            if (muted) {
                this.currentMusic.setVolume(0);
            } else {
                this.currentMusic.setVolume(this.volume * 0.6);
            }
        }
    }

    isMuted(): boolean {
        return this.muted;
    }

    toggleMute(): boolean {
        this.setMuted(!this.muted);
        return this.muted;
    }

    // Validate all audio assets are loaded in cache
    validateAudioAssets(scene: Scene): boolean {
        try {
            const missingAssets: string[] = [];
            
            // Check all audio assets from ASSETS configuration
            Object.values(ASSETS.audio).forEach((audioAsset: any) => {
                if (audioAsset.key && !scene.cache.audio.exists(audioAsset.key)) {
                    missingAssets.push(audioAsset.key);
                }
            });

            if (missingAssets.length > 0) {
                console.error('Missing audio assets:', missingAssets);
                console.warn('Some audio features may not work properly. Check that all audio files are loaded in the Preloader scene.');
                return false;
            }

            console.log('All audio assets validated successfully');
            return true;
        } catch (error) {
            console.error('Error validating audio assets:', error);
            return false;
        }
    }

    // Cleanup - call when switching scenes
    destroy(): void {
        this.stopMusic();
        this.scene = null;
    }
}

// Export singleton instance for easy access throughout the application
export const audioManager = AudioManager.getInstance();

