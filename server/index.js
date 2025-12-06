// Advanced PlaySocketJS Server with Room Lifecycle, Host Selection,
// Delta Sync Support, Heartbeats, and Automatic Cleanup

import PlaySocketServer from 'playsocketjs/server';

const server = new PlaySocketServer({ 
    port: 3001,
    rateLimit: 2000  // Increased from default 20 to handle game state updates
});

console.log("🚀 PlaySocketJS Server Booted on port 3001");

// Room metadata we track server-side
const roomData = new Map();
// roomId → { hostId, lastTick, lastHeartbeat: Map<clientId, timestamp> }

//----------------------------------------------------------
// Utility
//----------------------------------------------------------
function now() {
    return Date.now();
}

//----------------------------------------------------------
// Event: Client Registered
//----------------------------------------------------------
server.onEvent('clientRegistered', (clientId, custom) => {
    console.log(`Registered client: ${clientId}`);
});

//----------------------------------------------------------
// Event: Room Created
//----------------------------------------------------------
server.onEvent('roomCreated', (roomId) => {
    console.log(`Room created: ${roomId}`);

    roomData.set(roomId, {
        hostId: null,
        lastTick: 0,
        heartbeats: new Map(),
    });
});

//----------------------------------------------------------
// Event: Client Joined Room
//----------------------------------------------------------
server.onEvent('clientJoinedRoom', (clientId, roomId) => {
    console.log(`Client ${clientId} joined room ${roomId}`);

    const data = roomData.get(roomId);
    if (!data) return;

    // If no host yet, first client becomes host
    if (!data.hostId) {
        data.hostId = clientId;
        console.log(`${clientId} is now the HOST of ${roomId}`);
    }

    // Track heartbeat
    data.heartbeats.set(clientId, now());
});

//----------------------------------------------------------
// Event: Client Disconnected
//----------------------------------------------------------
server.onEvent('clientDisconnected', (clientId, roomId) => {
    console.log(`❌ Client disconnected: ${clientId}`);

    if (!roomId) return;
    const data = roomData.get(roomId);
    if (!data) return;

    data.heartbeats.delete(clientId);

    // If host left → elect a new one
    if (clientId === data.hostId) {
        const next = [...data.heartbeats.keys()][0] || null;
        data.hostId = next;
        console.log(`Host left. New host in ${roomId}: ${next}`);

        if (!next) console.log(`⚠️ Room ${roomId} now has no host.`);
    }
});

//----------------------------------------------------------
// Event: Client → Server Custom Requests (Heartbeat, State, Snapshots)
//----------------------------------------------------------
server.onEvent('requestReceived', ({ clientId, roomId, requestName, data }) => {
    const roomData_entry = roomData.get(roomId);
    if (!roomData_entry) return;

    // Handle heartbeat requests
    if (requestName === 'heartbeat') {
        roomData_entry.heartbeats.set(clientId, Date.now());
        return;
    }

    // Handle delta state updates from host
    if (requestName === 'state') {
        const delta = data;
        if (!delta || clientId !== roomData_entry.hostId) {
            console.log(`⛔ Ignored state update from non-host ${clientId}`);
            return;
        }

        roomData_entry.lastTick = delta.tick;

        // Re-broadcast to other clients (via sendRequest which is unreliable like volatile)
        // Note: PlaySocket doesn't have emitToRoomVolatile, so we use storage or broadcast via sendRequest
        console.log(`📡 Host ${clientId} sent state update for tick ${delta.tick}`);
        return;
    }

    // Handle snapshot requests
    if (requestName === 'requestSnapshot') {
        const storage = server.getRoomStorage(roomId);
        if (!storage) return;

        console.log(`📸 Snapshot requested by ${clientId} in room ${roomId}`);
        return;
    }
});

//----------------------------------------------------------
// Event: Client → Server Heartbeat (Volatile)
//----------------------------------------------------------

//----------------------------------------------------------
// Server-side periodic cleanup (dead clients)
//----------------------------------------------------------
setInterval(() => {
    const cutoff = now() - 30000; // 30 seconds without heartbeat → dead

    for (const [roomId, data] of roomData) {
        for (const [clientId, last] of data.heartbeats) {
            if (last < cutoff) {
                console.log(`💀 Removing dead client ${clientId} from room ${roomId}`);
                data.heartbeats.delete(clientId);

                if (clientId === data.hostId) {
                    const next = [...data.heartbeats.keys()][0] || null;
                    data.hostId = next;
                    console.log(`👑 Host replaced: ${next}`);
                }
            }
        }
    }
}, 4000);

//----------------------------------------------------------
// Log storage updates (debug)
//----------------------------------------------------------
server.onEvent('storageUpdated', ({ roomId, clientId, update }) => {
    // uncomment for debugging
    // console.log(` Storage updated in ${roomId} by ${clientId}:`, update);
});

server.onEvent('storageUpdateRequested', ({
    roomId,
    clientId,
    update,
    storage
}) => {
    // Allow server-side updates (PlaySocket uses null clientId)
    if (!clientId) return true;

    // update object contains the key and value information
    // For array operations: { key, operation, value, updateValue }
    // For set operations: { key, value }
    if (!update || !update.key) {
        console.warn('Invalid storage update: missing key');
        return false;
    }

    const key = update.key;
    const operation = update.operation;
    const value = update.value;

    /**
     * ✅ ALLOWED: Player list management
     * e.g. players (direct) or players.<playerId>
     */
    if (key === 'players' || key.startsWith('players.')) {
        return true;
    }

    /**
     * ✅ ALLOWED: Character selections and game state metadata
     */
    if (key === 'characterSelections' || key.startsWith('characterSelections.') || 
        key === 'allPlayersReady' || key === 'isGameStarted' || key === 'startGameData' || 
        key === 'gameStarting') {
        return true;
    }

    /**
     * ✅ ALLOWED: Player input updates
     * e.g. inputs.<playerId>
     */
    if (key.startsWith('inputs.')) {
        const inputOwner = key.split('.')[1];

        // Clients may ONLY write their own input
        if (inputOwner !== clientId) {
            console.warn(`❌ ${clientId} tried to write input for ${inputOwner}`);
            return false;
        }

        return true;
    }

    /**
     * ❌ DISALLOWED: Any authoritative game state
     */
    if (
        key.startsWith('game') ||
        key.startsWith('entities') ||
        key.startsWith('enemies') ||
        key.startsWith('projectiles') ||
        key.startsWith('walls')
    ) {
        console.warn(
            `⛔ Blocked unauthorized storage write by ${clientId} to ${key}`
        );
        return false;
    }

    /**
     * ❌ Default deny
     */
    return false;
});
