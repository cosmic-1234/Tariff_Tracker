const express = require('express');
const router = express.Router();
const { getHealth } = require('../controllers/healthController');
const { getProducts } = require('../controllers/productController');
const { getSuppliers, getSuppliersByProduct } = require('../controllers/supplierController');
const calculationsRouter = require('./calculations');
const externalRouter = require('./external');

// Health Check API
router.get('/health', getHealth);

// Product Routes
router.get('/products', getProducts);

// Supplier Routes
router.get('/suppliers', getSuppliers);
router.get('/suppliers/:productErpCode', getSuppliersByProduct);

// Calculation Routes
router.use('/calculations', calculationsRouter);

// External API Proxy Routes
router.use('/external', externalRouter);

module.exports = router;
