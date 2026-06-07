const mongoose = require('mongoose');
const http = require('http');
const app = require('../src/app');
const connectDB = require('../src/config/db');
const { startStockSimulation, stopStockSimulation } = require('../src/services/stockSimulator');
const User = require('../src/models/User');
const Stock = require('../src/models/Stock');
const Transaction = require('../src/models/Transaction');
const Position = require('../src/models/Position');

const PORT = 5002;
let serverInstance;

// Helper to make API requests
const apiRequest = async (path, method = 'GET', body = null, token = null) => {
  const headers = {
    'Content-Type': 'application/json'
  };
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }
  
  const options = {
    method,
    headers
  };
  if (body) {
    options.body = JSON.stringify(body);
  }

  const response = await fetch(`http://127.0.0.1:${PORT}${path}`, options);
  const data = await response.json();
  return { status: response.status, data };
};

const runTests = async () => {
  console.log('--- STARTING POSITION AND F&O INTEGRATION TESTS ---');

  // 1. Connect to DB
  await connectDB();

  // Clean test data
  console.log('Cleaning test data...');
  await User.deleteMany({ email: /test.*@example\.com/ });
  await Transaction.deleteMany({});
  await Position.deleteMany({});

  // Seed standard stocks if empty
  const stockCount = await Stock.countDocuments();
  if (stockCount === 0) {
    console.log('Seeding stock list...');
    await Stock.create({ symbol: 'AAPL', name: 'Apple Inc.', price: 180.00, prevClose: 178.50 });
    await Stock.create({ symbol: 'TSLA', name: 'Tesla Inc.', price: 175.00, prevClose: 174.00 });
  }

  // 2. Start HTTP server & simulator
  serverInstance = http.createServer(app).listen(PORT, () => {
    console.log(`Test server running on port ${PORT}`);
  });
  await startStockSimulation();

  let token = null;

  try {
    // Test 1: Register User
    console.log('\n[Test 1] Registering test user...');
    const regRes = await apiRequest('/api/auth/register', 'POST', {
      username: 'positiontrader',
      email: 'positiontrader@example.com',
      password: 'password123'
    });
    console.log('Status:', regRes.status);
    if (regRes.status !== 201 || !regRes.data.token) {
      throw new Error('Registration failed');
    }
    token = regRes.data.token;

    // Test 2: Verify Initial Balance
    console.log('\n[Test 2] Verifying initial user balance...');
    const meRes = await apiRequest('/api/auth/me', 'GET', null, token);
    console.log('Balance:', meRes.data.data.balance);
    if (meRes.data.data.balance !== 100000) {
      throw new Error('Initial balance should be 100,000');
    }

    // Test 3: Buy STOCK (market order)
    console.log('\n[Test 3] Buying 10 shares of AAPL (STOCK)...');
    const buyStockRes = await apiRequest('/api/trades/order', 'POST', {
      symbol: 'AAPL',
      type: 'BUY',
      orderType: 'MARKET',
      shares: 10,
      assetType: 'STOCK'
    }, token);
    console.log('Status:', buyStockRes.status);
    console.log('Message:', buyStockRes.data.message);
    if (buyStockRes.status !== 201) {
      throw new Error('STOCK order failed');
    }

    // Test 4: Verify that STOCK is in Positions (not settled Holdings yet)
    console.log('\n[Test 4] Verifying holdings is still empty...');
    const portRes = await apiRequest('/api/portfolio', 'GET', null, token);
    console.log('Holdings length:', portRes.data.data.holdings.length);
    if (portRes.data.data.holdings.length !== 0) {
      throw new Error('Holdings should be empty before settlement');
    }

    // Test 5: Buy FUTURE (market order)
    console.log('\n[Test 5] Buying 5 contracts of TSLA (FUTURE)...');
    const buyFutRes = await apiRequest('/api/trades/order', 'POST', {
      symbol: 'TSLA',
      type: 'BUY',
      orderType: 'MARKET',
      shares: 5,
      assetType: 'FUTURE',
      expiry: '26-Jun-2026'
    }, token);
    console.log('Status:', buyFutRes.status);
    console.log('Message:', buyFutRes.data.message);
    if (buyFutRes.status !== 201) {
      throw new Error('FUTURE order failed');
    }

    // Test 6: Buy OPTION (market order)
    console.log('\n[Test 6] Buying 8 contracts of AAPL (Option Call Strike 170)...');
    const buyOptRes = await apiRequest('/api/trades/order', 'POST', {
      symbol: 'AAPL',
      type: 'BUY',
      orderType: 'MARKET',
      shares: 8,
      assetType: 'OPTION',
      optionType: 'CALL',
      strikePrice: 170,
      expiry: '26-Jun-2026'
    }, token);
    console.log('Status:', buyOptRes.status);
    console.log('Message:', buyOptRes.data.message);
    if (buyOptRes.status !== 201) {
      throw new Error('OPTION order failed');
    }

    // Test 7: Get Positions
    console.log('\n[Test 7] Fetching active positions list...');
    const posRes = await apiRequest('/api/portfolio/positions', 'GET', null, token);
    console.log('Status:', posRes.status);
    console.log('Positions count:', posRes.data.data.length);
    console.log('Positions detail:', JSON.stringify(posRes.data.data, null, 2));
    if (posRes.status !== 200 || posRes.data.data.length !== 3) {
      throw new Error('Retrieve positions count mismatch. Expected 3 active positions.');
    }

    // Test 8: Settle Today's Positions
    console.log('\n[Test 8] Triggering daily positions settlement...');
    const settleRes = await apiRequest('/api/portfolio/positions/settle', 'POST', {}, token);
    console.log('Status:', settleRes.status);
    console.log('Message:', settleRes.data.message);
    console.log('Balance after settlement:', settleRes.data.data.balance);
    console.log('Holdings after settlement:', settleRes.data.data.portfolio);
    if (settleRes.status !== 200 || settleRes.data.data.portfolio.length !== 1) {
      throw new Error('Settlement failed. Holdings count should be 1 (for settled AAPL Stock).');
    }

    // Test 9: Verify Positions is empty now
    console.log('\n[Test 9] Fetching positions list after settlement...');
    const posEmptyRes = await apiRequest('/api/portfolio/positions', 'GET', null, token);
    console.log('Positions count after settlement:', posEmptyRes.data.data.length);
    if (posEmptyRes.data.data.length !== 0) {
      throw new Error('Positions list should be empty after settlement');
    }

    console.log('\n=========================================');
    console.log('POSITION AND F&O TESTS COMPLETED SUCCESSFULLY! 🎉');
    console.log('=========================================');

  } catch (error) {
    console.error(`\n❌ TEST FAILURE: ${error.message}`);
    process.exitCode = 1;
  } finally {
    console.log('\nCleaning up server, simulator and database connections...');
    stopStockSimulation();
    if (serverInstance) {
      serverInstance.close();
    }
    await mongoose.connection.close();
    console.log('Finished.');
    process.exit(process.exitCode || 0);
  }
};

runTests();
