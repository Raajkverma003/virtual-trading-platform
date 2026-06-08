const mongoose = require('mongoose');
const connectDB = require('../src/config/db');
const Transaction = require('../src/models/Transaction');

const inspect = async () => {
  try {
    await connectDB();
    console.log('Database connected successfully.');
    
    const count = await Transaction.countDocuments();
    console.log('Total transactions:', count);
    
    if (count > 0) {
      const txs = await Transaction.find().sort({ timestamp: -1 }).limit(10);
      console.log('Last 10 transactions:', JSON.stringify(txs, null, 2));
    }
  } catch (error) {
    console.error('Inspection error:', error);
  } finally {
    await mongoose.connection.close();
    process.exit(0);
  }
};

inspect();
