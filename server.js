require('dotenv').config();
const express = require('express');
const http = require('http');
const WebSocket = require('ws');
const connectDB = require('./config/connectDB');
const socketHandler = require('./socket/socketHandler');

const app = express();
const server = http.createServer(app);
const wss = new WebSocket.Server({ server });

connectDB();
socketHandler(wss);

const PORT = process.env.PORT || 5656;
server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
