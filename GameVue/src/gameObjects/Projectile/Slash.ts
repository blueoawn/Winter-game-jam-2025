import Phaser from 'phaser';
import type { GameScene } from '../../scenes/GameScene';
import { Depth } from '../../constants';
import { EntityState } from '../../../network/SyncableEntity';
import { Team } from '../../types/Team';

/**
 * Slash - A syncable melee slash ability that can be used by multiple characters
 * Used by SwordAndBoard (heavy slash) and BigSword (wide slash)
 */
export class Slash extends Phaser.GameObjects.Graphics {
    public id: string;
    public gameScene: GameScene;
    public createdTime: number = Date.now();
    public maxLifetime: number;
    public lastSyncedState: EntityState | null = null;

    // Slash properties
    public damage: number = 2;
    public width: number = 60;
    public height: number = 15;
    public offset: number = 50; // Distance from player
    public arcAngle: number = Math.PI * 0.8; // Slash arc angle
    public color: number = 0xffffff;
    public alpha: number = 0.9;

    // PvP ownership tracking
    public ownerPlayerId: string = '';
    public ownerTeam: Team = Team.Neutral;

    // Animation state
    public startTime: number;
    public duration: number;
    public baseAngle: number; // Starting angle
    public currentAngle: number; // Current angle during animation
    public isAnimating: boolean = true;

    // Owner position (for following owner during slash)
    public ownerX: number;
    public ownerY: number;

    // Tracking hit entities to prevent multiple hits
    public hitEntities: Set<any> = new Set();

    constructor(
        scene: GameScene,
        ownerX: number,
        ownerY: number,
        baseAngle: number,
        damage: number = 2,
        width: number = 60,
        height: number = 15,
        offset: number = 50,
        arcAngle: number = Math.PI * 0.8,
        duration: number = 250,
        ownerPlayerId: string = '',
        ownerTeam: Team = Team.Neutral
    ) {
        super(scene);

        this.gameScene = scene;
        this.id = `slash_${Date.now()}_${Math.floor(Math.random() * 100000)}`;

        this.ownerX = ownerX;
        this.ownerY = ownerY;
        this.baseAngle = baseAngle;
        this.damage = damage;
        this.width = width;
        this.height = height;
        this.offset = offset;
        this.arcAngle = arcAngle;
        this.duration = duration;
        this.maxLifetime = duration;
        this.ownerPlayerId = ownerPlayerId;
        this.ownerTeam = ownerTeam;

        this.startTime = scene.time.now;
        this.currentAngle = baseAngle - arcAngle / 2;

        scene.add.existing(this);
        this.setDepth(Depth.ABILITIES);

        // Draw the initial slash
        this.drawSlash();
    }

    /**
     * Update the slash animation
     */
    update(time: number): void {
        if (!this.isAnimating) return;

        const elapsed = time - this.startTime;
        const progress = Math.min(elapsed / this.duration, 1);

        // Update current angle based on progress
        const startAngle = this.baseAngle - this.arcAngle / 2;
        this.currentAngle = startAngle + this.arcAngle * progress;

        // Redraw slash at new angle
        this.drawSlash();

        // Check for hits at current position
        this.dealDamage();

        // End animation when complete
        if (progress >= 1) {
            this.endSlash();
        }
    }

    drawSlash(): void {
        this.clear();

        // Calculate slash position at current angle
        const slashX = this.ownerX + Math.cos(this.currentAngle) * this.offset;
        const slashY = this.ownerY + Math.sin(this.currentAngle) * this.offset;

        // Draw slash rectangle
        this.fillStyle(this.color, this.alpha);
        this.save();
        this.translateCanvas(slashX, slashY);
        this.rotateCanvas(this.currentAngle);
        this.fillRect(-this.width / 2, -this.height / 2, this.width, this.height);
        this.restore();

        // Draw trail arc
        const startAngle = this.baseAngle - this.arcAngle / 2;
        this.lineStyle(3, this.color, 0.4);
        this.beginPath();
        this.arc(this.ownerX, this.ownerY, this.offset, startAngle, this.currentAngle);
        this.strokePath();
    }

    /**
     * Update owner position (for moving characters)
     */
    updateOwnerPosition(x: number, y: number): void {
        this.ownerX = x;
        this.ownerY = y;
    }

    /**
     * Check if a point is hit by the slash
     */
    isHit(targetX: number, targetY: number, targetRadius: number = 20): boolean {
        // Calculate slash center position
        const slashX = this.ownerX + Math.cos(this.currentAngle) * this.offset;
        const slashY = this.ownerY + Math.sin(this.currentAngle) * this.offset;

        // Calculate target position relative to slash center
        const dx = targetX - slashX;
        const dy = targetY - slashY;

        // Rotate to slash's local coordinate system
        const cos = Math.cos(-this.currentAngle);
        const sin = Math.sin(-this.currentAngle);
        const localX = dx * cos - dy * sin;
        const localY = dx * sin + dy * cos;

        // Check if within slash rectangle bounds (with target radius padding)
        return Math.abs(localX) < this.width / 2 + targetRadius &&
               Math.abs(localY) < this.height / 2 + targetRadius;
    }

    /**
     * Deal damage to all entities in slash path
     */
    dealDamage(): void {
        // Check enemies
        const enemies = this.gameScene.enemyGroup.getChildren();
        for (const enemy of enemies) {
            const e = enemy as Phaser.Physics.Arcade.Sprite;
            if (!e.active || this.hitEntities.has(e)) continue;

            if (this.isHit(e.x, e.y)) {
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

            if (this.isHit(w.x, w.y)) {
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

                if (this.isHit(player.x, player.y)) {
                    if (player.hit) {
                        player.hit(this.damage, this.ownerPlayerId, this.ownerTeam);
                        this.hitEntities.add(player);
                        console.log(`[PVP] ${this.ownerPlayerId} slashed ${player.playerId} for ${this.damage} damage`);
                    }
                }
            }
        }
    }

    endSlash(): void {
        this.isAnimating = false;
        this.hitEntities.clear();
        this.destroy();
    }

    /**
     * Get network state for synchronization
     */
    getNetworkState(): EntityState | null {
        const state: EntityState = {
            id: this.id,
            type: 'Slash',
            x: Math.round(this.ownerX),
            y: Math.round(this.ownerY),
            velocityX: 0,
            velocityY: 0,
            rotation: this.currentAngle,
            damage: this.damage,
            ownerPlayerId: this.ownerPlayerId,
            ownerTeam: this.ownerTeam,
            netVersion: 0,
            isDead: !this.isAnimating,
            // Slash-specific fields
            width: this.width,
            height: this.height,
            offset: this.offset,
            arcAngle: this.arcAngle,
            baseAngle: this.baseAngle,
            duration: this.duration,
            startTime: this.startTime
        } as any;

        return state;
    }

    /**
     * Update from network state
     */
    updateFromNetworkState(state: EntityState): void {
        const slashState = state as any;

        if (slashState.x !== undefined && slashState.y !== undefined) {
            this.ownerX = slashState.x;
            this.ownerY = slashState.y;
        }

        if (slashState.rotation !== undefined) {
            this.currentAngle = slashState.rotation;
        }

        if (slashState.damage !== undefined) {
            this.damage = slashState.damage;
        }

        if (slashState.width !== undefined) {
            this.width = slashState.width;
        }

        if (slashState.height !== undefined) {
            this.height = slashState.height;
        }

        if (slashState.offset !== undefined) {
            this.offset = slashState.offset;
        }

        if (slashState.arcAngle !== undefined) {
            this.arcAngle = slashState.arcAngle;
        }

        if (slashState.baseAngle !== undefined) {
            this.baseAngle = slashState.baseAngle;
        }

        if (slashState.duration !== undefined) {
            this.duration = slashState.duration;
        }

        if (slashState.startTime !== undefined) {
            this.startTime = slashState.startTime;
        }

        // PvP ownership sync
        if (slashState.ownerPlayerId !== undefined) {
            this.ownerPlayerId = slashState.ownerPlayerId;
        }
        if (slashState.ownerTeam !== undefined) {
            this.ownerTeam = slashState.ownerTeam;
        }

        if (slashState.isDead) {
            this.endSlash();
        } else {
            // Redraw with updated state
            this.drawSlash();
        }

        // Refresh lastSyncedState snapshot
        this.lastSyncedState = { ...state };
    }

    /**
     * Remove this slash from the scene
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

export default Slash;
