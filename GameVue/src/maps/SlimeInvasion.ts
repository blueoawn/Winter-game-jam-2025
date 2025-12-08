/**
 * SlimeInvasion.ts
 * Wave-based level where player defends against slime waves and a boss
 */

import { MapData } from './SummonerRift';

/**
 * Slime Invasion map data
 * Wave-based defense level with boss fight
 *
 * Level progression:
 * - Wave 1: 5 slimes spawn from edges
 * - Wave 2: 8 slimes spawn from edges
 * - Boss: Lizard Wizard boss spawns at center
 * - Reward: Unlock Lizard Wizard character
 */
export const SlimeInvasion: MapData = {
    id: 'slime-invasion',
    name: 'Slime Invasion',
    description: 'Defend against waves of explosive slimes and defeat the Lizard Wizard boss!',

    // Smaller arena for wave defense (1200x1000)
    width: 1200,
    height: 1000,

    // Use Summoners Rift background for now
    assetKey: 'summoners-rift',

    // Player spawn - center of arena
    spawnPoints: {
        default: { x: 600, y: 500 }
    },

    // No lanes for this level
    lanes: undefined,

    // No strategic objectives
    entities: [],

    // No spawners - wave manager handles spawning
    spawners: [],

    // No walls - open arena
    walls: [],

    // Optional health pack in center for difficulty balance
    consumables: [
        { x: 600, y: 500, type: 'HealthPack', value: 1 }
    ],

    // No area boundaries
    areaBoundaries: []
};

export default SlimeInvasion;

