// DeltaDeserializer - reconstructs full authoritative game state from delta packets

import { EntityState } from './SyncableEntity';

export interface ReconstructedGameState {
    tick: number;
    timestamp: number;
    players: Record<string, any>;
    enemies: Record<string, any>;
    projectiles: Record<string, EntityState>;
    walls: Record<string, EntityState>;
    meta: Record<string, any>;
}

export class DeltaDeserializer {
    private fullPlayers: Record<string, any> = {};
    private fullEnemies: Record<string, any> = {};
    private fullProjectiles: Record<string, EntityState> = {};
    private fullWalls: Record<string, EntityState> = {};
    private meta: Record<string, any> = {};

    applyDelta(delta: any): ReconstructedGameState {
        // Players
        if (delta.players) {
            this.applyObjectDelta(this.fullPlayers, delta.players);
        }

        // Enemies
        if (delta.enemies) {
            this.applyObjectDelta(this.fullEnemies, delta.enemies);
        }

        // Projectiles
        if (delta.projectiles) {
            this.applyObjectDelta(this.fullProjectiles, delta.projectiles);
        }

        // Walls
        if (delta.walls) {
            this.applyObjectDelta(this.fullWalls, delta.walls);
        }

        // Meta fields
        if (delta.meta) {
            for (const key in delta.meta) {
                this.meta[key] = delta.meta[key];
            }
        }

        return {
            tick: delta.tick,
            timestamp: delta.timestamp,
            players: { ...this.fullPlayers },
            enemies: { ...this.fullEnemies },
            projectiles: { ...this.fullProjectiles },
            walls: { ...this.fullWalls },
            meta: { ...this.meta },
        };
    }

    private applyObjectDelta(target: Record<string, any>, delta: Record<string, any | null>) {
        for (const id in delta) {
            const change = delta[id];

            if (change === null) {
                delete target[id];
                continue;
            }

            // Overwrite or create
            target[id] = change;
        }
    }
}
