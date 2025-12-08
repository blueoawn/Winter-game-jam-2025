//TODO - refactor SceneManager to use a registry pattern for scene creation and transitioning

import type { GameScene } from '../src/scenes/GameScene';

/**
 * SceneManager
 * Centralized management of scene transitions and game lifecycle
 * Separates scene management logic from gameplay
 */
export class SceneManager {
    /**
     * Initialize the game (start state)
     * Called once at game startup
     */
    static startGameSession(scene: GameScene): void {
        // Prevent double-spawning if startGame is called multiple times
        if (scene.gameStarted) return;

        scene.gameStarted = true;
        
        // Safely hide tutorial text if it exists
        if (scene.tutorialText) {
            scene.tutorialText.setVisible(false);
        }

        // Enemies will now spawn based off of data in the map.
        console.log('[SCENE] Game started');
    }

    /**
     * End the game and transition to GameOver scene
     * Triggers camera fade and scene transition
     */
    static endGameSession(scene: GameScene): void {
        scene.gameStarted = false;
        
        console.log('[SCENE] Game ended, transitioning to GameOver');
        
        scene.cameras.main.fade(1000, 0, 0, 0, false, (_camera: Phaser.Cameras.Scene2D.Camera, progress: number) => {
            if (progress === 1) {
                scene.scene.start('GameOver');
            }
        });
    }

    /**
     * Pause the current scene (for multiplayer disconnect, etc)
     */
    static pauseGame(scene: GameScene): void {
        scene.gameStarted = false;
        scene.scene.pause();
        console.log('[SCENE] Game paused');
    }

    /**
     * Resume a paused game scene
     */
    static resumeGame(scene: GameScene): void {
        scene.gameStarted = true;
        scene.scene.resume();
        console.log('[SCENE] Game resumed');
    }

    /**
     * Return to main menu
     */
    static returnToMenu(scene: GameScene): void {
        console.log('[SCENE] Returning to menu');
        scene.scene.start('Start');
    }

    /**
     * Restart the current game session
     */
    static restartGame(scene: GameScene): void {
        console.log('[SCENE] Restarting game');
        scene.scene.restart();
    }

    /**
     * Transition to lobby (multiplayer)
     */
    static goToLobby(scene: GameScene): void {
        console.log('[SCENE] Transitioning to lobby');
        scene.scene.start('Lobby');
    }

    /**
     * Shutdown the game scene (cleanup)
     * Should be called when leaving the Game scene
     */
    static shutdownScene(scene: GameScene): void {
        console.log('[SCENE] Shutting down game scene');
        
        // Clean up network listeners if enabled
        if (scene.networkEnabled) {
            try {
                // NetworkManager cleanup would go here if needed
            } catch (err) {
                console.error('[SCENE] Error during network cleanup:', err);
            }
        }
    }
}