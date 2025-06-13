const Match = require('../models/match');
const axios = require('axios');
const { getClient, removeClient } = require('../utils/clientManager');
const TM_BASE_URL = process.env.TM_BASE_URL;
if (!process.env.TM_BASE_URL) {
  throw new Error('BACKEND_BASE_URL is not defined in .env');
}


async function startMatchmaking(socket, { userId, serviceType, location }) {
  const match = new Match({ userId, status: 'waiting', taskmasterId: null, serviceType });
  await match.save();
  console.log('Match created:', match._id.toString());

  try {
    const { data: nearbyTaskmasters } = await axios.get(`${TM_BASE_URL}/api/taskmaster/nearby`, {
      params: { category: serviceType, lat: location.lat, lng: location.lng }
    });

    nearbyTaskmasters.forEach(tm => {
      const tmSocket = getClient('taskmaster', tm.masterId);
      if (tmSocket?.connected) {
        tmSocket.emit('new_request', { matchId: match._id, userId });
      }
    });

    console.log(`Broadcasted to ${nearbyTaskmasters.length} taskmasters.`);
  } catch (err) {
    console.error('Failed to find nearby taskmasters:', err.message);
    socket.emit('error', { message: 'Unable to find nearby taskmasters' });
  }
}

async function acceptMatch(socket, { matchId, taskmasterId, accepted }) {
  if (accepted) {
    const match = await Match.findOneAndUpdate(
      { _id: matchId, status: 'waiting' },
      { status: 'matched', taskmasterId },
      { new: true }
    );
  
    if (!match) {
      socket.emit('error', { message: 'Match already accepted by another taskmaster' });
      return;
    }
  
    const userSocket = getClient('user', match.userId);
    userSocket?.emit('match_complete', { taskmasterId });
    removeClient('user', match.userId);
    removeClient('taskmaster', taskmasterId);
    socket.emit('match_accepted', { matchId });
  } else {
    socket.emit('match_declined', { matchId });
  }
  
}

module.exports = { startMatchmaking, acceptMatch };
