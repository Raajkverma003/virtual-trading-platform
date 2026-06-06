const socketIO = require('socket.io');

let io = null;

const initSockets = (server) => {
  io = socketIO(server, {
    cors: {
      origin: '*',
      methods: ['GET', 'POST']
    }
  });

  io.on('connection', (socket) => {
    console.log(`Socket connected: ${socket.id}`);

    // Allow user to join their personal notification room
    socket.on('join_user_room', (userId) => {
      if (userId) {
        socket.join(`user_${userId}`);
        console.log(`Socket ${socket.id} joined room user_${userId}`);
      }
    });

    socket.on('disconnect', () => {
      console.log(`Socket disconnected: ${socket.id}`);
    });
  });

  return io;
};

const getIO = () => {
  return io;
};

// Send live stock updates to everyone
const broadcastPrices = (prices) => {
  if (io) {
    io.emit('stock-prices', prices);
  }
};

// Send user updates (order execution, portfolio update) to specific user room
const sendToUser = (userId, eventName, data) => {
  if (io) {
    io.to(`user_${userId}`).emit(eventName, data);
  }
};

module.exports = {
  initSockets,
  getIO,
  broadcastPrices,
  sendToUser
};
