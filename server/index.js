// Advanced PlaySocketJS Server with Room Lifecycle, Host Selection,
// Delta Sync Support, Heartbeats, and Automatic Cleanup

import PlaySocketServer from 'playsocketjs/server';

const server = new PlaySocketServer({ port: 3001 });

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
// Client → Server Heartbeat (Volatile)
//----------------------------------------------------------
server.onEvent('heartbeat', (clientId, roomId) => {
    const data = roomData.get(roomId);
    if (!data) return;

    data.heartbeats.set(clientId, Date.now());
});

//----------------------------------------------------------
// Host sends delta updates (Volatile)
//----------------------------------------------------------
server.onEvent('stateDelta', (clientId, roomId, delta) => {
    const data = roomData.get(roomId);
    if (!data) return;

    // TODO This ignores all non-host deltas, but clients should be able to send some too (e.g. player input)
    if (clientId !== data.hostId) {
        console.log(`⛔ Ignored delta from non-host ${clientId}`);
        return;
    }

    data.lastTick = delta.tick;

    // Re-broadcast to other clients (volatile)
    server.emitToRoomVolatile(roomId, 'stateDelta', delta, { except: clientId });
});

//----------------------------------------------------------
// Server-side periodic cleanup (dead clients)
//----------------------------------------------------------
setInterval(() => {
    const cutoff = now() - 8000; // 8 seconds without heartbeat → dead

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

console.log("✅ Advanced server logic initialized! Ready for gameplay.");
