require('dotenv').config();
const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const connectDB = require('./config/connectDB');
const socketHandler = require('./socket/index');

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: "*", 
  }
});

connectDB();
socketHandler(io);

const PORT = process.env.PORT || 5656;
server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
