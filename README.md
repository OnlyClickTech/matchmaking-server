# WebSocket Matchmaking Server

A WebSocket-based matchmaking server to connect users with nearby taskmasters based on specialization and location.

---

## Features

- Users initiate matchmaking requests
- Taskmasters register with specialization
- Geospatial matching using MongoDB 2dsphere
- Real-time notifications via WebSockets
- .env support for backend API URLs

---

## Setup

### 1. Clone and Install

```
git clone <your-repo-url>
cd matchmaking-server
npm install
npm run dev
```

### 2. Environment Variables

```
PORT=5656
TM_BASE_URL=http://localhost:3000
MONGO_URI=mongodb://localhost:27017/matchmaking
```

## Workflow

connect on ws://localhost:5656 on Postman WebSockets 
---
make sure taskmaster backend is online before connecting

### 1. Taskmaster connects

```
{
  "type": "register",
  "role": "taskmaster",
  "id": "task001",
  "specialization": "Electrician"
}
```

### 2. User connects:

```
{
  "type": "register",
  "role": "user",
  "id": "user123"
}
```

### 3. User starts matchmaking:

```
{
"type": "start_matchmaking",
"userId": "user123",
"serviceType": "Electrician",
"location": {
"lat": 17.6868,
"lng": 83.2185
}
}
```

### Taskmaster accepts:

```
{
"type": "accept_match",
"matchId": "MATCH_OBJECT_ID",
"taskmasterId": "task001",
"accepted": true
}
```

---

## Errors

When no taskmasters are available:

```
{
  "type": "error",
  "message": "Unable to find nearby taskmasters"
}
```

---

## Directory Structure

```
matchmaking-server
├── config
│   └── connectDB.js
├── server.js
├── handlers/
│   └── socketHandler.js
├── models/
│   └── match.js
├── .env
├── .gitignore
├── package.json
├── package-lock.json
└── README.md

```
