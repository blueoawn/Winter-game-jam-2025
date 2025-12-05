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
    enemyType: string;
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
    enemyBullets: BulletState[];  // Enemy bullets tracked separately
    gameState: GameStateData;
}

export interface InputState {
    movementSpeed: number;
    velocity: Vector2;
    rotation: number;
    aim?: Vector2;      // Aim position in world coordinates
    ability1: boolean;  // Primary ability
    ability2: boolean;  // Secondary ability
    fire?: boolean;     // Deprecated
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
    enemyType: string;
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
    enemyBullets?: BulletObject[];  // Enemy bullets tracked separately
    score?: number;
    scrollMovement?: number;
    spawnEnemyCounter?: number;
    gameStarted?: boolean;
}

export class StateSerializer {
    // Serialize full game state for transmission
    static serialize(gameState: GameState, timestamp?: number): SerializedGameState {
        return {
            timestamp: timestamp || Date.now(),  // Reuse timestamp if provided
            tick: gameState.tick || 0,
            players: this.serializePlayers(gameState.players),
            enemies: this.serializeEnemies(gameState.enemies),
            bullets: this.serializeBullets(gameState.bullets),
            enemyBullets: this.serializeBullets(gameState.enemyBullets),  // Serialize enemy bullets
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
            enemyBullets: data.enemyBullets || [],  // Deserialize enemy bullets
            gameState: data.gameState || {}
        };
    }

    // Serialize player data (Phase 3 optimization: integer positions for packet size reduction)
    static serializePlayers(players?: PlayerObject[]): PlayerState[] {
        if (!players || !Array.isArray(players)) return [];

        const result: PlayerState[] = [];
        for (let i = 0; i < players.length; i++) {
            const p = players[i];
            result.push({
                id: p.id || p.playerId || '',  // Keep fallback for ID (critical field)
                x: Math.round(p.x),  // Integer positions 
                y: Math.round(p.y),
                velocityX: p.body && p.body.velocity && p.body.velocity.x !== undefined ? Math.round(p.body.velocity.x) : 0,
                velocityY: p.body && p.body.velocity && p.body.velocity.y !== undefined ? Math.round(p.body.velocity.y) : 0,
                health: p.health,
                frame: p.frame && p.frame.name !== undefined ? p.frame.name : 0,
                rotation: Math.round(p.rotation * 100) / 100  // 2 decimals for rotation
            });
        }
        return result;
    }

    // Serialize enemy data (Phase 3 optimization: integer positions, remove pathProgress)
    static serializeEnemies(enemies?: EnemyObject[]): EnemyState[] {
        if (!enemies || !Array.isArray(enemies)) return [];

        const result: EnemyState[] = [];
        for (let i = 0; i < enemies.length; i++) {
            const e = enemies[i];
            result.push({
                id: e.enemyId || e.id || '',  // Keep fallback for ID
                x: Math.round(e.x),  // Integer positions
                y: Math.round(e.y),
                health: e.health,
                pathProgress: 0,  // Not needed for network-synced enemies (position overridden)
                enemyType: e.enemyType || 'EnemyFlying',  // Include enemy type for correct client-side creation
                shipId: e.shipId,
                pathId: e.pathId,
                power: e.power
            });
        }
        return result;
    }

    // Serialize bullet data (Phase 3 optimization: integer positions, minimal fields)
    static serializeBullets(bullets?: BulletObject[]): BulletState[] {
        if (!bullets || !Array.isArray(bullets)) return [];

        const result: BulletState[] = [];
        for (let i = 0; i < bullets.length; i++) {
            const b = bullets[i];
            result.push({
                id: b.bulletId || b.id || '',  // Keep fallback for ID
                x: Math.round(b.x),  // Integer positions
                y: Math.round(b.y),
                velocityX: b.body && b.body.velocity && b.body.velocity.x !== undefined ? Math.round(b.body.velocity.x) : 0,
                velocityY: b.body && b.body.velocity && b.body.velocity.y !== undefined ? Math.round(b.body.velocity.y) : 0,
                ownerId: b.ownerId || '',  // Can be empty for enemy bullets
                type: b.type || 'player',
                power: b.power || 1
            });
        }
        return result;
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
