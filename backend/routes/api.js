const express = require('express');
const router = express.Router();
const { getHealth } = require('../controllers/healthController');
const { getProducts } = require('../controllers/productController');
const { getSuppliers, getSuppliersByProduct } = require('../controllers/supplierController');

// Health Check API
router.get('/health', getHealth);

// Product Routes
router.get('/products', getProducts);

// Supplier Routes
router.get('/suppliers', getSuppliers);
router.get('/suppliers/:productErpCode', getSuppliersByProduct);

module.exports = router;
