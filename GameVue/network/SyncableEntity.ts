/**
 * SyncableEntity - Interface for network-synchronized game entities
 *
 * Any entity that needs to be synchronized across multiplayer clients
 * should implement this interface. The Server is the source of truth.
 */

/**
 * Base state interface that all entities must provide for network sync
 */
export interface EntityState {
    id: string;           // Unique identifier for this entity
    type: string;         // Entity type (e.g. 'Player', 'Enemy', 'Projectile', 'Wall')
    x: number;            // Position X
    y: number;            // Position Y
    [key: string]: any;   // Additional type-specific properties
    netVersion: number;  // Increment when changed
    isDead: boolean; // Triggers removal
}

/**
 * Delta sent over the network: partial state with required id
 */
export type EntityDelta = Partial<EntityState> & { id: string };

/**
 * Interface that syncable entities should implement.
 * Many existing game objects use `implements SyncableEntity` rather than
 * extending a base class, so provide an interface for compatibility.
 */
export interface SyncableEntity {
  id: string;
  // Optional last known network snapshot for diffing
  lastSyncedState?: EntityState | null;
  // Visual representation (Phaser Sprite, Container, etc.)
  view?: any | null;

  // Methods expected across game objects
  getNetworkState?(): EntityState | null;
  updateFromNetworkState?(state: EntityState): void;
  createView?(scene: any): void;
  syncView?(): void;

  // Optional helpers for more advanced networking
  getDelta?(): EntityDelta | null;
  applyDelta?(delta: EntityDelta): void;
  reconcile?(serverState: EntityState): void;
}

/**
 * Optional base class providing a default implementation of common
 * network helpers. Game objects may extend this class if they want
 * to reuse snapshot diffing and reconciliation logic, but most
 * existing code in the repo implements the interface directly.
 */
export abstract class SyncableEntityBase implements SyncableEntity {
  public id: string = '';
  public view: any | null = null;
  protected state?: EntityState;
  public lastSyncedState: EntityState | null = null;

  constructor(initialState?: EntityState) {
    if (initialState) {
      this.id = initialState.id;
      this.state = { ...initialState };
      this.lastSyncedState = { ...initialState };
    }
  }

  public getNetworkState(): EntityState | null {
    return this.state ? { ...this.state } : null;
  }

  public getDelta(): EntityDelta | null {
    if (!this.state) return null;
    if (!this.lastSyncedState) {
      this.lastSyncedState = { ...this.state };
      return { ...(this.state as EntityState) } as EntityDelta;
    }

    const delta: EntityDelta = { id: this.id };
    let hasChanges = false;

    (Object.keys(this.state) as Array<keyof EntityState>).forEach((key) => {
      if (this.state![key] !== this.lastSyncedState![key]) {
        (delta as any)[key] = this.state![key];
        hasChanges = true;
      }
    });

    if (hasChanges) {
      this.lastSyncedState = { ...(this.state as EntityState) };
      return delta;
    }
    return null;
  }

  public applyDelta(delta: EntityDelta): void {
    if (!this.state) this.state = {} as EntityState;
    this.state = { ...this.state, ...delta };
    if (this.state.isDead) {
      this.destroy();
      return;
    }
    if (this.view) this.syncView();
  }

  public reconcile(serverState: EntityState): void {
    if (!this.state) this.state = {} as EntityState;
    const dist = Math.hypot((this.state.x || 0) - (serverState.x || 0), (this.state.y || 0) - (serverState.y || 0));
    const TOLERANCE = 10.0;
    if (dist > TOLERANCE) {
      this.state.x = serverState.x;
      this.state.y = serverState.y;
    }
    this.state.health = serverState.health;
    this.state.isDead = serverState.isDead;
  }

  public abstract createView(scene: any): void;
  public abstract syncView(): void;

  public destroy(): void {
    if (this.view && typeof this.view.destroy === 'function') {
      this.view.destroy();
    }
    this.view = null;
  }
}
