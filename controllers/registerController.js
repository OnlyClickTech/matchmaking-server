const { addClient } = require('../utils/clientManager');

function handleRegister(socket, { role, id, specialization }) {
  socket.role = role;
  socket.userId = id;
  addClient(role, id, socket, specialization);

  if (role === 'taskmaster') {
    console.log(`taskmaster ${id} connected with specialization ${specialization}`);
  } else {
    console.log(`user ${id} connected`);
  }
}

module.exports = { handleRegister };
