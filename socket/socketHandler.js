const Match = require('../models/match');
const axios = require('axios');
require('dotenv').config();

if (!process.env.TM_BASE_URL) {
  throw new Error('BACKEND_BASE_URL is not defined in .env');
}


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
          
          if (!clients[role]) {
            clients[role] = {};
          }
          clients[role][id] = ws;
        
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
          const { userId, serviceType, location } = message; 
        
          const match = new Match({
            userId,
            status: 'waiting',
            taskmasterId: null,
            serviceType
          });
        
          await match.save();
          console.log('📦 Match created:', match._id.toString());
        
          try {
            const response = await axios.get(`${process.env.TM_BASE_URL}/api/taskmaster/nearby`, {
              params: {
                category: serviceType,
                lat: location.lat,
                lng: location.lng
              }
            });
        
            const nearbyTaskmasters = response.data;

            console.log("Attempting to broadcast:");
            console.log("Taskmaster list:", nearbyTaskmasters.map(tm => tm.masterId));
            console.log("Clients:", Object.keys(clients.taskmaster));
        
            nearbyTaskmasters.forEach(taskmaster => {
              const socket = clients.taskmaster[taskmaster.masterId];
              if (socket && socket.readyState === socket.OPEN) {
                console.log(`Sending to ${taskmaster.masterId}`);
                socket.send(JSON.stringify({
                  type: 'new_request',
                  matchId: match._id,
                  userId
                }));
              }
            });
        
            console.log(`Broadcast sent to ${nearbyTaskmasters.length} taskmasters.`);
        
          } catch (err) {
            console.error('Failed to find nearby taskmasters:', err.message);
            ws.send(JSON.stringify({ type: 'error', message: 'Unable to find nearby taskmasters' }));
          }
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


module.exports = socketHandler;
