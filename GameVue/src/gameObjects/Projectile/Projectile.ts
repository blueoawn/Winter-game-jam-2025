import Phaser from 'phaser';
import type { GameScene } from '../../scenes/Game';
import { Depth } from '../../constants';
import { EntityState, EntityDelta, SyncableEntity } from '../../../network/SyncableEntity';

/**
 * Base Projectile class with common network-sync helpers.
 *
 * Child projectiles can extend this class and call/override
 * `getNetworkState()` and `updateFromNetworkState()` to include
 * type-specific fields.
 */
export abstract class Projectile extends Phaser.Physics.Arcade.Sprite implements SyncableEntity {
  public id: string;
  public gameScene: GameScene;
  public createdTime: number = Date.now();
  public maxLifetime: number = 2000; // default 2s, children can override
  public view: any = null;
  public lastSyncedState: EntityState | null = null;

  // Optional damage/power fields - many projectiles will set these
  public damage: number = 1;

  constructor(scene: GameScene, x: number, y: number, texture: string, frame?: string | number) {
    super(scene, x, y, texture as string, frame as any);

    this.gameScene = scene;
    this.id = `${this.constructor.name.toLowerCase()}_${Date.now()}_${Math.floor(Math.random() * 100000)}`;

    scene.add.existing(this);
    scene.physics.add.existing(this);

    this.setDepth(Depth.BULLETS);

    // Default cleanup on destroy
    this.on('destroy', () => {
      if (this.view && typeof this.view.destroy === 'function') {
        this.view.destroy();
      }
      this.view = null;
    });
  }

  preUpdate(time: number, delta: number): void {
    super.preUpdate(time, delta);

    // Auto-destroy after lifetime
    if (this.maxLifetime > 0 && Date.now() - this.createdTime > this.maxLifetime) {
      this.destroy();
      return;
    }

    // Check world bounds
    const bounds = this.gameScene.physics.world.bounds;
    if (this.x < bounds.x || this.x > bounds.x + bounds.width ||
        this.y < bounds.y || this.y > bounds.y + bounds.height) {
      this.destroy();
      return;
    }
  }

  /**
   * Default network state contains common fields. Child classes should
   * override and merge type-specific properties when required.
   */
  public getNetworkState(): EntityState | null {
    if (!this.active) return null;

    const vx = this.body ? Math.round((this.body as any).velocity.x || 0) : 0;
    const vy = this.body ? Math.round((this.body as any).velocity.y || 0) : 0;

    const state: EntityState = {
      id: this.id,
      type: this.constructor.name,
      x: Math.round(this.x),
      y: Math.round(this.y),
      velocityX: vx,
      velocityY: vy,
      rotation: this.rotation,
      damage: this.damage,
      netVersion: 0,
      isDead: false
    } as unknown as EntityState;

    return state;
  }

  /**
   * Apply authoritative network state to this projectile. Children
   * should call super.updateFromNetworkState(state) and then apply
   * additional fields.
   */
  public updateFromNetworkState(state: EntityState): void {
    if (state.x !== undefined) this.setPosition(state.x, state.y);

    if (state.velocityX !== undefined && state.velocityY !== undefined && this.body) {
      (this.body as any).velocity.x = state.velocityX;
      (this.body as any).velocity.y = state.velocityY;
    }

    if (state.rotation !== undefined) this.rotation = state.rotation;
    if ((state as any).damage !== undefined) this.damage = (state as any).damage;

    // Refresh lastSyncedState snapshot
    this.lastSyncedState = { ...(state as EntityState) };
  }

  // Simple removal helper
  public remove(): void {
    this.destroy();
  }

  // Default power getter
  public getPower(): number {
    return this.damage;
  }

  // Default damage getter (override for complex projectiles)
  public getDamage(): number {
    return this.damage;
  }

  // Methods from SyncableEntity (optional on interface)
  public createView(scene: any): void {
    this.view = this; // by default, the sprite itself is the view
  }

  public syncView(): void {
    if (!this.view) return;
    this.setPosition(this.x, this.y);
    this.rotation = this.rotation; // noop but explicit
  }
}

export default Projectile;
//TODO - extendable project class for network sync