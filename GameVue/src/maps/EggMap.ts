// Egg Map configuration
// A large vacuous room with indestructible walls

import { MapData } from './SummonerRift';

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

    spawners: [],

    walls: [],

    consumables: [],

    areaBoundaries: []
}

export default EggMap;
