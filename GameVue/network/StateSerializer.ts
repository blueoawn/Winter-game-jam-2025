// State serialization and deserialization for network transmission

import Vector2 = Phaser.Math.Vector2;

export interface PlayerState {
    id: string;
    x: number;
    y: number;
    velocityX: number;
    velocityY: number;
    health: number;
    frame: number | string;
    rotation: number;
}

export interface EnemyState {
    id: string;
    x: number;
    y: number;
    health: number;
    pathProgress: number;
    shipId: number;
    pathId: number;
    power: number;
}

export interface BulletState {
    id: string;
    x: number;
    y: number;
    velocityX: number;
    velocityY: number;
    ownerId: string;
    type: 'player' | 'enemy';
    power: number;
}

export interface GameStateData {
    score: number;
    scrollMovement: number;
    spawnEnemyCounter: number;
    gameStarted: boolean;
}

export interface SerializedGameState {
    timestamp: number;
    tick: number;
    players: PlayerState[];
    enemies: EnemyState[];
    bullets: BulletState[];
    gameState: GameStateData;
}

export interface InputState {
    movementSpeed: number;
    velocity: Vector2;
    rotation: number;
    ability1: boolean;  // Primary ability (was "fire")
    ability2: boolean;  // Secondary ability
    fire?: boolean;     // Deprecated - kept for backward compatibility
}

export interface SerializedInput {
    playerId: string;
    timestamp: number;
    inputs: InputState;
}

interface PlayerObject {
    id?: string;
    playerId?: string;
    x: number;
    y: number;
    body?: {
        velocity?: {
            x?: number;
            y?: number;
        };
    };
    health: number;
    frame?: {
        name?: number | string;
    };
    rotation: number;
}

interface EnemyObject {
    enemyId?: string;
    id?: string;
    x: number;
    y: number;
    health: number;
    pathProgress: number;
    shipId: number;
    pathId: number;
    power: number;
}

interface BulletObject {
    bulletId?: string;
    id?: string;
    x: number;
    y: number;
    body?: {
        velocity?: {
            x?: number;
            y?: number;
        };
    };
    ownerId: string;
    type?: 'player' | 'enemy';
    power?: number;
}

interface GameState {
    tick?: number;
    players?: PlayerObject[];
    enemies?: EnemyObject[];
    bullets?: BulletObject[];
    score?: number;
    scrollMovement?: number;
    spawnEnemyCounter?: number;
    gameStarted?: boolean;
}

export class StateSerializer {
    // Serialize full game state for transmission
    static serialize(gameState: GameState): SerializedGameState {
        return {
            timestamp: Date.now(),
            tick: gameState.tick || 0,
            players: this.serializePlayers(gameState.players),
            enemies: this.serializeEnemies(gameState.enemies),
            bullets: this.serializeBullets(gameState.bullets),
            gameState: {
                score: gameState.score || 0,
                scrollMovement: gameState.scrollMovement || 0,
                spawnEnemyCounter: gameState.spawnEnemyCounter || 0,
                gameStarted: gameState.gameStarted || false
            }
        };
    }

    // Deserialize received state
    static deserialize(data: any): SerializedGameState | null {
        if (!data || typeof data !== 'object') {
            console.error('Invalid state data received');
            return null;
        }

        return {
            timestamp: data.timestamp,
            tick: data.tick,
            players: data.players || [],
            enemies: data.enemies || [],
            bullets: data.bullets || [],
            gameState: data.gameState || {}
        };
    }

    // Serialize player data
    static serializePlayers(players?: PlayerObject[]): PlayerState[] {
        if (!players || !Array.isArray(players)) return [];

        return players.map(player => ({
            id: player.id || player.playerId || '',
            x: Math.round(player.x * 10) / 10,  // Round to 1 decimal for bandwidth
            y: Math.round(player.y * 10) / 10,
            velocityX: Math.round(player.body?.velocity?.x || 0),
            velocityY: Math.round(player.body?.velocity?.y || 0),
            health: player.health || 0,
            frame: player.frame?.name || 0,
            rotation: player.rotation || 0
        }));
    }

    // Serialize enemy data
    static serializeEnemies(enemies?: EnemyObject[]): EnemyState[] {
        if (!enemies || !Array.isArray(enemies)) return [];

        return enemies.map(enemy => ({
            id: enemy.enemyId || enemy.id || '',
            x: Math.round(enemy.x * 10) / 10,
            y: Math.round(enemy.y * 10) / 10,
            health: enemy.health || 0,
            pathProgress: enemy.pathProgress || 0,
            shipId: enemy.shipId,
            pathId: enemy.pathId,
            power: enemy.power
        }));
    }

    // Serialize bullet data
    static serializeBullets(bullets?: BulletObject[]): BulletState[] {
        if (!bullets || !Array.isArray(bullets)) return [];

        return bullets.map(bullet => ({
            id: bullet.bulletId || bullet.id || '',
            x: Math.round(bullet.x * 10) / 10,
            y: Math.round(bullet.y * 10) / 10,
            velocityX: Math.round(bullet.body?.velocity?.x || 0),
            velocityY: Math.round(bullet.body?.velocity?.y || 0),
            ownerId: bullet.ownerId,
            type: bullet.type || 'player',
            power: bullet.power || 1
        }));
    }

    // Serialize input state
    static serializeInput(playerId: string, inputs: InputState): SerializedInput {
        return {
            playerId,
            timestamp: Date.now(),
            inputs: inputs
        };
    }
}
