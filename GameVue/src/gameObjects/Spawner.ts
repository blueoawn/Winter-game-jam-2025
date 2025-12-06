import { GameScene } from '../scenes/Game';
import { IBehavior } from '../behaviorScripts/Behavior';
/**
 * Spawner - Host-authoritative enemy spawner with tick-based timing
 *
 * Features:
 * - Deterministic tick-based spawning (no randomness)
 * - Host-only execution (clients receive enemies via network sync)
 * - Respects 30 enemy network limit
 * - Configurable behavior per spawner
 * - Stops when totalEnemies reached
 *
 * Network Compatibility:
 * - Spawners only run on host
 * - Spawned enemies automatically synced to clients via existing enemy sync
 * - Uses tick counter for deterministic timing
 */
export class Spawner {
    private scene: GameScene;
    private x: number;
    private y: number;
    private totalEnemies: number;
    private spawnRate: number;      // Time between spawns (in ticks)
    private enemyType: string;
    private behavior?: IBehavior;

    // State tracking
    private spawnCount: number = 0;
    private nextSpawnTick: number = 0;
    private isActive: boolean = true;

    constructor(
        scene: GameScene,
        x: number,
        y: number,
        totalEnemies: number,
        spawnRate: number,      // Milliseconds between spawns
        timeOffset: number,     // Milliseconds before first spawn
        enemyType: string,
        behavior?: IBehavior
    ) {
        this.scene = scene;
        this.x = x;
        this.y = y;
        this.totalEnemies = totalEnemies;
        this.enemyType = enemyType;
        this.behavior = behavior;

        // Convert milliseconds to ticks (assuming 60fps = 60 ticks/second)
        const TICKS_PER_SECOND = 60;
        this.spawnRate = Math.floor((spawnRate / 1000) * TICKS_PER_SECOND);

        // Calculate first spawn tick (current tick + offset)
        const offsetTicks = Math.floor((timeOffset / 1000) * TICKS_PER_SECOND);
        this.nextSpawnTick = scene.tick + offsetTicks;

        // console.log(`Spawner created at (${x}, ${y}): ${totalEnemies} ${enemyType}, rate=${this.spawnRate} ticks, offset=${offsetTicks} ticks`); // DEBUG
    }

    /**
     * Update spawner - called every frame by GameScene
     * Host-only: Checks if it's time to spawn and creates enemies
     */
    update(): void {
        // Only host spawns enemies (clients receive via network sync)
        if (!this.scene.isHost && this.scene.networkEnabled) {
            return;
        }

        // Check if spawner is done
        if (!this.isActive || this.spawnCount >= this.totalEnemies) {
            return;
        }

        // Check if it's time to spawn
        if (this.scene.tick < this.nextSpawnTick) {
            return;
        }

        // Check enemy limit (30 max for network compatibility)
        const currentEnemyCount = this.scene.enemyGroup.getChildren().length;
        if (currentEnemyCount >= 30) {
            // Don't advance nextSpawnTick - will retry next frame
            console.warn(`Spawner waiting: enemy limit reached (${currentEnemyCount}/30)`);
            return;
        }

        // Spawn enemy
        this.spawnEnemy();

        // Update state
        this.spawnCount++;
        this.nextSpawnTick = this.scene.tick + this.spawnRate;

        // Deactivate if done
        if (this.spawnCount >= this.totalEnemies) {
            this.isActive = false;
            console.log(`Spawner finished: spawned ${this.spawnCount}/${this.totalEnemies} enemies`);
        }
    }

    /**
     * Spawn a single enemy at spawner location
     */
    private spawnEnemy(): void {
        // Currently only supports EnemyLizardWizard
        // Future: Add enemy type registry to support multiple enemy types
        if (this.enemyType === 'EnemyLizardWizard') {
            const enemy = this.scene.addSlimeEnemy(this.x, this.y);

            // Apply custom behavior if provided
            if (this.behavior && enemy && enemy.setBehavior) {
                enemy.setBehavior(this.behavior);
            }

            console.log(`Spawner: spawned ${this.enemyType} #${this.spawnCount + 1}/${this.totalEnemies} at (${this.x}, ${this.y})`);
        } else {
            console.error(`Spawner: unknown enemy type "${this.enemyType}"`);
        }
    }

    /**
     * Check if spawner has finished spawning all enemies
     */
    isFinished(): boolean {
        return this.spawnCount >= this.totalEnemies;
    }

    /**
     * Get spawner statistics for debugging
     */
    getStats(): { spawned: number; total: number; active: boolean } {
        return {
            spawned: this.spawnCount,
            total: this.totalEnemies,
            active: this.isActive
        };
    }
}
