const mongoose = require('mongoose');
const connectDB = require('../src/config/db');
const User = require('../src/models/User');

const createAdmin = async () => {
  const adminData = {
    username: 'raj',
    email: 'raj@example.com',
    password: 'adminpassword123',
    role: 'admin'
  };

  try {
    await connectDB();

    // Check if user already exists
    const exists = await User.findOne({ username: adminData.username });
    if (exists) {
      console.log(`User with username "${adminData.username}" already exists.`);
      // Update role to admin
      exists.role = 'admin';
      await exists.save();
      console.log(`Updated user "${adminData.username}" role to admin.`);
    } else {
      const admin = await User.create(adminData);
      console.log(`Successfully created admin user:`);
      console.log(`- Username: ${admin.username}`);
      console.log(`- Email: ${admin.email}`);
      console.log(`- Password: adminpassword123`);
      console.log(`- Role: ${admin.role}`);
    }
  } catch (error) {
    console.error(`❌ Error creating admin user: ${error.message}`);
  } finally {
    await mongoose.connection.close();
    process.exit(0);
  }
};

createAdmin();
