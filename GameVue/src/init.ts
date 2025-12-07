/**
 * Initialization utilities for Game Scene
 * Extracted from Game.ts to reduce scene file complexity
 */

import { Scene } from 'phaser';
import ANIMATION from './animation';
import { MapData } from './maps/SummonerRift';

/**
 * Initialize game variables and configuration
 */
export function initVariables(scene: Scene, _currentMap: MapData): {
    score: number;
    centreX: number;
    centreY: number;
    tileSize: number;
    mapOffset: number;
    mapTop: number;
    mapHeight: number;
    mapWidth: number;
    spawnEnemyCounter: number;
    stateSyncRate: number;
    inputSendRate: number;
    tick: number;
} {
    return {
        score: 0,
        centreX: scene.scale.width * 0.5,
        centreY: scene.scale.height * 0.5,
        tileSize: 32,
        mapOffset: 10,
        mapTop: -10 * 32,
        mapHeight: Math.ceil(scene.scale.height / 32) + 10 + 1,
        mapWidth: Math.ceil(scene.scale.width / 32),
        spawnEnemyCounter: 0,
        stateSyncRate: 1000 / 15, // 15 times per second (host broadcasts state)
        inputSendRate: 1000 / 15, // 15 times per second (clients send input)
        tick: 0
    };
}

/**
 * Initialize background image from map data
 */
export function initBackground(scene: Scene, currentMap: MapData): void {
    scene.add.image(
        currentMap.width / 2,
        currentMap.height / 2,
        currentMap.assetKey
    )
        .setOrigin(0.5, 0.5)
        .setDepth(0);
}

/**
 * Initialize physics world bounds
 */
export function initWorldBounds(scene: Scene, currentMap: MapData): void {
    scene.physics.world.setBounds(0, 0, currentMap.width, currentMap.height);
}

/**
 * Initialize camera settings
 */
export function initCamera(scene: Scene, currentMap: MapData, playerToFollow?: Phaser.GameObjects.Sprite | null): void {
    const camera = scene.cameras.main;
    camera.setBounds(0, 0, currentMap.width, currentMap.height);

    if (playerToFollow) {
        camera.startFollow(playerToFollow, true, 0.1, 0.1);
    }
}

/**
 * Initialize UI elements (score text, etc)
 */
export function initGameUi(scene: Scene): {
    scoreText: Phaser.GameObjects.Text;
    tutorialText: Phaser.GameObjects.Text;
    gameOverText: Phaser.GameObjects.Text;
} {
    const scoreText = scene.add.text(10, 10, 'Score: 0', {
        font: '16px Arial',
        color: '#ffffff'
    })
        .setScrollFactor(0)
        .setDepth(200);

    const tutorialText = scene.add.text(
        scene.scale.width / 2,
        scene.scale.height / 2,
        '',
        { font: '32px Arial', color: '#ffffff' }
    )
        .setOrigin(0.5)
        .setScrollFactor(0)
        .setDepth(200);

    const gameOverText = scene.add.text(
        scene.scale.width / 2,
        scene.scale.height / 2,
        '',
        { font: '48px Arial', color: '#ffffff' }
    )
        .setOrigin(0.5)
        .setScrollFactor(0)
        .setDepth(200)
        .setVisible(false);

    return { scoreText, tutorialText, gameOverText };
}

/**
 * Initialize animations from asset config
 */
export function initAnimations(scene: Scene): void {
    // Player animations
    Object.entries(ANIMATION).forEach(([key, config]: [string, any]) => {
        if (!scene.anims.exists(key)) {
            scene.anims.create({
                key,
                frames: scene.anims.generateFrameNumbers(config.texture, config.config),
                frameRate: config.frameRate,
                repeat: config.repeat
            });
        }
    });
}

/**
 * Initialize input system
 */
export function initInput(scene: Scene): Phaser.Types.Input.Keyboard.CursorKeys | undefined {
    // Enable keyboard input if not using ButtonMapper
    try {
        return scene.input.keyboard?.createCursorKeys();
    } catch (err) {
        console.warn('Could not initialize cursor keys:', err);
        return undefined;
    }
}

/**
 * Initialize physics system
 */
export function initPhysics(_scene: Scene): void {
    // Set up default physics groups and colliders
    // Specific collision groups are set up per-scene in their own update methods
}
