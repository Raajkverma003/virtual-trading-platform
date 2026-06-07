const dotenv = require('dotenv');
const path = require('path');

// Load environment variables from .env file
dotenv.config({ path: path.join(__dirname, '../../.env') });

const requiredEnv = ['MONGO_URI', 'JWT_SECRET'];

for (const env of requiredEnv) {
  if (!process.env[env]) {
    console.error(`ERROR: Environment variable ${env} is required but missing.`);
    process.exit(1);
  }
}

module.exports = {
  PORT: process.env.PORT || 5000,
  MONGO_URI: process.env.MONGO_URI,
  JWT_SECRET: process.env.JWT_SECRET,
  JWT_EXPIRE: process.env.JWT_EXPIRE || '7d',
  SIMULATION_INTERVAL: parseInt(process.env.SIMULATION_INTERVAL, 10) || 5000,
  NODE_ENV: process.env.NODE_ENV || 'development',
  DATA_SOURCE: (process.env.DATA_SOURCE || 'SIMULATOR').replace(/^["']|["']$/g, ''),
  ALPACA_API_KEY: (process.env.ALPACA_API_KEY || '').replace(/^["']|["']$/g, ''),
  ALPACA_API_SECRET: (process.env.ALPACA_API_SECRET || '').replace(/^["']|["']$/g, ''),
  ALPACA_API_URL: (process.env.ALPACA_API_URL || 'https://paper-api.alpaca.markets').replace(/^["']|["']$/g, '')
};
