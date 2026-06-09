const express = require('express');
const router = express.Router();
const calculationController = require('../controllers/calculationController');

// SDE/VED and advanced risk scores route
router.post('/risk-records', calculationController.calculateRiskRecords);

// SDE/VED detailed mathematical derivation route
router.post('/risk-details', calculationController.getRiskDetails);

// Landed cost and tariff impact route
router.post('/tariff', calculationController.calculateTariff);

// Sensitivity and scenario simulation route
router.post('/scenario', calculationController.runScenario);

// Procurement MILP solver optimization route
router.post('/procurement-optimizer', calculationController.optimizeProcurement);

module.exports = router;
