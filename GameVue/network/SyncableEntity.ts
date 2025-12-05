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

}

/**
 * Interface that syncable entities must implement
 */
export interface SyncableEntity {
    id: string;

    /**
     * Serialize entity state for network transmission
     */
    getNetworkState(versionSince?: number): EntityState | null;

    /**
     * Update entity from received network state
     */
    updateFromNetworkState(state: EntityState): void;
}

/**
 * Type guard to check if an object implements SyncableEntity
 */
export function isSyncableEntity(obj: any): obj is SyncableEntity {
    return obj &&
           typeof obj.id === 'string' &&
           typeof obj.getNetworkState === 'function' &&
           typeof obj.updateFromNetworkState === 'function';
}
