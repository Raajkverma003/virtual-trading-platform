const mongoose = require('mongoose');
const connectDB = require('../src/config/db');
const User = require('../src/models/User');
const Stock = require('../src/models/Stock');
const Transaction = require('../src/models/Transaction');
const PortfolioHistory = require('../src/models/PortfolioHistory');

const createCollections = async () => {
  try {
    // 1. Connect to Database
    await connectDB();
    console.log('Successfully connected to MongoDB.');

    // 2. Explicitly initialize models (this creates collections and indexes in MongoDB)
    console.log('Creating collections and indexes...');
    
    await User.init();
    console.log('✅ Collection "users" and indexes initialized.');

    await Stock.init();
    console.log('✅ Collection "stocks" and indexes initialized.');

    await Transaction.init();
    console.log('✅ Collection "transactions" and indexes initialized.');

    await PortfolioHistory.init();
    console.log('✅ Collection "portfoliohistories" and indexes initialized.');

    console.log('\nAll collections and indexes created successfully under "virtual_trading_game" database! 🎉');

  } catch (error) {
    console.error(`❌ Error creating collections: ${error.message}`);
  } finally {
    // Close database connection
    await mongoose.connection.close();
    console.log('MongoDB connection closed.');
    process.exit(0);
  }
};

createCollections();
