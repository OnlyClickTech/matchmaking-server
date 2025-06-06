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
          const { role, id, specialization } = message;
        
          if (role === 'taskmaster') {
            if (!clients.taskmaster[specialization]) {
              clients.taskmaster[specialization] = {};
            }
        
            clients.taskmaster[specialization][id] = ws;
            console.log(`taskmaster ${id} connected with specialization ${specialization}`);
          } else if (role === 'user') {
            clients.user[id] = ws;
            console.log(`user ${id} connected`);
          }
        
          return;
        }

        if (message.type === 'start_matchmaking') {
          const { userId, serviceType } = message;
        
          const match = new Match({
            userId,
            status: 'waiting',
            taskmasterId: null,
            serviceType
          });
        
          await match.save();
        
          console.log('📦 Match created:', match._id.toString());
        
          broadcastToSpecialists(serviceType, {
            type: 'new_request',
            matchId: match._id,
            userId
          });
        }

        if (message.type === 'accept_match') {
          const { matchId, taskmasterId, accepted } = message;
        
          const match = await Match.findById(matchId);
        
          if (!match) {
            ws.send(JSON.stringify({ type: 'error', message: 'Match not found' }));
            return;
          }
        
          if (match.status !== 'waiting') {
            ws.send(JSON.stringify({ type: 'error', message: 'Match already taken' }));
            return;
          }
        
          if (accepted) {
            match.status = 'matched';
            match.taskmasterId = taskmasterId;
            await match.save();
        
            if (clients.user[match.userId]) {
              clients.user[match.userId].send(JSON.stringify({
                type: 'match_complete',
                taskmasterId: taskmasterId
              }));
            }
        
            ws.send(JSON.stringify({ type: 'match_accepted', matchId }));
          } else {
            // optional: store declined info or just ignore
            ws.send(JSON.stringify({ type: 'match_declined', matchId }));
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

function broadcastToSpecialists(specialization, payload) {
  const specialistGroup = clients.taskmaster[specialization];
  if (!specialistGroup) {
    console.log(`⚠️ No taskmasters for specialization: ${specialization}`);
    return;
  }

  console.log(`🔁 Broadcasting to ${specialization} taskmasters`);

  Object.values(specialistGroup).forEach(ws => {
    if (ws.readyState === ws.OPEN) {
      ws.send(JSON.stringify(payload));
    }
  });
}

module.exports = socketHandler;
