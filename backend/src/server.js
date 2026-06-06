const http = require('http');
const app = require('./app');
const connectDB = require('./config/db');
const { PORT } = require('./config/env');
const { initSockets } = require('./sockets/socketHandler');
const { startStockSimulation, stopStockSimulation } = require('./services/stockSimulator');

// Connect to Database
connectDB();

// Create HTTP Server
const server = http.createServer(app);

// Initialize Sockets
initSockets(server);

// Start Stock Simulator Loop
startStockSimulation();

// Start Server
const serverInstance = server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});

// Handle graceful shutdown
const handleExit = () => {
  console.log('Stopping stock simulation and shutting down server...');
  stopStockSimulation();
  serverInstance.close(() => {
    console.log('HTTP server closed. Exiting process.');
    process.exit(0);
  });
};

process.on('SIGINT', handleExit);
process.on('SIGTERM', handleExit);

// Handle unhandled promise rejections
process.on('unhandledRejection', (err, promise) => {
  console.error(`Unhandled Rejection Error: ${err.message}`);
  handleExit();
});
