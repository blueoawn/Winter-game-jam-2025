/**
 * Wall Usage Examples
 *
 * This file demonstrates how to create and use Wall objects in our game.
 *
 * Note: Collisions and network sync are handled automatically - you don't need to set them up!
 */

import Wall from './Wall';
import type { GameScene } from '../scenes/Game';
import ASSETS from '../assets';

/**
 * Example 1: Creating an indestructible wall
 * Perfect for permanent map boundaries and obstacles
 */
function createIndestructibleWall(scene: GameScene) {
    const wall = new Wall(
        scene,
        400,                            // x position
        300,                            // y position
        ASSETS.spritesheet.tiles.key,  // sprite key (required)
        0,                              // sprite frame
        -1                              // -1 = indestructible
    );

    scene.addWall(wall);
    return wall;
}

/**
 * Example 2: Creating a destructible wall
 * Players can shoot these down - great for dynamic cover
 */
function createDestructibleWall(scene: GameScene) {
    const wall = new Wall(
        scene,
        600,                            // x position
        300,                            // y position
        ASSETS.spritesheet.tiles.key,  // sprite key (required)
        1,                              // sprite frame
        100                             // health (will show health bar)
    );

    scene.addWall(wall);
    return wall;
}

/**
 * Example 3: Using different sprites
 * Any spritesheet frame can be used for walls
 */
function createCustomSpriteWall(scene: GameScene) {
    const wall = new Wall(
        scene,
        800,                                // x position
        400,                                // y position
        ASSETS.spritesheet.ships.key,      // custom sprite key
        5,                                  // sprite frame
        50                                  // health
    );

    scene.addWall(wall);
    return wall;
}

/**
 * Example 4: Creating a wall barrier
 * Useful for creating cover structures or maze walls
 */
function createWallBarrier(scene: GameScene, startX: number, startY: number, count: number) {
    const walls: Wall[] = [];
    const tileSize = 32;  // Tiles are 32x32 pixels

    for (let i = 0; i < count; i++) {
        const wall = new Wall(
            scene,
            startX + (i * tileSize),
            startY,
            ASSETS.spritesheet.tiles.key,
            2,  // Frame 2 for wall barrier segments
            75  // Each wall section has 75 health (destructible)
        );

        scene.addWall(wall);
        walls.push(wall);
    }

    return walls;
}

/**
 * Example 5: Damaging a wall programmatically
 * Walls automatically handle destruction when health reaches 0
 */
function damageWallExample(wall: Wall) {
    wall.hit(25);  // Apply 25 damage
    // Wall will automatically be destroyed and removed when health reaches 0
}

/**
 * Example 6: Loading walls from map data
 * This is the recommended approach for level design
 */
function loadWallsFromMapData(scene: GameScene, mapData: any) {
    if (mapData.walls) {
        mapData.walls.forEach((wallData: any) => {
            const wall = new Wall(
                scene,
                wallData.x,
                wallData.y,
                wallData.spriteKey || ASSETS.spritesheet.tiles.key,
                wallData.frame || 0,
                wallData.health || -1  // Default to indestructible
            );

            scene.addWall(wall);
        });
    }
}

/**
 * Example 7: Map data structure for walls
 * Add this to your map configuration files
 */
const exampleMapData = {
    walls: [
        // Indestructible boundary wall
        {
            x: 400,
            y: 300,
            spriteKey: ASSETS.spritesheet.tiles.key,
            frame: 0,
            health: -1
        },
        // Destructible cover (weak)
        {
            x: 500,
            y: 300,
            spriteKey: ASSETS.spritesheet.tiles.key,
            frame: 1,
            health: 50
        },
        // Destructible cover (strong)
        {
            x: 600,
            y: 300,
            spriteKey: ASSETS.spritesheet.tiles.key,
            frame: 2,
            health: 150
        }
    ]
};

// Export examples for reference
export {
    createIndestructibleWall,
    createDestructibleWall,
    createCustomSpriteWall,
    createWallBarrier,
    damageWallExample,
    loadWallsFromMapData,
    exampleMapData
};
