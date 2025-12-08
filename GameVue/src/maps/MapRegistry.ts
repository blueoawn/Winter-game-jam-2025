// Map Registry - Manages all available maps in the game
// Add new maps here as they are created

import { MapData } from './SummonerRift';
import SummonersRift from './SummonerRift';
import DungeonCrawl from './DungeonCrawl';
import SlimeInvasion from './SlimeInvasion';

/**
 * Registry of all available maps
 * Maps are indexed by their ID for easy lookup
 */
export const MapRegistry: Record<string, MapData> = {
    'summoners-rift': SummonersRift,
    'dungeon-crawl': DungeonCrawl,
    'slime-invasion': SlimeInvasion,
};

/**
 * Get a map by its ID
 * @param mapId The map's unique identifier
 * @returns The map data, or undefined if not found
 */
export function getMapById(mapId: string): MapData | undefined {
    return MapRegistry[mapId];
}

/**
 * Get the default map (Summoners Rift)
 * @returns The default map data
 */
export function getDefaultMap(): MapData {
    return SummonersRift;
}

/**
 * Get all available map IDs
 * @returns Array of map IDs
 */
export function getAvailableMapIds(): string[] {
    return Object.keys(MapRegistry);
}

/**
 * Get all available maps
 * @returns Array of map data
 */
export function getAllMaps(): MapData[] {
    return Object.values(MapRegistry);
}

/**
 * Check if a map exists
 * @param mapId The map ID to check
 * @returns True if the map exists
 */
export function mapExists(mapId: string): boolean {
    return mapId in MapRegistry;
}
