const Match = require('../models/match');
const axios = require('axios');
require('dotenv').config();
const activeNearbyMatches = new Map(); 

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

        if (message.type === 'start_matchmaking_nearby') {
          const { userId, serviceType, location } = message;
        
          const match = new Match({
            userId,
            status: 'waiting',
            taskmasterId: null,
            serviceType
          });
        
          await match.save();
          console.log('📦 [Nearby] Match created:', match._id.toString());
        
          try {
            const response = await axios.get(`${process.env.TM_BASE_URL}/api/taskmaster/nearby`, {
              params: {
                category: serviceType,
                lat: location.lat,
                lng: location.lng
              }
            });
        
            const nearbyTaskmasters = response.data;
        
            if (nearbyTaskmasters.length === 0) {
              ws.send(JSON.stringify({ type: 'error', message: 'No nearby taskmasters found' }));
              return;
            }
        
            const matchId = match._id.toString();
            const taskmasters = nearbyTaskmasters;
            const firstTM = taskmasters[0];
            const firstSocket = clients.taskmaster[firstTM.masterId];
        
            if (!firstSocket || firstSocket.readyState !== firstSocket.OPEN) {
              ws.send(JSON.stringify({ type: 'error', message: 'Nearest taskmaster unavailable' }));
              return;
            }
        
            firstSocket.send(JSON.stringify({
              type: 'new_request_nearby',
              matchId,
              userId
            }));
        
            const timeoutId = setTimeout(() => {
              wss.emit('message', JSON.stringify({
                type: 'accept_match_nearby',
                matchId,
                taskmasterId: firstTM.masterId,
                accepted: false
              }));
            }, 15 * 60 * 1000);
        
            activeNearbyMatches.set(matchId, {
              currentIndex: 0,
              taskmasters,
              timeoutId
            });
        
            console.log(`Sent to first taskmaster: ${firstTM.masterId}`);
        
          } catch (err) {
            console.error('Error during nearby matchmaking:', err.message);
            ws.send(JSON.stringify({ type: 'error', message: 'Unable to initiate nearby matchmaking' }));
          }
        }

        if (message.type === 'accept_match_nearby') {
          const { matchId, taskmasterId, accepted } = message;
          const match = await Match.findById(matchId);
        
          if (!match || match.status !== 'waiting') {
            ws.send(JSON.stringify({ type: 'error', message: 'Invalid or already matched' }));
            return;
          }
        
          const active = activeNearbyMatches.get(matchId);
          if (!active) {
            ws.send(JSON.stringify({ type: 'error', message: 'Match state not found' }));
            return;
          }
        
          const userSocket = clients.user[match.userId];
        
          if (accepted) {
            match.status = 'matched';
            match.taskmasterId = taskmasterId;
            await match.save();
        
            clearTimeout(active.timeoutId);
            activeNearbyMatches.delete(matchId);
        
            if (userSocket) {
              userSocket.send(JSON.stringify({
                type: 'match_complete',
                taskmasterId
              }));
            }
        
            ws.send(JSON.stringify({ type: 'match_accepted', matchId }));
            return;
          }
        
          clearTimeout(active.timeoutId);
          active.currentIndex++;
        
          if (active.currentIndex >= active.taskmasters.length) {
            if (userSocket) {
              userSocket.send(JSON.stringify({ type: 'match_failed' }));
            }
            activeNearbyMatches.delete(matchId);
            ws.send(JSON.stringify({ type: 'match_declined_final', matchId }));
            return;
          }
        
          const nextTM = active.taskmasters[active.currentIndex];
          const nextSocket = clients.taskmaster[nextTM.masterId];
        
          if (!nextSocket || nextSocket.readyState !== nextSocket.OPEN) {
            wss.emit('message', JSON.stringify({
              type: 'accept_match_nearby',
              matchId,
              taskmasterId: nextTM.masterId,
              accepted: false
            }));
            return;
          }
        
          nextSocket.send(JSON.stringify({
            type: 'new_request_nearby',
            matchId,
            userId: match.userId
          }));
        
          const timeoutId = setTimeout(() => {
            wss.emit('message', JSON.stringify({
              type: 'accept_match_nearby',
              matchId,
              taskmasterId: nextTM.masterId,
              accepted: false
            }));
          }, 15 * 60 * 1000);
        
          active.timeoutId = timeoutId;
          activeNearbyMatches.set(matchId, active);
        
          console.log(` Declined by ${taskmasterId}, moved to next: ${nextTM.masterId}`);
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
