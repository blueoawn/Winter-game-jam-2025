import { Scene } from 'phaser';
import ASSETS from '../src/assets';

// Simple audio manager for playing sound effects and music
export class AudioManager {
    private static instance: AudioManager;
    private scene: Scene | null = null;
    private volume: number = 0.1;
    private muted: boolean = false;

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

        const soundConfig: Phaser.Types.Sound.SoundConfig = {
            volume: this.volume,
            ...config
        };

        this.scene.sound.play(key, soundConfig);
    }

    // Play cheese eat sound
    playCheeseEat(): void {
        this.play(ASSETS.audio.cheeseEat.key);
    }

    // Set global volume (0.0 to 1.0)
    setVolume(volume: number): void {
        this.volume = Math.max(0, Math.min(1, volume));
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

