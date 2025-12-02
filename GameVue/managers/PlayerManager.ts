import Player from '../src/gameObjects/Player';
import type { Game } from '../src/scenes/Game';
import type { PlayerState } from '../network/StateSerializer';

export interface InputState {
    left?: boolean;
    right?: boolean;
    up?: boolean;
    down?: boolean;
    fire?: boolean;
}

// Manager class for handling multiple players in multiplayer
export class PlayerManager {
    private scene: Game;
    private players: Map<string, Player>;
    private localPlayerId: string | null;

    constructor(scene: Game) {
        this.scene = scene;
        this.players = new Map();
        this.localPlayerId = null;
    }

    // Create a player instance
    createPlayer(playerId: string, isLocal: boolean = false, shipId: number | null = null): Player {
        if (this.players.has(playerId)) {
            console.warn('Player already exists:', playerId);
            return this.players.get(playerId)!;
        }

        // Assign ship ID based on player count if not specified
        if (shipId === null) {
            shipId = this.players.size % 12;  // 12 ship sprites available
        }

        // Calculate spawn position
        const spawnX = this.scene.scale.width * 0.5;
        const spawnY = this.scene.scale.height - 100;

        // Create player instance
        const player = new Player(this.scene, spawnX, spawnY, shipId);
        (player as any).playerId = playerId;
        (player as any).isLocal = isLocal;

        this.players.set(playerId, player);

        if (isLocal) {
            this.localPlayerId = playerId;
        }

        console.log(`Created player: ${playerId} (local: ${isLocal}, shipId: ${shipId})`);

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
    getPlayer(playerId: string): Player | undefined {
        return this.players.get(playerId);
    }

    // Get the local player
    getLocalPlayer(): Player | null {
        return this.localPlayerId ? this.players.get(this.localPlayerId) || null : null;
    }

    // Get all players as an array
    getAllPlayers(): Player[] {
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
        if (player && (player as any).applyInput) {
            (player as any).applyInput(inputState);
        }
    }

    // Apply full player state from network (clients use this)
    applyPlayerState(playerStates: PlayerState[]): void {
        playerStates.forEach(state => {
            const player = this.players.get(state.id);
            if (player && (player as any).applyState) {
                (player as any).applyState(state);
            }
        });
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
