// Dungeon Crawl map configuration
// A procedural dungeon crawler style map with rooms and corridors

import { AggressiveBehavior } from "../behaviorScripts/Aggressive";
import { TerritorialBehavior } from "../behaviorScripts/Territorial";
import { MapData } from './SummonerRift';

/**
 * Dungeon Crawl Map
 * Dark dungeon environment with tile-based layout
 */
export const DungeonCrawl: MapData = {
    id: 'dungeon-crawl',
    name: 'Dungeon Crawl',
    description: 'A dark dungeon filled with monsters and treasures',

    // Map dimensions - 100x80 tiles at 16px = 1600x1280
    width: 1600,
    height: 1280,

    // Reference to loaded tilemap asset
    assetKey: 'dungeon-crawl-map',
    isTilemap: true,  // Flag to indicate this uses a tilemap instead of static image
    tilemapTilesetKey: 'dungeon-tilemap',  // The spritesheet key for tiles
    
    // Tilemap configuration
    tileWidth: 16,
    tileHeight: 16,
    mapWidth: 100,  // Width in tiles
    mapHeight: 80,  // Height in tiles

    // Player spawn locations - Start in the bottom center room
    spawnPoints: {
        default: { x: 800, y: 1000 },  // Bottom center room (50*16, 62*16)
        team1: { x: 400, y: 1000 },    // Bottom left
        team2: { x: 1200, y: 1000 },   // Bottom right
    },

    // Enemy spawners - Scattered throughout the dungeon
    spawners: [
        // Bottom room guardians
        {
            x: 400,
            y: 900,
            totalEnemies: 3,
            spawnRate: 5000,
            timeOffset: 1000,
            enemyType: 'EnemySlime',
            behaviorType: new TerritorialBehavior(400, 900, { moveSpeed: 80, territoryRadius: 200 })
        },
        {
            x: 1200,
            y: 900,
            totalEnemies: 3,
            spawnRate: 5000,
            timeOffset: 1000,
            enemyType: 'EnemySlime',
            behaviorType: new TerritorialBehavior(1200, 900, { moveSpeed: 80, territoryRadius: 200 })
        },

        // Central chamber - Wizard boss
        {
            x: 800,
            y: 640,
            totalEnemies: 1,
            spawnRate: 0,
            timeOffset: 2000,
            enemyType: 'EnemyLizardWizard',
            behaviorType: new AggressiveBehavior({ moveSpeed: 120, attackRange: 600, ability1Rate: 2000, ability2Rate: 5000 })
        },

        // Top room - Flying enemies
        {
            x: 400,
            y: 380,
            totalEnemies: 5,
            spawnRate: 4000,
            timeOffset: 3000,
            enemyType: 'EnemyFlying',
            behaviorType: new AggressiveBehavior({ moveSpeed: 150, attackRange: 400, ability1Rate: 1500 })
        },
        {
            x: 1200,
            y: 380,
            totalEnemies: 5,
            spawnRate: 4000,
            timeOffset: 3000,
            enemyType: 'EnemyFlying',
            behaviorType: new AggressiveBehavior({ moveSpeed: 150, attackRange: 400, ability1Rate: 1500 })
        },

        // Left corridor
        {
            x: 200,
            y: 640,
            totalEnemies: -1,  // Infinite slimes
            spawnRate: 8000,
            timeOffset: 5000,
            enemyType: 'EnemySlime',
            behaviorType: new TerritorialBehavior(200, 640, { moveSpeed: 60, territoryRadius: 150 })
        },

        // Right corridor
        {
            x: 1400,
            y: 640,
            totalEnemies: -1,  // Infinite slimes
            spawnRate: 8000,
            timeOffset: 5000,
            enemyType: 'EnemySlime',
            behaviorType: new TerritorialBehavior(1400, 640, { moveSpeed: 60, territoryRadius: 150 })
        },
    ],

    // Dungeon walls - Create rooms and corridors
    walls: [
        // North wall barrier
        { x: 600, y: 200, spriteKey: 'cookie-cutter-wall', health: 10 },
        { x: 664, y: 200, spriteKey: 'cookie-cutter-wall', health: 10 },
        { x: 728, y: 200, spriteKey: 'cookie-cutter-wall', health: 10 },
        { x: 792, y: 200, spriteKey: 'cookie-cutter-wall', health: 10 },
        { x: 856, y: 200, spriteKey: 'cookie-cutter-wall', health: 10 },
        { x: 920, y: 200, spriteKey: 'cookie-cutter-wall', health: 10 },
        { x: 984, y: 200, spriteKey: 'cookie-cutter-wall', health: 10 },

        // Central dividing walls
        { x: 500, y: 640, spriteKey: 'cookie-cutter-wall', health: 8 },
        { x: 1100, y: 640, spriteKey: 'cookie-cutter-wall', health: 8 },
    ],

    // Consumable items - Rewards in various rooms
    consumables: [
        // Bottom room health packs
        { x: 300, y: 950, type: 'HealthPack', value: 1 },
        { x: 1300, y: 950, type: 'HealthPack', value: 1 },

        // Speed boost in central chamber
        { x: 800, y: 640, type: 'SpeedBoost', value: 1.5, lifetime: 30000 },

        // Top room rewards
        { x: 400, y: 300, type: 'HealthPack', value: 1 },
        { x: 1200, y: 300, type: 'HealthPack', value: 1 },

        // Corridor pickups
        { x: 150, y: 640, type: 'SpeedBoost', value: 1.3, lifetime: 20000 },
        { x: 1450, y: 640, type: 'SpeedBoost', value: 1.3, lifetime: 20000 },
    ],

    // Area boundaries - No special zones in basic dungeon
    areaBoundaries: []
}

// Default export for convenience
export default DungeonCrawl;
