const mongoose = require('mongoose');
const connectDB = require('../src/config/db');
const User = require('../src/models/User');

const inspect = async () => {
  try {
    await connectDB();
    console.log('Database connected successfully.');
    console.log('Current DB Name:', mongoose.connection.name);
    
    // Find all users
    const users = await User.find();
    console.log('Total users count:', users.length);
    console.log('Users list:', JSON.stringify(users, null, 2));

    // Check collections
    const collections = await mongoose.connection.db.listCollections().toArray();
    console.log('Collections list:', collections.map(c => c.name));
  } catch (error) {
    console.error('Inspection error:', error);
  } finally {
    await mongoose.connection.close();
    process.exit(0);
  }
};

inspect();
