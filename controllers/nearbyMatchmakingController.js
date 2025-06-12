const Match = require('../models/match');
const axios = require('axios');
const { getClient } = require('../utils/clientManager');
const { saveMatchState, getMatchState, deleteMatch, setMatchTimeout } = require('../utils/timeoutManager');

const TM_BASE_URL = process.env.TM_BASE_URL;
if (!process.env.TM_BASE_URL) {
  throw new Error('BACKEND_BASE_URL is not defined in .env');
}

async function startNearbyMatchmaking(socket, { userId, serviceType, location }) {
  const match = new Match({ userId, status: 'waiting', taskmasterId: null, serviceType });
  await match.save();
  const matchId = match._id.toString();

  console.log('[Nearby] Match created:', matchId);

  try {
    const { data: taskmasters } = await axios.get(`${TM_BASE_URL}/api/taskmaster/nearby`, {
      params: { category: serviceType, lat: location.lat, lng: location.lng }
    });

    if (taskmasters.length === 0) {
      socket.emit('error', { message: 'No nearby taskmasters found' });
      return;
    }

    const firstTM = taskmasters[0];
    const firstSocket = getClient('taskmaster', firstTM.masterId);

    if (!firstSocket?.connected) {
      socket.emit('error', { message: 'Nearest taskmaster unavailable' });
      return;
    }

    firstSocket.emit('new_request_nearby', { matchId, userId });

    const timeoutId = setTimeout(() => {
      socket.emit('accept_match_nearby', {
        matchId,
        taskmasterId: firstTM.masterId,
        accepted: false
      });
    }, 15 * 60 * 1000);

    saveMatchState(matchId, {
      currentIndex: 0,
      taskmasters,
      timeoutId
    });

  } catch (err) {
    console.error('Error during nearby matchmaking:', err.message);
    socket.emit('error', { message: 'Unable to initiate nearby matchmaking' });
  }
}

async function acceptNearbyMatch(socket, { matchId, taskmasterId, accepted }) {
  const match = await Match.findById(matchId);
  if (!match || match.status !== 'waiting') {
    socket.emit('error', { message: 'Invalid or already matched' });
    return;
  }

  const active = getMatchState(matchId);
  if (!active) {
    socket.emit('error', { message: 'Match state not found' });
    return;
  }

  const userSocket = getClient('user', match.userId);

  if (accepted) {
    match.status = 'matched';
    match.taskmasterId = taskmasterId;
    await match.save();

    clearTimeout(active.timeoutId);
    deleteMatch(matchId);

    userSocket?.emit('match_complete', { taskmasterId });
    socket.emit('match_accepted', { matchId });
    return;
  }

  // move to next
  clearTimeout(active.timeoutId);
  active.currentIndex++;

  if (active.currentIndex >= active.taskmasters.length) {
    userSocket?.emit('match_failed');
    deleteMatch(matchId);
    socket.emit('match_declined_final', { matchId });
    return;
  }

  const nextTM = active.taskmasters[active.currentIndex];
  const nextSocket = getClient('taskmaster', nextTM.masterId);

  if (!nextSocket?.connected) {
    socket.emit('accept_match_nearby', {
      matchId,
      taskmasterId: nextTM.masterId,
      accepted: false
    });
    return;
  }

  nextSocket.emit('new_request_nearby', {
    matchId,
    userId: match.userId
  });

  const timeoutId = setTimeout(() => {
    socket.emit('accept_match_nearby', {
      matchId,
      taskmasterId: nextTM.masterId,
      accepted: false
    });
  }, 15 * 60 * 1000);

  setMatchTimeout(matchId, timeoutId);
}

module.exports = { startNearbyMatchmaking, acceptNearbyMatch };
