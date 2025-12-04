// TEMPLATE: Copy this file to create a new map
// 1. Copy this file and rename it (e.g., HowlingAbyss.ts)
// 2. Update all the values below for your new map
// 3. Add the map asset to assets.ts
// 4. Import and add your map to MapRegistry.ts
// 5. Your map will be automatically available in the game!

import { MapData } from './SummonerRift';

/**
 * Example Map Template
 * Replace this with your actual map name and description
 */
export const ExampleMap: MapData = {
    // Unique identifier for this map
    id: 'example-map',

    // Display name
    name: 'Example Map',

    // Short description
    description: 'A template for creating new maps',

    // Map dimensions in pixels (get these from your background image)
    width: 1920,
    height: 1080,

    // Asset key from assets.ts (must match what you register in assets.ts)
    assetKey: 'example-map-background',

    // Player spawn locations
    spawnPoints: {
        // Default spawn (required)
        default: { x: 960, y: 900 },  // Center-bottom
    },

    // Spawns for entities like NPCs or other game objects
    entities: [
        { id: 'boss', type: 'boss-monster', position: { x: 960, y: 540 } },
        { id: 'buff-red', type: 'buff', position: { x: 400, y: 800 } },
        { id: 'buff-blue', type: 'buff', position: { x: 1520, y: 280 } },
    ]
};

// Export as default for convenience
export default ExampleMap;

//Adding a new map

/*
 * 1. Register the background asset in assets.ts:
 *    image: {
 *        exampleMap: {
 *            key: 'example-map-background',
 *            args: ['assets/Backgrounds/exampleMap.png']
 *        }
 *    }
 *
 * 2. Add to MapRegistry.ts:
 *    import ExampleMap from './ExampleMap';
 *    export const MapRegistry: Record<string, MapData> = {
 *        'summoners-rift': SummonersRift,
 *        'example-map': ExampleMap,  // <-- Add this line
 *    };
 *
 * 3. Load the map in game:
 *    - To make it the default: Change getDefaultMap() in MapRegistry.ts
 *    - To load dynamically: Call this.loadMap('example-map') in GameScene
 *    - To let players choose: Add map selection in the menu
 *
 */
