// Advanced PlaySocketJS Server with Room Lifecycle, Host Selection,
// Delta Sync Support, Heartbeats, and Automatic Cleanup

import PlaySocketServer from 'playsocketjs/server';

const MAX_MESSAGE_SIZE = 8 * 1024; // 8 KB max per message
function isObject(o) {
    return o && typeof o === 'object' && !Array.isArray(o);
}

// SECURITY CHANGE: bind ONLY to localhost
const server = new PlaySocketServer({
    port: 3001,
    host: '127.0.0.1',
    // SECURITY CHANGE: reasonable public-facing rate limit
    rateLimit: 300
});

console.log('🚀 PlaySocketJS Server Booted on port 3001');

// Per-room metadata
// roomId -> { hostId: string|null, lastTick: number, heartbeats: Map<clientId, timestamp>, lastInputSeq: Map<clientId, seq> }
const roomData = new Map();

function now() { return Date.now(); }

server.onEvent('clientRegistered', (clientId) => {
    console.log(`✅ Client registered: ${clientId}`);
});

server.onEvent('roomCreated', (roomId) => {
    console.log(`🏠 Room created: ${roomId}`);
    roomData.set(roomId, {
        hostId: null,
        lastTick: 0,
        heartbeats: new Map(),
        lastInputSeq: new Map()
    });
});

server.onEvent('clientJoinedRoom', (clientId, roomId) => {
    console.log(`👋 Client ${clientId} joined room ${roomId}`);
    const meta = roomData.get(roomId);
    if (!meta) return;

    if (!meta.hostId) {
        meta.hostId = clientId;
        console.log(`👑 ${clientId} is now the HOST of ${roomId}`);
    }

    meta.heartbeats.set(clientId, now());
});

server.onEvent('clientDisconnected', (clientId, roomId) => {
    console.log(`❌ Client disconnected: ${clientId}`);
    if (!roomId) return;
    const meta = roomData.get(roomId);
    if (!meta) return;

    meta.heartbeats.delete(clientId);
    meta.lastInputSeq.delete(clientId);

    if (clientId === meta.hostId) {
        const next = [...meta.heartbeats.keys()][0] || null;
        meta.hostId = next;
        console.log(`Host left. New host for ${roomId}: ${next}`);
    }
});

// Handle custom requests from clients (heartbeat, state, snapshot)
// Note: PlaySocketJS uses 'name' not 'requestName' in the event payload
server.onEvent('requestReceived', ({ clientId, roomId, name, data }) => {

    // ✅ SECURITY: basic validation
    if (!clientId || !roomId || typeof name !== 'string') {
        return;
    }

    // ✅ SECURITY: message size guard
    try {
        const size = JSON.stringify(data ?? {}).length;
        if (size > MAX_MESSAGE_SIZE) {
            console.warn(`⛔ Oversized message from ${clientId}`);
            return;
        }
    } catch {
        return;
    }

    if (name !== 'heartbeat') {
        console.log(`📨 ${name} from ${clientId} in ${roomId}`);
    }

    const meta = roomData.get(roomId);
    if (!meta) return;

    // ✅ Heartbeat: lowest-cost path
    if (name === 'heartbeat') {
        meta.heartbeats.set(clientId, now());
        return;
    }

    // ✅ State updates: only accept objects with numeric tick
    if (name === 'state') {
        if (!isObject(data) || typeof data.tick !== 'number') {
            return;
        }

        if (data.tick > meta.lastTick) {
            meta.lastTick = data.tick;
            server.updateRoomStorage(roomId, 'lastStateDelta', 'set', data);
        }

        return;
    }

    // ✅ Snapshot: throttle to host only
    if (name === 'snapshot') {
        if (clientId !== meta.hostId) {
            console.warn(`⛔ Snapshot denied for non-host ${clientId}`);
            return;
        }

        console.log(`📸 Snapshot requested by host ${clientId}`);
        return;
    }
});


// Storage validation: enforce who can write which keys and validate input sequence numbers
server.onEvent('storageUpdateRequested', (params) => {
    // Extract from the nested update structure
    const clientId = params?.clientId;
    const roomId = params?.roomId;
    const key = params?.update?.key;  // Key is nested in update object
    const operation = params?.update?.operation;  // Operation is also nested
    const storage = params?.storage;

    // For value, we need to extract from the operation.data if it exists
    // PlaySocketJS wraps values in { type: "set", value: actualPayload, updateValue: null }
    let value;
    if (operation && typeof operation === 'object' && 'data' in operation) {
        const opData = operation.data;
        // Unwrap the PlaySocketJS operation structure to get the actual payload
        if (opData && opData.type === 'set' && opData.value !== undefined) {
            value = opData.value;
        } else if (opData && opData.type === 'update' && opData.updateValue !== undefined) {
            value = opData.updateValue;
        } else {
            value = opData;
        }
    }

    // Log problematic calls
    if (!key) {
        console.warn('(server) Invalid storage update: missing key');
        console.log(`(server) DEBUG - clientId: ${clientId}, params:`, params);
        return false;
    }

    // Allow server-side writes (clientId === null)
    if (!clientId) return true;

    console.log(`(server) Storage write attempt: key="${key}" from ${clientId} (operation type: ${typeof operation}, value type: ${typeof value})`);


    // Allow players list management
    if (key === 'players' || key.startsWith('players.')) {
        console.log(`(server) ✅ Allowing players list write`);
        return true;
    }

    // Character selections and simple metadata (but NOT lastStateDelta from clients)
    if (key === 'characterSelections' || key.startsWith('characterSelections.') ||
            key === 'characterSelectionInProgress' || key === 'readyToStartGame' ||
            key === 'isGameStarted' || key === 'startGameData' ||
            key === 'allPlayersReady' || key === 'hostId' || key === 'meta') {
        console.log(`(server) ✅ Allowing metadata write: ${key}=${JSON.stringify(value)}`);
        return true;
    }

    // Inputs per-player: 'inputs.<playerId>' -> ensure client writes only own key and seq increases
    if (key.startsWith('inputs.')) {
        const parts = key.split('.');
        const owner = parts[1];
        if (owner !== clientId) {
            console.warn(`❌ ${clientId} attempted to write inputs for ${owner} in ${roomId}`);
            return false;
        }

        // Expect the value to contain a seq number
        const seq = value?.seq;
        if (typeof seq !== 'number') {
            console.warn(`❌ Missing seq in inputs from ${clientId} in ${roomId}`);
            console.warn(`   - value type: ${typeof value}`);
            console.warn(`   - value: ${JSON.stringify(value)}`);
            console.warn(`   - operation: ${JSON.stringify(operation)}`);
            return false;
        }

        const meta = roomData.get(roomId);
        if (!meta) return false;
        const last = meta.lastInputSeq.get(clientId) || 0;
        if (seq <= last) {
            console.warn(`❌ Rejected stale seq=${seq} from ${clientId} (last=${last}) in ${roomId}`);
            return false;
        }

        meta.lastInputSeq.set(clientId, seq);
        console.log(`✅ Accepted inputs.${clientId} seq=${seq} in ${roomId}`);
        return true;
    }

    // Block writes to authoritative state keys
    if (key.startsWith('game') || key.startsWith('entities') || key.startsWith('enemies') ||
            key.startsWith('projectiles') || key.startsWith('walls') || key === 'lastStateDelta') {
        console.warn(`⛔ Blocked unauthorized storage write by ${clientId} to ${key}`);
        return false;
    }

    // Default deny
    console.warn(`(server) Denying storage write to ${key} by ${clientId} in room ${roomId}`);
    return false;
});

// Log when storage updates are applied to clients
server.onEvent('storageUpdated', ({ roomId, clientId, update, storage }) => {
    if (update && update.key === 'characterSelectionInProgress') {
        console.log(`📡 Storage updated: characterSelectionInProgress=${storage.characterSelectionInProgress} (from ${clientId})`);
    }
});

// Periodic cleanup of dead clients
setInterval(() => {
    const cutoff = now() - 30000;
    for (const [roomId, meta] of roomData) {
        for (const [clientId, ts] of meta.heartbeats) {
            if (ts < cutoff) {
                console.log(`💀 Removing dead client ${clientId} from ${roomId}`);
                meta.heartbeats.delete(clientId);
                meta.lastInputSeq.delete(clientId);
                if (clientId === meta.hostId) {
                    const next = [...meta.heartbeats.keys()][0] || null;
                    meta.hostId = next;
                    console.log(`👑 Host replaced: ${next}`);
                }
            }
        }
    }
}, 4000);

console.log('📡 Server ready');
