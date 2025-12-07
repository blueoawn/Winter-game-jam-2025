/**
 * AreaBoundary - Static map zones that apply effects to players and enemies
 * 
 * Features:
 * - No network sync needed (map-defined, deterministic)
 * - Collision-based activation
 * - Configurable effects (speed modifiers, velocity push, damage over time)
 * - Visual feedback (optional tint/alpha)
 * 
 * Example use cases:
 * - Mud: Slows movement in all directions
 * - Treadmill/Conveyor: Adds constant velocity in a direction
 * - Wind: Pushes entities in a direction
 * - Hazard: Deals damage over time
 * - Healing zone: Restores health over time
 */

import { GameScene } from '../scenes/GameScene';
import Rectangle = Phaser.GameObjects.Rectangle;

/**
 * Effect types that can be applied by area boundaries
 */
export enum AreaEffectType {
    SpeedModifier = 'speed_modifier',      // Multiply character speed (e.g., 0.5 = 50% slower)
    VelocityPush = 'velocity_push',        // Add constant velocity (e.g., conveyor belt)
    DamageOverTime = 'damage_over_time',   // Deal damage periodically
    HealOverTime = 'heal_over_time',       // Restore health periodically
    Custom = 'custom'                      // Custom callback-based effect
}

/**
 * Configuration for area boundary effects
 */
export interface AreaBoundaryConfig {
    x: number;
    y: number;
    width: number;
    height: number;
    effectType: AreaEffectType;
    
    // Effect-specific parameters
    speedMultiplier?: number;       // For SpeedModifier (default: 1.0)
    pushVelocity?: { x: number; y: number };  // For VelocityPush
    damageRate?: number;            // Damage per tick (for DamageOverTime)
    healRate?: number;              // Healing per tick (for HealOverTime)
    tickInterval?: number;          // Milliseconds between ticks (default: 1000)
    
    // Visual properties
    visible?: boolean;              // Show the boundary rectangle (default: false)
    fillColor?: number;             // Fill color if visible (default: 0x0000ff)
    fillAlpha?: number;             // Fill alpha if visible (default: 0.2)
}

/**
 * AreaBoundary class - Static zone with configurable effects
 */
export class AreaBoundary {
    private scene: GameScene;
    private zone: Rectangle;
    private config: AreaBoundaryConfig;
    private affectedEntities: Set<any> = new Set();
    private lastTickTime: number = 0;

    constructor(scene: GameScene, config: AreaBoundaryConfig) {
        this.scene = scene;
        this.config = {
            tickInterval: 1000,  // Default 1 second between ticks
            visible: false,
            fillColor: 0x0000ff,
            fillAlpha: 0.2,
            ...config
        };

        // Create visual zone
        this.zone = scene.add.rectangle(
            config.x,
            config.y,
            config.width,
            config.height,
            this.config.fillColor,
            this.config.fillAlpha
        );

        this.zone.setOrigin(0.5, 0.5);
        this.zone.setVisible(this.config.visible || false);

        // Add physics body for overlap detection
        scene.physics.add.existing(this.zone, true); // true = static body

        this.lastTickTime = Date.now();
    }

    /**
     * Check if a point or entity is within this boundary
     */
    contains(x: number, y: number): boolean {
        const bounds = this.zone.getBounds();
        return bounds.contains(x, y);
    }

    /**
     * Apply effects to an entity (player or enemy)
     * Called by the game loop when entity overlaps with zone
     */
    applyEffect(entity: any): void {
        if (!entity || !entity.active) return;

        // Track entity for periodic effects
        const isNewEntry = !this.affectedEntities.has(entity);
        if (isNewEntry) {
            this.affectedEntities.add(entity);
            this.onEntityEnter(entity);
        }

        // Apply continuous effects based on type
        switch (this.config.effectType) {
            case AreaEffectType.SpeedModifier:
                // Only apply on entry, not every frame
                if (isNewEntry) {
                    this.applySpeedModifier(entity);
                }
                break;

            case AreaEffectType.VelocityPush:
                // Apply every frame for continuous push
                this.applyVelocityPush(entity);
                break;

            case AreaEffectType.DamageOverTime:
            case AreaEffectType.HealOverTime:
                // Handled by update() with tick interval
                break;
        }
    }

    /**
     * Remove effects from entity when it leaves the zone
     */
    removeEffect(entity: any): void {
        if (this.affectedEntities.has(entity)) {
            this.affectedEntities.delete(entity);
            this.onEntityExit(entity);
        }
    }

    /**
     * Update loop for periodic effects (damage/heal over time)
     * Also checks if entities have left the zone
     */
    update(): void {
        // Check if tracked entities are still in the zone
        this.affectedEntities.forEach(entity => {
            if (!entity || !entity.active || !this.contains(entity.x, entity.y)) {
                this.removeEffect(entity);
            }
        });

        const now = Date.now();
        const timeSinceLastTick = now - this.lastTickTime;

        if (timeSinceLastTick >= (this.config.tickInterval || 1000)) {
            this.lastTickTime = now;
            this.tick();
        }
    }

    /**
     * Periodic tick for damage/heal effects
     */
    private tick(): void {
        this.affectedEntities.forEach(entity => {
            if (!entity || !entity.active) {
                this.affectedEntities.delete(entity);
                return;
            }

            switch (this.config.effectType) {
                case AreaEffectType.DamageOverTime:
                    if (entity.hit && this.config.damageRate) {
                        entity.hit(this.config.damageRate);
                        console.log(`[AREA] ${entity.constructor.name} took ${this.config.damageRate} damage`);
                    }
                    break;

                case AreaEffectType.HealOverTime:
                    if (entity.health !== undefined && entity.maxHealth && this.config.healRate) {
                        entity.health = Math.min(entity.maxHealth, entity.health + this.config.healRate);
                        if (entity.updateHealthBarValue) {
                            entity.updateHealthBarValue();
                        }
                        console.log(`[AREA] ${entity.constructor.name} healed ${this.config.healRate} HP`);
                    }
                    break;
            }
        });
    }

    /**
     * Apply speed modifier effect
     * Similar to how Consumable.applyEffect() calls playerController methods
     */
    private applySpeedModifier(entity: any): void {
        if (!entity.body) return;

        const multiplier = this.config.speedMultiplier || 1.0;
        
        // For PlayerController, call the applyAreaSpeedModifier method (like consumables do)
        if (typeof entity.applyAreaSpeedModifier === 'function') {
            entity.applyAreaSpeedModifier(multiplier);
        } else {
            // For enemies or other entities without the method, directly modify speed
            if (!entity._areaOriginalSpeed) {
                entity._areaOriginalSpeed = entity.characterSpeed || entity.moveSpeed || 100;
            }
            const modifiedSpeed = entity._areaOriginalSpeed * multiplier;
            if (entity.characterSpeed !== undefined) {
                entity.characterSpeed = modifiedSpeed;
            }
            if (entity.moveSpeed !== undefined) {
                entity.moveSpeed = modifiedSpeed;
            }
            console.log(`[AREA] Applied ${multiplier}x speed to ${entity.constructor.name} (${entity._areaOriginalSpeed} -> ${modifiedSpeed})`);
        }
    }

    /**
     * Apply velocity push effect (conveyor belt, wind, etc.)
     */
    private applyVelocityPush(entity: any): void {
        if (!entity.body || !this.config.pushVelocity) return;

        // Add push velocity to current velocity
        entity.body.velocity.x += this.config.pushVelocity.x;
        entity.body.velocity.y += this.config.pushVelocity.y;
    }

    /**
     * Called when entity enters zone
     */
    private onEntityEnter(entity: any): void {
        console.log(`[AREA] ${entity.constructor.name} entered ${this.config.effectType} zone`);
    }

    /**
     * Called when entity exits zone
     * Similar to how Consumable.applyEffect() calls playerController methods
     */
    private onEntityExit(entity: any): void {
        console.log(`[AREA] ${entity.constructor.name} exited ${this.config.effectType} zone`);

        // Restore original speed for SpeedModifier
        if (this.config.effectType === AreaEffectType.SpeedModifier) {
            // For PlayerController, call the removeAreaSpeedModifier method (like consumables do)
            if (typeof entity.removeAreaSpeedModifier === 'function') {
                entity.removeAreaSpeedModifier();
            } else if (entity._areaOriginalSpeed) {
                // For enemies or other entities without the method, restore speed directly
                if (entity.characterSpeed !== undefined) {
                    entity.characterSpeed = entity._areaOriginalSpeed;
                }
                if (entity.moveSpeed !== undefined) {
                    entity.moveSpeed = entity._areaOriginalSpeed;
                }
                delete entity._areaOriginalSpeed;
                console.log(`[AREA] Restored speed for ${entity.constructor.name}`);
            }
        }
    }

    /**
     * Get the physics body for collision setup
     */
    getBody(): Phaser.Physics.Arcade.Body {
        return this.zone.body as Phaser.Physics.Arcade.Body;
    }

    /**
     * Get the zone rectangle
     */
    getZone(): Rectangle {
        return this.zone;
    }

    /**
     * Cleanup
     */
    destroy(): void {
        this.affectedEntities.clear();
        this.zone.destroy();
    }
}