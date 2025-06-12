const activeNearbyMatches = new Map();

function setMatchTimeout(matchId, timeoutId) {
  const data = activeNearbyMatches.get(matchId);
  if (data) {
    data.timeoutId = timeoutId;
    activeNearbyMatches.set(matchId, data);
  }
}

function getMatchState(matchId) {
  return activeNearbyMatches.get(matchId);
}

function saveMatchState(matchId, state) {
  activeNearbyMatches.set(matchId, state);
}

function deleteMatch(matchId) {
  activeNearbyMatches.delete(matchId);
}

module.exports = { setMatchTimeout, getMatchState, saveMatchState, deleteMatch };
