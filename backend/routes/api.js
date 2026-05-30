const express = require('express');
const router = express.Router();
const { getHealth } = require('../controllers/healthController');

// Health Check API
router.get('/health', getHealth);

module.exports = router;
