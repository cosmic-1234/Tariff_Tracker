const mongoose = require('mongoose');

const connectDB = async () => {
  try {
    const conn = await mongoose.connect(process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/tariff_tracker');
    console.log(`📡 MongoDB Connected: ${conn.connection.host}`);
    
    // Automatically trigger Excel sync on successful DB connection
    const syncExcelToDatabase = require('../services/syncService');
    await syncExcelToDatabase();
  } catch (error) {
    console.error(`❌ Database connection error: ${error.message}`);
    // Exit process with failure
    process.exit(1);
  }
};

module.exports = connectDB;
