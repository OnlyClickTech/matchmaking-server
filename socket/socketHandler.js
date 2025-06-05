const Match = require('../models/match');

const clients = {
  user: {},
  taskmaster: {}
};

function socketHandler(wss) {
  wss.on('connection', (ws) => {
    ws.on('message', async (data) => {
      try {
        const message = JSON.parse(data);

        if (message.type === 'register') {
          clients[message.role][message.id] = ws;
          ws.role = message.role;
          ws.id = message.id;
          console.log(`${message.role} ${message.id} connected`);
        }

        if (message.type === 'start_matchmaking') {
          const match = await Match.create({ userId: message.userId });
          broadcastToTaskmasters({
            type: 'new_request',
            matchId: match._id,
            userId: message.userId
          });
        }

        if (message.type === 'accept_match') {
          const match = await Match.findByIdAndUpdate(message.matchId, {
            status: 'matched',
            taskmasterId: message.taskmasterId
          }, { new: true });

          if (clients.user[match.userId]) {
            clients.user[match.userId].send(JSON.stringify({
              type: 'match_complete',
              taskmasterId: match.taskmasterId
            }));
          }
        }
      } catch (err) {
        console.error('Error handling message:', err);
      }
    });

    ws.on('close', () => {
      if (ws.id && ws.role) {
        delete clients[ws.role][ws.id];
        console.log(`${ws.role} ${ws.id} disconnected`);
      }
    });
  });
}

function broadcastToTaskmasters(payload) {
  Object.values(clients.taskmaster).forEach(ws => {
    ws.send(JSON.stringify(payload));
  });
}

module.exports = socketHandler;
