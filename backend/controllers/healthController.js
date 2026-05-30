const mongoose = require('mongoose');

// @desc    Get API & DB status
// @route   GET /api/health
// @access  Public
const getHealth = (req, res) => {
  const dbStatus = mongoose.connection.readyState === 1 ? 'Connected' : 'Disconnected';
  
  res.status(200).json({
    status: 'success',
    message: 'Backend server is running smoothly',
    timestamp: new Date(),
    uptime: process.uptime(),
    database: dbStatus
  });
};

module.exports = { getHealth };
