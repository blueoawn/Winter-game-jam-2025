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

    // Play a sound effect by key
    play(key: string, config?: Phaser.Types.Sound.SoundConfig): void {
        if (!this.scene || this.muted) return;

        // If config has a volume, multiply it with global volume, otherwise use global volume
        const configVolume = config?.volume ?? 1.0;

        const soundConfig: Phaser.Types.Sound.SoundConfig = {
            ...config,
            volume: this.volume * configVolume
        };

        this.scene.sound.play(key, soundConfig);
    }

    // Play cheese eat sound
    playCheeseEat(): void {
        this.play(ASSETS.audio.cheeseEat.key);
    }

    // Play background music
    playMusic(key: string, config?: Phaser.Types.Sound.SoundConfig): void {
        if (!this.scene) return;

        // Stop current music if playing
        this.stopMusic();

        // If config has a volume, multiply it with global volume, otherwise use 0.7 (quieter than SFX)
        const configVolume = config?.volume ?? 0.5;

        const musicConfig: Phaser.Types.Sound.SoundConfig = {
            loop: false,
            ...config,
            volume: this.volume * configVolume
        };

        this.currentMusic = this.scene.sound.add(key, musicConfig);

        // Only play if not muted
        if (!this.muted) {
            this.currentMusic.play();
        }
    }

    // Stop current music
    stopMusic(): void {
        if (this.currentMusic) {
            this.currentMusic.stop();
            this.currentMusic.destroy();
            this.currentMusic = null;
        }
    }

    // Pause current music
    pauseMusic(): void {
        if (this.currentMusic && this.currentMusic.isPlaying) {
            this.currentMusic.pause();
        }
    }

    // Resume paused music
    resumeMusic(): void {
        if (this.currentMusic && this.currentMusic.isPaused) {
            this.currentMusic.resume();
        }
    }

    // Stop a specific sound by key
    stop(key: string): void {
        if (!this.scene) return;

        // Stop all sounds with this key
        this.scene.sound.stopByKey(key);
    }

    // Set global volume (0.0 to 1.0)
    setVolume(volume: number): void {
        this.volume = Math.max(0, Math.min(1, volume));

        // Update volume for currently playing music
        if (this.currentMusic) {
            // Get the original config volume (default 0.5 for music)
            const configVolume = 0.5;
            (this.currentMusic as any).setVolume(this.volume * configVolume);
        }

        // Update global sound volume
        if (this.scene) {
            this.scene.sound.volume = this.volume;
        }
    }

    getVolume(): number {
        return this.volume;
    }

    // Mute/unmute all sounds
    setMuted(muted: boolean): void {
        this.muted = muted;
        if (this.scene) {
            this.scene.sound.mute = muted;
        }

        // Handle current music
        if (this.currentMusic) {
            if (muted) {
                this.currentMusic.pause();
            } else {
                this.currentMusic.resume();
            }
        }
    }

    isMuted(): boolean {
        return this.muted;
    }

    // Toggle mute
    toggleMute(): boolean {
        this.setMuted(!this.muted);
        return this.muted;
    }
}

// Export singleton instance for easy access
export const audioManager = AudioManager.getInstance();

