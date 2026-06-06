const mongoose = require('mongoose');
const http = require('http');
const app = require('../src/app');
const connectDB = require('../src/config/db');
const { startStockSimulation, stopStockSimulation } = require('../src/services/stockSimulator');
const User = require('../src/models/User');
const Stock = require('../src/models/Stock');
const Transaction = require('../src/models/Transaction');

const PORT = 5001;
let serverInstance;

// Helper to make API requests using built-in fetch
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
  console.log('--- STARTING BACKEND INTEGRATION TESTS ---');

  // 1. Connect to DB
  await connectDB();

  // Clean test data
  console.log('Cleaning test data...');
  await User.deleteMany({ email: /test.*@example\.com/ });
  await Transaction.deleteMany({});
  await Stock.deleteMany({});

  // 2. Start HTTP server & simulator
  serverInstance = http.createServer(app).listen(PORT, () => {
    console.log(`Test server running on port ${PORT}`);
  });
  await startStockSimulation();

  let token = null;
  let aaplPrice = 0;

  try {
    // Test 1: Register User
    console.log('\n[Test 1] Registering test user...');
    const regRes = await apiRequest('/api/auth/register', 'POST', {
      username: 'testtrader',
      email: 'testtrader@example.com',
      password: 'password123'
    });
    console.log('Status:', regRes.status);
    console.log('Response:', regRes.data);
    if (regRes.status !== 201 || !regRes.data.token) {
      throw new Error('Registration failed');
    }
    token = regRes.data.token;

    // Test 2: Login User
    console.log('\n[Test 2] Logging in...');
    const loginRes = await apiRequest('/api/auth/login', 'POST', {
      email: 'testtrader@example.com',
      password: 'password123'
    });
    console.log('Status:', loginRes.status);
    console.log('Response:', loginRes.data);
    if (loginRes.status !== 200 || loginRes.data.token !== token) {
      throw new Error('Login failed');
    }

    // Test 3: Get User Details
    console.log('\n[Test 3] Fetching current user details (GET /me)...');
    const meRes = await apiRequest('/api/auth/me', 'GET', null, token);
    console.log('Status:', meRes.status);
    console.log('Response:', meRes.data);
    if (meRes.status !== 200 || meRes.data.data.username !== 'testtrader') {
      throw new Error('Get profile details failed');
    }

    // Test 4: Get Stock list
    console.log('\n[Test 4] Fetching simulated stocks list...');
    const stocksRes = await apiRequest('/api/stocks');
    console.log('Status:', stocksRes.status);
    console.log('Count:', stocksRes.data.count);
    if (stocksRes.status !== 200 || stocksRes.data.count === 0) {
      throw new Error('Get stocks list failed');
    }
    
    // Find AAPL price
    const aapl = stocksRes.data.data.find(s => s.symbol === 'AAPL');
    if (!aapl) throw new Error('AAPL stock not found');
    aaplPrice = aapl.price;
    console.log(`Current AAPL Price: $${aaplPrice}`);

    // Test 5: Place MARKET BUY order (AAPL)
    console.log(`\n[Test 5] Placing BUY MARKET order for 10 shares of AAPL @ $${aaplPrice}...`);
    const buyRes = await apiRequest('/api/trades/order', 'POST', {
      symbol: 'AAPL',
      type: 'BUY',
      orderType: 'MARKET',
      shares: 10
    }, token);
    console.log('Status:', buyRes.status);
    console.log('Response message:', buyRes.data.message);
    console.log('New Balance:', buyRes.data.data.balance);
    if (buyRes.status !== 201 || buyRes.data.data.portfolio.length === 0) {
      throw new Error('Market BUY failed');
    }

    // Test 6: Verify Portfolio
    console.log('\n[Test 6] Fetching portfolio breakdown...');
    const portfolioRes = await apiRequest('/api/portfolio', 'GET', null, token);
    console.log('Status:', portfolioRes.status);
    console.log('Portfolio Data:', portfolioRes.data.data);
    if (portfolioRes.status !== 200 || portfolioRes.data.data.holdings.length !== 1) {
      throw new Error('Portfolio verification failed');
    }

    // Test 7: Place LIMIT BUY order
    const targetLimit = aaplPrice * 0.9;
    console.log(`\n[Test 7] Placing BUY LIMIT order for 5 shares of AAPL @ $${targetLimit.toFixed(2)} (will not execute yet)...`);
    const limitRes = await apiRequest('/api/trades/order', 'POST', {
      symbol: 'AAPL',
      type: 'BUY',
      orderType: 'LIMIT',
      shares: 5,
      limitPrice: targetLimit
    }, token);
    console.log('Status:', limitRes.status);
    console.log('Response:', limitRes.data);
    if (limitRes.status !== 201 || limitRes.data.data.status !== 'PENDING') {
      throw new Error('Limit order submission failed');
    }
    const pendingOrderId = limitRes.data.data._id;

    // Test 8: Get Pending Orders
    console.log('\n[Test 8] Fetching pending limit orders...');
    const pendingRes = await apiRequest('/api/trades/pending', 'GET', null, token);
    console.log('Status:', pendingRes.status);
    console.log('Count:', pendingRes.data.count);
    if (pendingRes.status !== 200 || pendingRes.data.count !== 1) {
      throw new Error('Get pending orders failed');
    }

    // Test 9: Cancel Limit Order
    console.log(`\n[Test 9] Cancelling pending limit order ${pendingOrderId}...`);
    const cancelRes = await apiRequest(`/api/trades/cancel/${pendingOrderId}`, 'DELETE', null, token);
    console.log('Status:', cancelRes.status);
    console.log('Response:', cancelRes.data);
    if (cancelRes.status !== 200 || cancelRes.data.data.status !== 'CANCELLED') {
      throw new Error('Cancel order failed');
    }

    // Test 10: Fetch Leaderboard
    console.log('\n[Test 10] Fetching leaderboard...');
    const leaderboardRes = await apiRequest('/api/leaderboard');
    console.log('Status:', leaderboardRes.status);
    console.log('Leaderboard Rank 1:', leaderboardRes.data.data[0]);
    if (leaderboardRes.status !== 200 || leaderboardRes.data.count === 0) {
      throw new Error('Leaderboard fetch failed');
    }

    console.log('\n=========================================');
    console.log('ALL TESTS COMPLETED SUCCESSFULLY! 🎉');
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
