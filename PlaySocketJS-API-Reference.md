# PlaySocketJS API Reference

**Version**: 2.6.3  
**Repository**: https://github.com/therealPaulPlay/PlaySocketJS  
**License**: MIT

---

## Overview

PlaySocketJS is a reactive WebSocket library for building multiplayer games and apps. It handles state synchronization, reconnection, and conflict-free updates automatically.

---

## CLIENT API (PlaySocket)

### Initialization

```javascript
import PlaySocket from 'playsocketjs';

const socket = new PlaySocket(clientId, {
    endpoint: 'ws://localhost:3001',
    customData: {},          // Optional arbitrary data sent in clientRegistered event
    debug: false             // Optional debug logging
});

const actualClientId = await socket.init();
```

### Room Management

| Method | Parameters | Returns | Description |
|--------|------------|---------|-------------|
| `createRoom()` | `initialStorage?: object, size?: number` | `Promise<string>` | Create a new room and become host. Returns room ID. Max 100 participants. |
| `joinRoom()` | `roomId: string` | `Promise<void>` | Join an existing room |
| `destroy()` | - | `void` | Leave room and close connection |

### Storage (Shared State)

The storage system provides conflict-free updates for shared game state.

**Methods:**

| Method | Parameters | Returns | Description |
|--------|------------|---------|-------------|
| `updateStorage()` | `key: string, operation: 'set' \| 'array-add' \| 'array-add-unique' \| 'array-remove-matching' \| 'array-update-matching', value: any, updateValue?: any` | `void` | Update a key in shared storage (max 100 keys). For '-matching' operations, `value` is what to match, `updateValue` is the replacement. |
| `getStorage` | *property* | `object` | Synchronously read current storage object |

**Example Usage:**
```typescript
// Simple set
socket.updateStorage('players', 'set', ['Player1', 'Player2']);

// Conflict-free array add (won't duplicate)
socket.updateStorage('players', 'array-add-unique', 'Player3');

// Nested updates
socket.updateStorage('inputs.player_123', 'set', { x: 100, y: 50, t: Date.now() });

// Array matching operations
socket.updateStorage('entities', 'array-update-matching', 
    { id: 'enemy_1' },                      // value - what to match
    { id: 'enemy_1', hp: 50 }              // updateValue - replacement
);
```

### Volatile (Unreliable) Messaging

For real-time game state that doesn't need to persist (deltas, player positions, etc.).

| Method | Parameters | Returns | Description |
|--------|------------|---------|-------------|
| `emitVolatile()` | `eventName: string, data: any` | `void` | Send volatile event to all clients in room |
| `onEvent()` | `eventName: string, handler: (data) => void` | `void` | Listen for events (volatile or custom) |

**Example Usage:**
```typescript
// Host sends game state deltas
socket.emitVolatile('state', { tick: 125, entities: {...} });

// All clients listen for state updates
socket.onEvent('state', (state) => {
    // Update game visuals
});
```

### Server Communication

| Method | Parameters | Returns | Description |
|--------|------------|---------|-------------|
| `sendRequest()` | `name: string, data?: any` | `void` | Send request to server (handled in `requestReceived` event) |

### Event Listeners

| Event | Parameter | Description |
|-------|-----------|-------------|
| `status` | `status: string` | Connection status updates |
| `error` | `error: string` | Error messages |
| `storageUpdated` | `storage: object` | Storage changed by any client |
| `hostMigrated` | `roomId: string` | Host was reassigned |
| `clientConnected` | `clientId: string` | New client joined room |
| `clientDisconnected` | `clientId: string, roomId?: string` | Client left room |
| `instanceDestroyed` | - | Socket destroyed (manual or fatal error) |
| **Custom Events** | `data: any` | Any event registered via `onEvent()` |

**Usage:**
```typescript
socket.onStorageKey('players', (players) => {
    // Triggered when 'players' key changes
});

socket.onEvent('custom-event', (data) => {
    // Handle custom server event
});
```

### Properties (Read-only)

| Property | Type | Description |
|----------|------|-------------|
| `id` | `string` | Your client's unique ID |
| `isHost` | `boolean` | Whether you're the host |
| `connectionCount` | `number` | Other clients in room (excluding self) |

---

## SERVER API (PlaySocketServer)

### Initialization

```javascript
import PlaySocketServer from 'playsocketjs/server';

// Standalone
const server = new PlaySocketServer({ port: 3001 });

// With Express
import express from 'express';
import http from 'http';

const app = express();
const httpServer = http.createServer(app);
const server = new PlaySocketServer({
    server: httpServer,
    path: '/socket',
    debug: true
});

httpServer.listen(3001);
```

### Configuration Options

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `port` | number | 3000 | Port to listen on (standalone only) |
| `path` | string | '/' | WebSocket endpoint path |
| `server` | http.Server | - | Existing HTTP server (optional) |
| `rateLimit` | number | 20 | Messages per second rate limit |
| `debug` | boolean | false | Enable debug logging |

### Room Management

| Method | Parameters | Returns | Description |
|--------|------------|---------|-------------|
| `createRoom()` | `initialStorage?: object, size?: number, host?: string` | `{ state: object, id: string }` | Create room. Host defaults to "server" if not player. |
| `destroyRoom()` | `roomId: string` | `void` | Destroy room and kick all participants |
| `getRoomStorage()` | `roomId: string` | `object` | Get current room storage snapshot |
| `updateRoomStorage()` | `roomId: string, key: string, type: 'set' \| 'array-add' \| 'array-add-unique' \| 'array-remove-matching' \| 'array-update-matching', value: any, updateValue?: any` | `void` | Server-side storage update |

### Client Management

| Method | Parameters | Returns | Description |
|--------|------------|---------|-------------|
| `kick()` | `clientId: string, reason?: string` | `void` | Disconnect client with optional error message |
| `stop()` | - | `void` | Shutdown server and disconnect all clients |

### Volatile Messaging

| Method | Parameters | Returns | Description |
|--------|------------|---------|-------------|
| `emitToRoomVolatile()` | `roomId: string, eventName: string, data: any, options?: { except?: clientId }` | `void` | Send volatile event to room (optionally excluding one client) |
| `sendMessageToClient()` | `clientId: string, eventName: string, data: any` | `void` | Send volatile event to specific client |

### Event Handlers

```javascript
server.onEvent(eventName, callback);
```

**Lifecycle Events:**

| Event | Parameters | Return Type | Description |
|-------|------------|------------|-------------|
| `clientRegistrationRequested` | `(clientId: string, customData: object)` | `false \| string` | Client registration. Return `false` or reason string to block. |
| `clientRegistered` | `(clientId: string, customData: object)` | - | Client successfully registered |
| `clientDisconnected` | `(clientId: string)` | - | Client disconnected from server |
| `clientJoinRequested` | `(clientId: string, roomId: string)` | `false \| string` | Join request. Return `false` or reason to block. |
| `clientJoinedRoom` | `(clientId: string, roomId: string)` | - | Client successfully joined room |
| `roomCreationRequested` | `({ clientId: string, initialStorage: object })` | `object \| false` | Room creation request. Return modified storage or `false` to deny. |
| `roomCreated` | `(roomId: string)` | - | Room successfully created |
| `roomDestroyed` | `(roomId: string)` | - | Room destroyed (all players left) |

**Storage Events:**

| Event | Parameters | Return Type | Description |
|-------|------------|------------|-------------|
| `storageUpdateRequested` | `({ clientId: string, roomId: string, key: string, operation: string, value: any, updateValue?: any, storage: object })` | `boolean` | Storage update requested. Return `false` to block. |
| `storageUpdated` | `({ clientId: string, roomId: string, update: object, storage: object })` | - | Storage update applied |

**Custom Events:**

| Event | Parameters | Return Type | Description |
|-------|------------|------------|-------------|
| `requestReceived` | `({ clientId: string, roomId?: string, requestName: string, data?: any })` | - | Client sent a request via `sendRequest()` |
| **Custom Events** | `(clientId: string, roomId: string, ...args)` | - | Any custom event sent via `emitVolatile()` |

### Properties (Read-only)

| Property | Type | Description |
|----------|------|-------------|
| `getRooms` | `object` | All current room objects |

---

## REAL-WORLD USAGE EXAMPLES

### Example 1: Host Broadcasting Game State (from your server)

```javascript
// Host sends state deltas
server.onEvent('state', (clientId, roomId, delta) => {
    const data = roomData.get(roomId);
    
    // Only accept from host
    if (clientId !== data.hostId) return;
    
    // Broadcast to other clients
    server.emitToRoomVolatile(roomId, 'state', delta, { except: clientId });
});
```

### Example 2: Client Listening for State Updates

```typescript
// Receive volatile game state
socket.onEvent('state', (state) => {
    gameEngine.updateEntities(state.entities);
    gameEngine.updateTick(state.tick);
});

// Send input to host via storage
socket.updateStorage(`inputs.${playerId}`, 'set', {
    x: 100,
    y: 50,
    action: 'jump',
    t: Date.now()
});
```

### Example 3: Storage-Based Player Management

```javascript
// Server validates player list updates
server.onEvent('storageUpdateRequested', ({ clientId, key, operation }) => {
    // Allow clients to update their own player entry
    if (key.startsWith('players.') || key === 'players') {
        return true;  // Allow
    }
    
    // Block unauthorized updates
    return false;
});

// Client adds self to players list
socket.updateStorage('players', 'array-add-unique', myPlayerId);
```

### Example 4: Host Migration

```javascript
// Client detects new host
socket.onEvent('hostMigrated', (roomId) => {
    console.log('New host assigned');
    
    if (socket.isHost) {
        // Now responsible for sending state deltas
        startHostLoop();
    }
});

// Server handles host disconnect
server.onEvent('clientDisconnected', (clientId) => {
    const data = roomData.get(roomId);
    if (clientId === data.hostId) {
        // PlaySocket automatically selects new host
        data.hostId = nextPlayer;
    }
});
```

---

## STORAGE OPERATIONS EXPLAINED

### `'set'` - Direct assignment
```javascript
socket.updateStorage('key', 'set', newValue);
```
Simple value replacement.

### `'array-add'` - Add to array
```javascript
socket.updateStorage('items', 'array-add', newItem);
```
Appends to array (may create duplicates).

### `'array-add-unique'` - Add only if not exists
```javascript
socket.updateStorage('players', 'array-add-unique', playerId);
```
Won't add if value already in array (conflict-free).

### `'array-remove-matching'` - Remove matching items
```javascript
socket.updateStorage('items', 'array-remove-matching', valueToRemove);
```
Removes all items matching `value`.

### `'array-update-matching'` - Update matching items
```javascript
socket.updateStorage('entities', 'array-update-matching', 
    matchCriteria,      // value parameter
    replacement         // updateValue parameter
);
```
Replaces first item matching `value` with `updateValue`.

---

## COMMON PATTERNS

### Heartbeat Pattern (from your server)
```javascript
server.onEvent('heartbeat', (clientId, roomId) => {
    const data = roomData.get(roomId);
    data.heartbeats.set(clientId, Date.now());
});

// Periodic cleanup
setInterval(() => {
    const cutoff = Date.now() - 8000;
    for (const [roomId, data] of roomData) {
        for (const [clientId, lastHB] of data.heartbeats) {
            if (lastHB < cutoff) {
                server.kick(clientId, 'No heartbeat');
            }
        }
    }
}, 4000);
```

### Input Collection Pattern
```javascript
// Client sends input
socket.updateStorage(`inputs.${playerId}`, 'set', { x, y, buttons });

// Host reads input
const storage = server.getRoomStorage(roomId);
const playerInputs = storage.inputs;
```

### Snapshot Pattern
```javascript
// Client requests full snapshot
socket.sendRequest('requestSnapshot', {});

// Server sends snapshot
server.onEvent('requestReceived', ({ clientId, requestName, data }) => {
    if (requestName === 'requestSnapshot') {
        const snapshot = buildFullGameState();
        server.sendMessageToClient(clientId, 'snapshot', snapshot);
    }
});

// Client receives snapshot
socket.onEvent('snapshot', (snapshot) => {
    gameEngine.loadFullState(snapshot);
});
```

---

## KEY LIMITATIONS & NOTES

1. **Max 100 storage keys** per room
2. **Max 100 clients** per room
3. **Rate limited** to ~20 messages/second per client (configurable)
4. **Volatile events** are not persisted - useful for high-frequency data like positions
5. **Storage events** are persisted and reliable - useful for critical state like player lists
6. **No built-in authentication** - implement custom validation in `clientRegistrationRequested`
7. **Server-created rooms** with non-player hosts persist even when all players leave
