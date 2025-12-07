import { PlayerController } from '../src/gameObjects/Characters/PlayerController.ts';
import { LizardWizard } from '../src/gameObjects/Characters/LizardWizard';
import { SwordAndBoard } from '../src/gameObjects/Characters/SwordAndBoard';
import { CheeseTouch } from '../src/gameObjects/Characters/CheeseTouch';
import { BigSword } from '../src/gameObjects/Characters/BigSword';
import type { GameScene } from '../src/scenes/GameScene.ts';
import { CharacterNamesEnum } from "../src/gameObjects/Characters/CharactersEnum.ts";

// Manager class for handling multiple players in multiplayer
export class PlayerManager {
    private scene: GameScene;
    private players: Map<string, PlayerController>;
    private localPlayerId: string | null;

    constructor(scene: GameScene) {
        this.scene = scene;
        this.players = new Map();
        this.localPlayerId = null;
    }

    // Create a player instance
    createPlayer(
        playerId: string,
        isLocal: boolean = false,
        characterType: CharacterNamesEnum,
    ): PlayerController {
        if (this.players.has(playerId)) {
            return this.players.get(playerId)!;
        }

        // Get spawn position from current map data
        const spawn = (this.scene as any).currentMap?.spawnPoints?.default || { x: 800, y: 1000 };
        const spawnX = spawn.x;
        const spawnY = spawn.y;

        // Create character instance based on type
        let player: PlayerController;


        switch (characterType) {
            case CharacterNamesEnum.BigSword:
                player = new BigSword(this.scene, spawnX, spawnY);
                break;
            case CharacterNamesEnum.SwordAndBoard:
                player = new SwordAndBoard(this.scene, spawnX, spawnY);
                break;
            case CharacterNamesEnum.CheeseTouch:
                player = new CheeseTouch(this.scene, spawnX, spawnY);
                break;
            case CharacterNamesEnum.LizardWizard:
            default:
                player = new LizardWizard(this.scene, spawnX, spawnY);
                break;
        }

        (player as any).playerId = playerId;
        (player as any).isLocal = isLocal;

        this.players.set(playerId, player);

        if (isLocal) {
            this.localPlayerId = playerId;
        }

        console.log(`Created player: ${playerId} (${characterType}, local: ${isLocal})`);

        return player;
    }

    // Remove a player instance
    removePlayer(playerId: string): void {
        const player = this.players.get(playerId);
        if (player) {
            player.destroy();
            this.players.delete(playerId);
            console.log('Removed player:', playerId);
        }
    }

    // Get a specific player
    getPlayer(playerId: string): PlayerController | undefined {
        return this.players.get(playerId);
    }

    // Get the local player
    getLocalPlayer(): PlayerController | null {
        return this.localPlayerId ? this.players.get(this.localPlayerId) || null : null;
    }

    // Get all players as an array
    getAllPlayers(): PlayerController[] {
        return Array.from(this.players.values());
    }

    // Get all player IDs
    getAllPlayerIds(): string[] {
        return Array.from(this.players.keys());
    }

    // Update all players
    update(): void {
        this.players.forEach(player => {
            if ((player as any).update) {
                (player as any).update();
            }
        });
    }

    // Apply input state to a player (host uses this for all players)
    applyInput(playerId: string, inputState: InputState): void {
        const player = this.players.get(playerId);
        if (player && (player as PlayerController).applyInput) {
            (player as PlayerController).applyInput(inputState);
        }
    }

    // Apply full player state from network (clients use this)
    applyPlayerState(playerStates: PlayerState[]): void {
        try {
            if (!Array.isArray(playerStates)) {
                console.error('[MULTIPLAYER] applyPlayerState received non-array:', typeof playerStates);
                return;
            }

            playerStates.forEach(state => {
                if (!state || !state.id) {
                    console.warn('[MULTIPLAYER] Invalid player state (no id):', state);
                    return;
                }

                const player = this.players.get(state.id);
                if (!player) {
                    console.warn('[MULTIPLAYER] Player not found:', state.id);
                    return;
                }

                if ((player as any).applyState) {
                    try {
                        (player as any).applyState(state);
                    } catch (err) {
                        console.error(`[MULTIPLAYER] Error applying state to player ${state.id}:`, err);
                    }
                } else {
                    console.warn(`[MULTIPLAYER] Player ${state.id} doesn't have applyState method`);
                }
            });
        } catch (err) {
            console.error('[MULTIPLAYER] Error in applyPlayerState:', err);
        }
    }

    // Collect current state of all players for serialization
    collectPlayerStates(): PlayerState[] {
        const states: PlayerState[] = [];

        this.players.forEach((player, playerId) => {
            const body = player.body as Phaser.Physics.Arcade.Body | null;
            states.push({
                id: playerId,
                x: player.x,
                y: player.y,
                velocityX: body?.velocity?.x || 0,
                velocityY: body?.velocity?.y || 0,
                health: player.health,
                frame: player.frame?.name || 0,
                rotation: player.rotation
            });
        });

        return states;
    }

    // Collect local player input for sending to host
    collectLocalInput(): InputState | null {
        const localPlayer = this.getLocalPlayer();
        if (!localPlayer || !(localPlayer as any).getCurrentInput) {
            return null;
        }

        return (localPlayer as any).getCurrentInput();
    }

    // Clear all players
    clear(): void {
        this.players.forEach(player => player.destroy());
        this.players.clear();
        this.localPlayerId = null;
    }

    // Get player count
    getPlayerCount(): number {
        return this.players.size;
    }
}
