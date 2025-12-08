import Phaser from 'phaser';
import type { GameScene } from '../../scenes/GameScene';
import { Depth } from '../../constants';
import { EntityState } from '../../../network/SyncableEntity';
import { Team } from '../../types/Team';

/**
 * Beam - A syncable beam ability that can be used by multiple characters
 * Used by CheeseTouch (cheese beam) and Railgun (piercing beam)
 */
export class Beam extends Phaser.GameObjects.Graphics {
    public id: string;
    public gameScene: GameScene;
    public createdTime: number = Date.now();
    public maxLifetime: number = 2000; // default 2s, can be overridden
    public lastSyncedState: EntityState | null = null;

    // Beam properties
    public damage: number = 1;
    public width: number = 6;
    public range: number = 300;
    public color: number = 0xffcc00; // Default yellow/orange
    public alpha: number = 0.8;

    // PvP ownership tracking
    public ownerPlayerId: string = '';
    public ownerTeam: Team = Team.Neutral;

    // Beam geometry
    public startX: number;
    public startY: number;
    public endX: number;
    public endY: number;
    public angle: number;

    // Tracking hit entities to prevent multiple hits
    public hitEntities: Set<any> = new Set();

    constructor(
        scene: GameScene,
        startX: number,
        startY: number,
        angle: number,
        range: number,
        damage: number = 1,
        width: number = 6,
        color: number = 0xffcc00,
        ownerPlayerId: string = '',
        ownerTeam: Team = Team.Neutral
    ) {
        super(scene);

        this.gameScene = scene;
        this.id = `beam_${Date.now()}_${Math.floor(Math.random() * 100000)}`;

        this.startX = startX;
        this.startY = startY;
        this.angle = angle;
        this.range = range;
        this.damage = damage;
        this.width = width;
        this.color = color;
        this.ownerPlayerId = ownerPlayerId;
        this.ownerTeam = ownerTeam;

        // Calculate end position
        this.endX = startX + Math.cos(angle) * range;
        this.endY = startY + Math.sin(angle) * range;

        scene.add.existing(this);
        this.setDepth(Depth.ABILITIES);

        // Draw the initial beam
        this.drawBeam();
    }

    drawBeam(): void {
        this.clear();
        this.lineStyle(this.width, this.color, this.alpha);
        this.beginPath();
        this.moveTo(this.startX, this.startY);
        this.lineTo(this.endX, this.endY);
        this.strokePath();
    }

    /**
     * Update beam position (for moving beams like CheeseTouch)
     */
    updateBeam(startX: number, startY: number, angle: number): void {
        this.startX = startX;
        this.startY = startY;
        this.angle = angle;
        this.endX = startX + Math.cos(angle) * this.range;
        this.endY = startY + Math.sin(angle) * this.range;
        this.drawBeam();
    }

    /**
     * Check if a point is within the beam path
     */
    isInBeamPath(targetX: number, targetY: number, targetRadius: number = 16): boolean {
        // Vector from start to end
        const dx = this.endX - this.startX;
        const dy = this.endY - this.startY;
        const beamLenSq = dx * dx + dy * dy;

        if (beamLenSq === 0) return false;

        // Vector from start to target
        const tx = targetX - this.startX;
        const ty = targetY - this.startY;

        // Project target vector onto beam vector (dot product)
        // t is the normalized distance along the line (0 to 1)
        const t = Math.max(0, Math.min(1, (tx * dx + ty * dy) / beamLenSq));

        // Closest point on line to target
        const closestX = this.startX + t * dx;
        const closestY = this.startY + t * dy;

        // Distance from closest point to target center
        const distSq = (targetX - closestX) ** 2 + (targetY - closestY) ** 2;

        // Check if distance is within beam width + target radius
        const hitRadius = (this.width / 2) + targetRadius;
        return distSq < (hitRadius * hitRadius);
    }

    /**
     * Deal damage to all entities in beam path
     */
    dealDamage(): void {
        // Check enemies
        const enemies = this.gameScene.enemyGroup.getChildren();
        for (const enemy of enemies) {
            const e = enemy as Phaser.Physics.Arcade.Sprite;
            if (!e.active || this.hitEntities.has(e)) continue;

            if (this.isInBeamPath(e.x, e.y)) {
                if ((e as any).hit) {
                    (e as any).hit(this.damage);
                    this.hitEntities.add(e);
                }
            }
        }

        // Check walls
        const walls = this.gameScene.wallGroup.getChildren();
        for (const wall of walls) {
            const w = wall as any;
            if (!w.active || w.isIndestructible || this.hitEntities.has(w)) continue;

            if (this.isInBeamPath(w.x, w.y)) {
                if (w.hit) {
                    w.hit(this.damage);
                    this.hitEntities.add(w);
                }
            }
        }

        // Check other players in multiplayer (PvP)
        const playerManager = (this.gameScene as any).playerManager;
        if (playerManager) {
            const players = playerManager.getAllPlayers();
            for (const player of players) {
                // Skip owner to prevent self-damage
                if (player.playerId === this.ownerPlayerId) continue;
                if (!player.active || this.hitEntities.has(player)) continue;
                // Skip respawning players
                if (player.isRespawning) continue;

                if (this.isInBeamPath(player.x, player.y)) {
                    if (player.hit) {
                        player.hit(this.damage, this.ownerPlayerId, this.ownerTeam);
                        this.hitEntities.add(player);
                        console.log(`[PVP] ${this.ownerPlayerId} beam hit ${player.playerId} for ${this.damage} damage`);
                    }
                }
            }
        }
    }

    /**
     * Get network state for synchronization
     */
    getNetworkState(): EntityState | null {
        const state: EntityState = {
            id: this.id,
            type: 'Beam',
            x: Math.round(this.startX),
            y: Math.round(this.startY),
            velocityX: 0,
            velocityY: 0,
            rotation: this.angle,
            damage: this.damage,
            ownerPlayerId: this.ownerPlayerId,
            ownerTeam: this.ownerTeam,
            netVersion: 0,
            isDead: false,
            // Beam-specific fields
            width: this.width,
            range: this.range,
            color: this.color,
            endX: Math.round(this.endX),
            endY: Math.round(this.endY)
        } as any;

        return state;
    }

    /**
     * Update from network state
     */
    updateFromNetworkState(state: EntityState): void {
        const beamState = state as any;

        if (beamState.x !== undefined && beamState.y !== undefined) {
            this.startX = beamState.x;
            this.startY = beamState.y;
        }

        if (beamState.rotation !== undefined) {
            this.angle = beamState.rotation;
        }

        if (beamState.damage !== undefined) {
            this.damage = beamState.damage;
        }

        if (beamState.width !== undefined) {
            this.width = beamState.width;
        }

        if (beamState.range !== undefined) {
            this.range = beamState.range;
        }

        if (beamState.color !== undefined) {
            this.color = beamState.color;
        }

        if (beamState.endX !== undefined && beamState.endY !== undefined) {
            this.endX = beamState.endX;
            this.endY = beamState.endY;
        }

        // PvP ownership sync
        if (beamState.ownerPlayerId !== undefined) {
            this.ownerPlayerId = beamState.ownerPlayerId;
        }
        if (beamState.ownerTeam !== undefined) {
            this.ownerTeam = beamState.ownerTeam;
        }

        // Redraw with updated state
        this.drawBeam();

        // Refresh lastSyncedState snapshot
        this.lastSyncedState = { ...state };
    }

    /**
     * Remove this beam from the scene
     */
    remove(): void {
        this.destroy();
    }

    getDamage(): number {
        return this.damage;
    }

    getPower(): number {
        return this.damage;
    }
}

export default Beam;
