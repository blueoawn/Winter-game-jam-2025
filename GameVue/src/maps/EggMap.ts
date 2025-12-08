// Egg Map configuration
// A large vacuous room with indestructible walls

import { MapData } from './SummonerRift';
import { TerritorialBehavior } from '../behaviorScripts/Territorial';
import { AreaEffectType } from '../gameObjects/AreaBoundary';

/**
 * Egg Map Data
 * Single-room arena with egg-shaped boundaries
 */
export const EggMap: MapData = {
    id: 'egg-map',
    name: 'Egg Map',
    description: 'A large vacuous room with indestructible walls',

    // Map dimensions match Egg_map.png exactly
    width: 4288,
    height: 5632,

    // Reference to loaded asset
    assetKey: 'egg-map',

    // Player spawn locations
    // Calculations: center=(2144, 2816), left-center=(1072, 2816), right-center=(3216, 2816)
    spawnPoints: {
        default: { x: 2144, y: 2816 },  // Center of map (width/2, height/2)
        teamBlue: { x: 1072, y: 2816 }, // Left side (width*0.25, height/2) - Blue team
        teamRed: { x: 3216, y: 2816 },  // Right side (width*0.75, height/2) - Red team
    },

    // Enemy spawners in corners
    spawners: [
        // Top-left corner guardian
        {
            x: 600,
            y: 600,
            totalEnemies: 4,
            spawnRate: 8000,
            timeOffset: 2000,
            enemyType: 'EnemySlime',
            behaviorType: new TerritorialBehavior(600, 600, { moveSpeed: 80, territoryRadius: 250 })
        },
        // Top-right corner guardian
        {
            x: 3688,
            y: 600,
            totalEnemies: 4,
            spawnRate: 8000,
            timeOffset: 2000,
            enemyType: 'EnemySlime',
            behaviorType: new TerritorialBehavior(3688, 600, { moveSpeed: 80, territoryRadius: 250 })
        },
        // Bottom-left corner guardian
        {
            x: 600,
            y: 5032,
            totalEnemies: 4,
            spawnRate: 8000,
            timeOffset: 2000,
            enemyType: 'EnemySlime',
            behaviorType: new TerritorialBehavior(600, 5032, { moveSpeed: 80, territoryRadius: 250 })
        },
        // Bottom-right corner guardian
        {
            x: 3688,
            y: 5032,
            totalEnemies: 4,
            spawnRate: 8000,
            timeOffset: 2000,
            enemyType: 'EnemySlime',
            behaviorType: new TerritorialBehavior(3688, 5032, { moveSpeed: 80, territoryRadius: 250 })
        },
    ],

    walls: [],

    // Strategic consumables - placed in corners and center for teams to fight over
    consumables: [
        // Center power-ups (high value, contested)
        { x: 2144, y: 2816, type: 'HealthPack', value: 2 },
        { x: 2044, y: 2716, type: 'SpeedBoost', value: 1.5, lifetime: 30000 },
        { x: 2244, y: 2916, type: 'InvincibilityGem', value: 1, lifetime: 25000 },

        // Top-left corner rewards (guarded by slimes)
        { x: 600, y: 600, type: 'HealthPack', value: 1 },
        { x: 700, y: 700, type: 'SpeedBoost', value: 1.3, lifetime: 20000 },

        // Top-right corner rewards
        { x: 3688, y: 600, type: 'HealthPack', value: 1 },
        { x: 3588, y: 700, type: 'SpeedBoost', value: 1.3, lifetime: 20000 },

        // Bottom-left corner rewards
        { x: 600, y: 5032, type: 'HealthPack', value: 1 },
        { x: 700, y: 4932, type: 'SpeedBoost', value: 1.3, lifetime: 20000 },

        // Bottom-right corner rewards
        { x: 3688, y: 5032, type: 'HealthPack', value: 1 },
        { x: 3588, y: 4932, type: 'SpeedBoost', value: 1.3, lifetime: 20000 },

        // Mid-map health packs (between spawns)
        { x: 2144, y: 1400, type: 'HealthPack', value: 1 },  // Top middle
        { x: 2144, y: 4232, type: 'HealthPack', value: 1 },  // Bottom middle
        { x: 800, y: 2816, type: 'HealthPack', value: 1 },   // Left middle
        { x: 3488, y: 2816, type: 'HealthPack', value: 1 },  // Right middle
    ],

    // Area boundaries - Speed boost zones along all 4 edges
    areaBoundaries: [
        // Left edge speed zone
        {
            x: 75,              // 75px from left edge (half of 150px width)
            y: 2816,            // Center vertically (height/2)
            width: 150,
            height: 5632,       // Full map height
            effectType: AreaEffectType.SpeedModifier,
            speedMultiplier: 1.4,  // 40% speed boost
            visible: true,
            fillColor: 0x00BFFF,   // Deep sky blue
            fillAlpha: 0.2
        },
        // Right edge speed zone
        {
            x: 4213,            // 75px from right edge (4288 - 75)
            y: 2816,            // Center vertically (height/2)
            width: 150,
            height: 5632,       // Full map height
            effectType: AreaEffectType.SpeedModifier,
            speedMultiplier: 1.4,  // 40% speed boost
            visible: true,
            fillColor: 0x00BFFF,   // Deep sky blue
            fillAlpha: 0.2
        },
        // Top edge speed zone
        {
            x: 2144,            // Center horizontally (width/2)
            y: 75,              // 75px from top edge (half of 150px height)
            width: 4288,        // Full map width
            height: 150,
            effectType: AreaEffectType.SpeedModifier,
            speedMultiplier: 1.4,  // 40% speed boost
            visible: true,
            fillColor: 0x00BFFF,   // Deep sky blue
            fillAlpha: 0.2
        },
        // Bottom edge speed zone
        {
            x: 2144,            // Center horizontally (width/2)
            y: 5557,            // 75px from bottom edge (5632 - 75)
            width: 4288,        // Full map width
            height: 150,
            effectType: AreaEffectType.SpeedModifier,
            speedMultiplier: 1.4,  // 40% speed boost
            visible: true,
            fillColor: 0x00BFFF,   // Deep sky blue
            fillAlpha: 0.2
        }
    ]
}

export default EggMap;
