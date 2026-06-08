const mongoose = require('mongoose');
const connectDB = require('../src/config/db');
const User = require('../src/models/User');
const Transaction = require('../src/models/Transaction');

const seed = async () => {
  try {
    await connectDB();
    console.log('Database connected successfully.');

    // Find user bob
    const user = await User.findOne({ email: 'bob@example.com' });
    if (!user) {
      console.log('User traderbob (bob@example.com) not found. Skipping seed.');
      return;
    }

    console.log('Found user traderbob. Deleting old transactions...');
    await Transaction.deleteMany({ user: user._id });

    const now = new Date();
    const twoDaysAgo = new Date(now.getTime() - 2 * 24 * 60 * 60 * 1000);
    const threeDaysAgo = new Date(now.getTime() - 3 * 24 * 60 * 60 * 1000);
    const fourDaysAgo = new Date(now.getTime() - 4 * 24 * 60 * 60 * 1000);

    const transactionsToSeed = [
      // NVDA
      {
        user: user._id,
        symbol: 'NVDA',
        type: 'BUY',
        orderType: 'MARKET',
        shares: 40,
        price: 450.00,
        status: 'COMPLETED',
        timestamp: fourDaysAgo
      },
      {
        user: user._id,
        symbol: 'NVDA',
        type: 'SELL',
        orderType: 'MARKET',
        shares: 10,
        price: 520.00,
        status: 'COMPLETED',
        timestamp: twoDaysAgo
      },
      // NFLX
      {
        user: user._id,
        symbol: 'NFLX',
        type: 'BUY',
        orderType: 'MARKET',
        shares: 20,
        price: 280.00,
        status: 'COMPLETED',
        timestamp: fourDaysAgo
      },
      {
        user: user._id,
        symbol: 'NFLX',
        type: 'SELL',
        orderType: 'MARKET',
        shares: 5,
        price: 310.00,
        status: 'COMPLETED',
        timestamp: twoDaysAgo
      },
      // MSFT
      {
        user: user._id,
        symbol: 'MSFT',
        type: 'BUY',
        orderType: 'MARKET',
        shares: 30,
        price: 320.00,
        status: 'COMPLETED',
        timestamp: threeDaysAgo
      },
      {
        user: user._id,
        symbol: 'MSFT',
        type: 'SELL',
        orderType: 'MARKET',
        shares: 10,
        price: 414.69,
        status: 'COMPLETED',
        timestamp: now
      },
      // META
      {
        user: user._id,
        symbol: 'META',
        type: 'BUY',
        orderType: 'MARKET',
        shares: 5,
        price: 472.36,
        status: 'COMPLETED',
        timestamp: threeDaysAgo
      },
      // AAPL
      {
        user: user._id,
        symbol: 'AAPL',
        type: 'BUY',
        orderType: 'MARKET',
        shares: 10,
        price: 307.23,
        status: 'COMPLETED',
        timestamp: twoDaysAgo
      }
    ];

    await Transaction.insertMany(transactionsToSeed);
    console.log('Seeded transaction history for traderbob successfully!');

  } catch (error) {
    console.error('Seeding error:', error);
  } finally {
    await mongoose.connection.close();
    process.exit(0);
  }
};

seed();
