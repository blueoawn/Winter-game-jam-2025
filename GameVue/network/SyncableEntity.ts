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
 * Abstract class that syncable entities must extend.
 * Implements common logic (diffing, applying deltas, reconciliation).
 */
export abstract class SyncableEntity {
  public id: string;
  public state: EntityState;
  
  // We keep the previous tick's state to calculate diffs
  protected lastSyncedState: EntityState;

  // The Visual Representation (Composition)
  // Use any|null to avoid strict Phaser dependency on the server
  public view: any | null = null;

  constructor(initialState: EntityState) {
    this.id = initialState.id;
    this.state = { ...initialState };
    this.lastSyncedState = { ...initialState };
  }

  /**
   * SNAPSHOT DIFFING STRATEGY
   * Compares current state vs last sent state.
   * Returns null if nothing changed.
   */
  public getDelta(): EntityDelta | null {
    const delta: EntityDelta = { id: this.id };
    let hasChanges = false;

    // Iterate over keys to find differences
    // Note: purely shallow comparison for speed
    (Object.keys(this.state) as Array<keyof EntityState>).forEach((key) => {
      if (this.state[key] !== this.lastSyncedState[key]) {
        // assign via any to satisfy index typing
        (delta as any)[key] = this.state[key];
        hasChanges = true;
      }
    });

    if (hasChanges) {
      // Update our baseline for the next tick
      this.lastSyncedState = { ...this.state };
      return delta;
    }

    return null;
  }

  /**
   * Applies an update from the server (for Remote Entities)
   */
  public applyDelta(delta: EntityDelta): void {
    // 1. Merge data
    this.state = { ...this.state, ...delta };

    // 2. Handle removal immediately if flagged
    if (this.state.isDead) {
      this.destroy();
      return;
    }

    // 3. Update the visual representation
    if (this.view) {
      this.syncView();
    }
  }

  /**
   * RECONCILIATION HELPER
   * For the local player: You moved, but server says you are elsewhere.
   * @param serverState The authoritative state from server
   */
  public reconcile(serverState: EntityState): void {
    // If the distance is too great, snap to server (Lag correction)
    const dist = Math.hypot(this.state.x - serverState.x, this.state.y - serverState.y);
    const TOLERANCE = 10.0; // pixels

    if (dist > TOLERANCE) {
      console.warn(`Reconciling: Client off by ${dist.toFixed(2)}px`);
      
      // Hard snap (or you could smooth lerp here)
      this.state.x = serverState.x;
      this.state.y = serverState.y;
      
      // Important: Re-apply any inputs that happened AFTER the snapshot timestamp
      // (This requires an input buffer system, omitted for brevity)
    }
    
    // Always sync health/dead status regardless of prediction
    this.state.health = serverState.health;
    this.state.isDead = serverState.isDead;
  }

  /**
   * ABSTRACT METHODS
   * Child classes must implement how they look and how they are destroyed.
   */
  
  // Call this when the entity enters the scene
  // Use 'any' for scene to avoid requiring Phaser types in non-client builds
  public abstract createView(scene: any): void;

  // Call this every game tick to align Sprite with State
  public abstract syncView(): void;

  // Cleanup sprites and events
  public destroy(): void {
    if (this.view && typeof this.view.destroy === 'function') {
      this.view.destroy();
    }
    this.view = null;
  }
}
