// Delta-based StateSerializer with per-entity change detection
// Tracks lastSent state maps and only outputs changed entities

import { SyncableEntity, EntityState } from './SyncableEntity';

export interface FullGameState {
    tick: number;
    players: Record<string, any>;
    enemies: Record<string, any>;
    projectiles: SyncableEntity[];
    walls: SyncableEntity[];
    score: number;
    scrollMovement: number;
    spawnEnemyCounter: number;
    gameStarted: boolean;
}

export interface SerializedDeltaState {
    tick: number;
    timestamp: number;
    players?: Record<string, any | null>;
    enemies?: Record<string, any | null>;
    projectiles?: Record<string, EntityState | null>;
    walls?: Record<string, EntityState | null>;
    meta?: Record<string, any>;
}

export class DeltaSerializer {
    private static lastPlayers: Record<string, any> = {};
    private static lastEnemies: Record<string, any> = {};
    private static lastProjectiles: Record<string, EntityState> = {};
    private static lastWalls: Record<string, EntityState> = {};
    private static lastMeta: Record<string, any> = {};

    static serializeDelta(state: FullGameState): SerializedDeltaState {
        const delta: SerializedDeltaState = {
            tick: state.tick,
            timestamp: Date.now(),
        };

        // Players
        delta.players = this.diffObjects(state.players, this.lastPlayers);
        this.lastPlayers = { ...state.players };

        // Enemies
        delta.enemies = this.diffObjects(state.enemies, this.lastEnemies);
        this.lastEnemies = { ...state.enemies };

        // Projectiles (entity array)
        const projectileMap: Record<string, EntityState> = {};
        for (const ent of state.projectiles) {
            const s = ent.getNetworkState();
            if (s) projectileMap[s.id] = s;
        }
        delta.projectiles = this.diffObjects(projectileMap, this.lastProjectiles);
        this.lastProjectiles = { ...projectileMap };

        // Walls
        const wallMap: Record<string, EntityState> = {};
        for (const ent of state.walls) {
            const s = ent.getNetworkState();
            if (s) wallMap[s.id] = s;
        }
        delta.walls = this.diffObjects(wallMap, this.lastWalls);
        this.lastWalls = { ...wallMap };

        // Meta fields
        const meta = {
            score: state.score,
            scrollMovement: state.scrollMovement,
            spawnEnemyCounter: state.spawnEnemyCounter,
            gameStarted: state.gameStarted,
        };
        delta.meta = this.diffFlat(meta, this.lastMeta);
        this.lastMeta = { ...meta };

        return delta;
    }

    private static diffObjects(current: Record<string, any>, previous: Record<string, any>) {
        const diff: Record<string, any | null> = {};

        // additions & changes
        for (const id in current) {
            if (!previous[id] || JSON.stringify(current[id]) !== JSON.stringify(previous[id])) {
                diff[id] = current[id];
            }
        }

        // removals
        for (const id in previous) {
            if (!current[id]) diff[id] = null;
        }

        return diff;
    }

    private static diffFlat(current: Record<string, any>, previous: Record<string, any>) {
        const diff: Record<string, any> = {};
        for (const key in current) {
            if (current[key] !== previous[key]) diff[key] = current[key];
        }
        return diff;
    }
}
