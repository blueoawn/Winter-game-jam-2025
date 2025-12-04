import PlaySocketServer from 'playsocketjs/server';

// Create PlaySocketJS server on port 3001
const server = new PlaySocketServer({ port: 3001 });

console.log('🎮 PlaySocketJS Server Started');
console.log('📡 Clients can connect to: ws://localhost:3001');
console.log('✅ Server is ready and waiting for connections...\n');

// Event: Client registered
server.onEvent('clientRegistered', (clientId, customData) => {
    console.log(`✅ Client registered: ${clientId}`);
});

// Event: Client disconnected
server.onEvent('clientDisconnected', (clientId, roomId) => {
    console.log(`❌ Client disconnected: ${clientId}`);
    if (roomId) {
        console.log(`  📤 Left room: ${roomId}`);
    }
});

// Event: Room created
server.onEvent('roomCreated', (roomId) => {
    console.log(`🏠 Room created: ${roomId}`);
    const storage = server.getRoomStorage(roomId);
    console.log(`  📦 Initial storage:`, storage);
});

// Event: Client joined room
server.onEvent('clientJoinedRoom', (clientId, roomId) => {
    console.log(`👋 Client ${clientId} joined room ${roomId}`);
    const storage = server.getRoomStorage(roomId);
    console.log(`  👥 Players in room:`, storage?.players || []);
});

// Event: Storage updated
server.onEvent('storageUpdated', ({ roomId, clientId, update }) => {
    if (clientId) {
        //console.log(`📝 Storage updated in room ${roomId} by ${clientId}:`, update.key); //debug
    }
});

console.log('📡 Server event handlers registered');
console.log('🎯 Using storage-based synchronization for game state!\n');
