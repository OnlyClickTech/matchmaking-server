# Matchmaking Server Documentation

## Overview

This server uses **Socket.IO** to facilitate **real-time matchmaking** between users and taskmasters based on their location and service type. It provides two matchmaking strategies:

1. **Broadcast Matchmaking**: Notifies all nearby taskmasters simultaneously.
2. **Nearby Sequential Matchmaking**: Notifies one taskmaster at a time based on proximity.

---

## Directory Structure

```
├── controllers/
│   ├── matchmakingController.js
│   ├── nearbyMatchmakingController.js
│   └── registerController.js
├── utils/
│   ├── clientManager.js
│   └── timeoutManager.js
├── socket/
│   └── index.js
├── models/
│   └── match.js
```

---

## Registration Flow

**File**: `registerController.js`

### `handleRegister(socket, { role, id, specialization })`

Registers a socket as either a **user** or a **taskmaster** and stores it in memory using `clientManager`.

- Stores socket info by `role` and `id`
- Logs connection info

---

## Matchmaking Flow (Broadcast Style)

**File**: `matchmakingController.js`

### `startMatchmaking(socket, { userId, serviceType, location })`

- Creates a new match document in the DB.
- Fetches all nearby taskmasters for the given service.
- Emits `new_request` to all connected taskmasters.
- Emits an error to the user if fetching taskmasters fails.

### `acceptMatch(socket, { matchId, taskmasterId, accepted })`

- If accepted:
  - Sets `status` to `'matched'`
  - Links `taskmasterId` to the match
  - Notifies the user with `match_complete`
- If rejected:
  - Responds with `match_declined`

---

## Matchmaking Flow (Nearby Sequential)

**File**: `nearbyMatchmakingController.js`

### `startNearbyMatchmaking(socket, { userId, serviceType, location })`

- Creates a match and fetches taskmasters by proximity.
- Emits `new_request_nearby` to the **nearest available** taskmaster.
- Sets a 15-minute timeout to await response.
- Saves taskmaster list and state in memory using `timeoutManager`.

### `acceptNearbyMatch(socket, { matchId, taskmasterId, accepted })`

- On accept:
  - Updates the match as `matched`, clears timeout
  - Notifies the user via `match_complete`
- On decline or timeout:
  - Moves to the next nearest taskmaster
  - If none remain, notifies user with `match_failed`

---

## In-Memory State Management

**File**: `timeoutManager.js`

- `saveMatchState(matchId, state)` — Stores current taskmaster index and timeout.
- `getMatchState(matchId)` — Retrieves current state.
- `setMatchTimeout(matchId, timeoutId)` — Updates timeout reference.
- `deleteMatch(matchId)` — Removes state on completion/failure.

---

## 🔌 Client Management

**File**: `clientManager.js`

- `addClient(role, id, socket, specialization)` — Registers socket by role and optionally by specialization.
- `removeClient(role, id)` — Deregisters on disconnect.
- `getClient(role, id)` — Fetches stored socket instance.

---

## Socket Event Bindings

**File**: `socket/index.js`

Binds events to Socket.IO:

- `register`
- `start_matchmaking`
- `accept_match`
- `start_matchmaking_nearby`
- `accept_match_nearby`
- `disconnect`

Example:

```js
socket.on("start_matchmaking", (data) => startMatchmaking(socket, data));
```

---

## Environment Variables

| Key           | Description                           |
| ------------- | ------------------------------------- |
| `TM_BASE_URL` | http://localhost:3000                 |
| `PORT`        | 5656                                  |
| `MONGO_URI`   | mongodb://localhost:27017/matchmaking |

---

## Error Handling

- Emits `error` events to the initiating user on failure (e.g., no taskmasters, DB errors).
- Gracefully handles:
  - Already matched cases
  - Timeout transitions
  - Missing match states

---

## Timeout Logic Summary

Each nearby taskmaster is given **15 minutes** to respond. On no response:

- Match is offered to the **next** in the list.
- Ends after all taskmasters are tried.

---

## Match Status Values

| Status    | Description                     |
| --------- | ------------------------------- |
| `waiting` | Awaiting taskmaster response    |
| `matched` | Taskmaster accepted the request |
