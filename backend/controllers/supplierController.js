const Supplier = require('../models/Supplier');

// @desc    Get all suppliers
// @route   GET /api/suppliers
// @access  Public
const getSuppliers = async (req, res, next) => {
  try {
    const suppliers = await Supplier.find({});
    res.status(200).json({
      status: 'success',
      count: suppliers.length,
      suppliers
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Get suppliers by product ERP Code
// @route   GET /api/suppliers/:productErpCode
// @access  Public
const getSuppliersByProduct = async (req, res, next) => {
  try {
    const { productErpCode } = req.params;
    const suppliers = await Supplier.find({ productErpCode });
    res.status(200).json({
      status: 'success',
      count: suppliers.length,
      suppliers
    });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  getSuppliers,
  getSuppliersByProduct
};
