const { handleRegister } = require('../controllers/registerController');
const { startMatchmaking, acceptMatch } = require('../controllers/matchmakingController');
const { startNearbyMatchmaking, acceptNearbyMatch } = require('../controllers/nearbyMatchmakingController');
const { removeClient } = require('../utils/clientManager');

function socketHandler(io) {
  io.on('connection', (socket) => {
    console.log('Client connected:', socket.id);

    socket.on('register', (data) => handleRegister(socket, data));
    socket.on('start_matchmaking', (data) => startMatchmaking(socket, data));
    socket.on('accept_match', (data) => acceptMatch(socket, data));

    socket.on('start_matchmaking_nearby', (data) => startNearbyMatchmaking(socket, data));
    socket.on('accept_match_nearby', (data) => acceptNearbyMatch(socket, data));

    socket.on('disconnect', () => {
      const { role, userId } = socket;
      if (role && userId) {
        removeClient(role, userId);
        console.log(`${role} ${userId} disconnected`);
      }
    });
  });
}

module.exports = socketHandler;
