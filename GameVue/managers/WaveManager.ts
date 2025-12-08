/**
 * WaveManager.ts
 * Manages wave-based enemy spawning for level progression
 */

import type { GameScene } from '../src/scenes/GameScene';
import type { IBehavior } from '../src/behaviorScripts/Behavior';
import ASSETS from '../src/assets';
import { audioManager } from './AudioManager';

export enum WaveState {
    Waiting,
    Spawning,
    Active,
    Complete,
    BossSpawned,
    LevelComplete
}

export interface WaveConfig {
    enemyType: string;
    count: number;
    spawnDelay: number;  // Delay between individual enemy spawns (ms)
    behavior?: IBehavior;
    spawnPositions?: 'edges' | 'random' | Array<{ x: number; y: number }>;
}

export interface LevelConfig {
    id: string;
    name: string;
    waves: WaveConfig[];
    bossConfig?: {
        enemyType: string;
        spawnDelay: number;  // Delay after last wave before boss spawns
        behavior?: IBehavior;
        spawnPosition?: { x: number; y: number };
    };
    onComplete?: () => void;
}

export class WaveManager {
    private scene: GameScene;
    private config: LevelConfig;
    private currentWaveIndex: number = 0;
    private state: WaveState = WaveState.Waiting;
    private enemiesSpawnedThisWave: number = 0;
    private nextSpawnTick: number = 0;
    private bossSpawned: boolean = false;
    private waveCompleteCallback?: (waveIndex: number) => void;
    private bossSpawnCallback?: () => void;
    private levelCompleteCallback?: () => void;

    constructor(scene: GameScene, config: LevelConfig) {
        this.scene = scene;
        this.config = config;
    }

    start(): void {
        console.log(`[WAVE] Starting level: ${this.config.name}`);
        this.state = WaveState.Waiting;
        this.currentWaveIndex = 0;
        this.startNextWave();
    }

    update(): void {
        if (!this.scene.isHost && this.scene.networkEnabled) {
            return;
        }

        switch (this.state) {
            case WaveState.Spawning:
                this.updateSpawning();
                break;
            case WaveState.Active:
                this.checkWaveComplete();
                break;
            case WaveState.Complete:
                this.handleWaveComplete();
                break;
            case WaveState.BossSpawned:
                this.checkBossDefeated();
                break;
        }
    }

    private startNextWave(): void {
        if (this.currentWaveIndex >= this.config.waves.length) {
            console.log('[WAVE] All waves complete, checking for boss');
            if (this.config.bossConfig && !this.bossSpawned) {
                this.scheduleBossSpawn();
            } else {
                this.state = WaveState.LevelComplete;
                this.onLevelComplete();
            }
            return;
        }

        const wave = this.config.waves[this.currentWaveIndex];
        console.log(`[WAVE] Starting wave ${this.currentWaveIndex + 1}/${this.config.waves.length}: ${wave.count} ${wave.enemyType}`);

        this.state = WaveState.Spawning;
        this.enemiesSpawnedThisWave = 0;
        this.nextSpawnTick = this.scene.tick;
    }

    private updateSpawning(): void {
        const wave = this.config.waves[this.currentWaveIndex];

        if (this.enemiesSpawnedThisWave >= wave.count) {
            console.log(`[WAVE] All enemies spawned for wave ${this.currentWaveIndex + 1}`);
            this.state = WaveState.Active;
            return;
        }

        if (this.scene.tick < this.nextSpawnTick) {
            return;
        }

        const currentEnemyCount = this.scene.enemyGroup.getChildren().length;
        if (currentEnemyCount >= 30) {
            console.warn('[WAVE] Enemy limit reached, delaying spawn');
            this.nextSpawnTick = this.scene.tick + 60;
            return;
        }

        this.spawnEnemy(wave);
        this.enemiesSpawnedThisWave++;

        const TICKS_PER_SECOND = 60;
        const delayTicks = Math.floor((wave.spawnDelay / 1000) * TICKS_PER_SECOND);
        this.nextSpawnTick = this.scene.tick + delayTicks;
    }

    private spawnEnemy(wave: WaveConfig): void {
        const spawnPos = this.getSpawnPosition(wave.spawnPositions);

        switch (wave.enemyType) {
            case 'EnemySlime':
                const slime = this.scene.addSlimeEnemy(spawnPos.x, spawnPos.y, wave.behavior);
                break;
            case 'EnemyLizardWizard':
                const wizard = this.scene.addLizardWizardEnemy(spawnPos.x, spawnPos.y, wave.behavior);
                break;
        }
    }

    private getSpawnPosition(positionType?: 'edges' | 'random' | Array<{ x: number; y: number }>): { x: number; y: number } {
        if (Array.isArray(positionType)) {
            const randomPos = Phaser.Math.RND.pick(positionType);
            return randomPos;
        }

        const mapWidth = this.scene.currentMap.width;
        const mapHeight = this.scene.currentMap.height;
        const margin = 50;

        if (positionType === 'edges') {
            const edge = Phaser.Math.RND.pick(['top', 'bottom', 'left', 'right']);

            switch (edge) {
                case 'top':
                    return { x: Phaser.Math.Between(margin, mapWidth - margin), y: margin };
                case 'bottom':
                    return { x: Phaser.Math.Between(margin, mapWidth - margin), y: mapHeight - margin };
                case 'left':
                    return { x: margin, y: Phaser.Math.Between(margin, mapHeight - margin) };
                case 'right':
                    return { x: mapWidth - margin, y: Phaser.Math.Between(margin, mapHeight - margin) };
            }
        }

        return {
            x: Phaser.Math.Between(margin, mapWidth - margin),
            y: Phaser.Math.Between(margin, mapHeight - margin)
        };
    }

    private checkWaveComplete(): void {
        const enemiesRemaining = this.scene.enemyGroup.getChildren().length;

        if (enemiesRemaining === 0) {
            console.log(`[WAVE] Wave ${this.currentWaveIndex + 1} complete!`);
            this.state = WaveState.Complete;
        }
    }

    private handleWaveComplete(): void {
        if (this.waveCompleteCallback) {
            this.waveCompleteCallback(this.currentWaveIndex);
        }

        this.currentWaveIndex++;
        this.state = WaveState.Waiting;

        this.scene.time.delayedCall(2000, () => {
            this.startNextWave();
        });
    }

    private scheduleBossSpawn(): void {
        const delay = this.config.bossConfig?.spawnDelay || 3000;
        console.log(`[WAVE] Boss spawning in ${delay}ms`);

        this.scene.time.delayedCall(delay, () => {
            this.spawnBoss();
        });
    }

    private spawnBoss(): void {
        if (!this.config.bossConfig) return;

        console.log(`[WAVE] Spawning boss: ${this.config.bossConfig.enemyType}`);

        const spawnPos = this.config.bossConfig.spawnPosition || {
            x: this.scene.currentMap.width / 2,
            y: this.scene.currentMap.height / 2
        };

        switch (this.config.bossConfig.enemyType) {
            case 'EnemyLizardWizard':
                const boss = this.scene.addLizardWizardEnemy(
                    spawnPos.x,
                    spawnPos.y,
                    this.config.bossConfig.behavior,
                    true  // isBoss flag
                );
                break;
        }

        this.bossSpawned = true;
        this.state = WaveState.BossSpawned;

        if (this.bossSpawnCallback) {
            this.bossSpawnCallback();
        }
    }

    private checkBossDefeated(): void {
        const enemiesRemaining = this.scene.enemyGroup.getChildren().length;

        if (enemiesRemaining === 0) {
            console.log('[WAVE] Boss defeated! Level complete!');

            // Stop battle music and play victory music
            audioManager.stopMusic();
            audioManager.play(ASSETS.audio.youDidIt.key, { volume: 0.6 });

            this.state = WaveState.LevelComplete;
            this.onLevelComplete();
        }
    }

    private onLevelComplete(): void {
        console.log(`[WAVE] Level "${this.config.name}" complete!`);

        if (this.config.onComplete) {
            this.config.onComplete();
        }

        if (this.levelCompleteCallback) {
            this.levelCompleteCallback();
        }
    }

    onWaveComplete(callback: (waveIndex: number) => void): void {
        this.waveCompleteCallback = callback;
    }

    onBossSpawn(callback: () => void): void {
        this.bossSpawnCallback = callback;
    }

    onLevelComplete(callback: () => void): void {
        this.levelCompleteCallback = callback;
    }

    getCurrentWave(): number {
        return this.currentWaveIndex + 1;
    }

    getTotalWaves(): number {
        return this.config.waves.length;
    }

    getState(): WaveState {
        return this.state;
    }

    reset(): void {
        this.currentWaveIndex = 0;
        this.state = WaveState.Waiting;
        this.enemiesSpawnedThisWave = 0;
        this.bossSpawned = false;
    }
}

