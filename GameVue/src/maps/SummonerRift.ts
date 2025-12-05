// Summoners Rift map configuration
// A three-lane battle arena map

import { AggressiveBehavior } from "../behaviorScripts/Aggressive";
import { IBehavior } from "../behaviorScripts/Behavior";

/**
 * Spawner configuration for enemy spawning
 */
export interface SpawnerConfig {
    x: number;
    y: number;
    totalEnemies: number;
    spawnRate: number;      // Milliseconds between spawns
    timeOffset: number;     // Milliseconds before first spawn
    enemyType: string;      // e.g., 'EnemyLizardWizard'
    behaviorType?: IBehavior;  // 'Aggressive' | 'Territorial' | 'Pacifist'
    behaviorOptions?: any;  // Behavior-specific configuration
}

/**
 * Map data interface for defining game maps
 * All maps should conform to this structure
 */
export interface MapData {
    id: string;
    name: string;
    description: string;

    // Map dimensions
    width: number;
    height: number;

    // Asset reference
    assetKey: string;  // Key used in assets.ts

    // Spawn points
    spawnPoints: {
        default: { x: number; y: number };
        team1?: { x: number; y: number };
        team2?: { x: number; y: number };
        spectator?: { x: number; y: number };
    };

    lanes?: {
        top?: { start: { x: number; y: number }; end: { x: number; y: number } };
        mid?: { start: { x: number; y: number }; end: { x: number; y: number } };
        bot?: { start: { x: number; y: number }; end: { x: number; y: number } };
    };

    // Optional: Strategic points of interest
    entities?: Array<{
        id: string;
        type: string;
        position: { x: number; y: number };
    }>;

    // Optional: Enemy spawner configurations
    spawners?: SpawnerConfig[];

    // Optional: Wall configurations
    walls?: Array<{
        x: number;
        y: number;
        spriteKey: string;
        frame?: number;
        health: number;
    }>;
}

/**
 * Summoners Rift map data
 * Classic three-lane MOBA-style map
 */
export const SummonersRift: MapData = {
    id: 'summoners-rift',
    name: "Summoner's Rift",
    description: 'A classic three-lane battle arena',

    // Map dimensions (from summonersRift.png: 1600x1343)
    width: 1600,
    height: 1343,

    // Reference to loaded asset
    assetKey: 'summoners-rift',

    // Player spawn locations
    spawnPoints: {
        default: { x: 800, y: 1000 },
        team1: { x: 400, y: 1200 },         // Bottom-left corner (blue team spawn)
        team2: { x: 1200, y: 143 },         // Top-right corner (red team spawn)
    },

    // Lane definitions (approximate)
    lanes: {
        top: {
            start: { x: 200, y: 1100 },
            end: { x: 1400, y: 243 }
        },
        mid: {
            start: { x: 200, y: 1100 },
            end: { x: 1400, y: 243 }
        },
        bot: {
            start: { x: 200, y: 1100 },
            end: { x: 1400, y: 243 }
        },
    },

    // Strategic objectives
    entities: [
        { id: 'dragon', type: 'neutral-objective', position: { x: 400, y: 800 } },
        { id: 'baron', type: 'neutral-objective', position: { x: 1200, y: 543 } },
    ],

    // Enemy spawners
    spawners: [
        {
            x: 800,              // Map center X
            y: 672,              // Map center Y (1343/2 ≈ 672)
            totalEnemies: 10,
            spawnRate: 2000,     // 2 seconds between spawns
            timeOffset: 0,    // Start immediately
            enemyType: 'EnemyLizardWizard',
            behaviorType: new AggressiveBehavior({moveSpeed: 100, attackRange: 500, ability1Rate: 1000, ability2Rate:3000})
        }
    ],

    // Wall barriers - Destructible barrier across mid lane
    walls: [
        { x: 600, y: 672, spriteKey: 'cookie-cutter-wall', health: 5 },
        { x: 664, y: 672, spriteKey: 'cookie-cutter-wall', health: 5 },
        { x: 728, y: 672, spriteKey: 'cookie-cutter-wall', health: 5 },
        { x: 792, y: 672, spriteKey: 'cookie-cutter-wall', health: 5 },
        { x: 856, y: 672, spriteKey: 'cookie-cutter-wall', health: 5 },
        { x: 920, y: 672, spriteKey: 'cookie-cutter-wall', health: 5 },
        { x: 984, y: 672, spriteKey: 'cookie-cutter-wall', health: 5 },
    ]
};

// Default export for convenience
export default SummonersRift;