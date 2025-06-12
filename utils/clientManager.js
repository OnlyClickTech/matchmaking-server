const clients = {
    user: {},
    taskmaster: {}
  };
  
  function addClient(role, id, socket, specialization) {
    if (!clients[role]) clients[role] = {};
    clients[role][id] = socket;
  
    if (role === 'taskmaster') {
      if (!clients.taskmaster[specialization]) {
        clients.taskmaster[specialization] = {};
      }
      clients.taskmaster[specialization][id] = socket;
    }
  }
  
  function removeClient(role, id) {
    if (clients[role]?.[id]) delete clients[role][id];
  }
  
  function getClient(role, id) {
    return clients[role]?.[id];
  }
  
  function getAll() {
    return clients;
  }
  
  module.exports = { addClient, removeClient, getClient, getAll };
  