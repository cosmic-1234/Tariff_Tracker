const Product = require('../models/Product');

// @desc    Get all products
// @route   GET /api/products
// @access  Public
const getProducts = async (req, res, next) => {
  try {
    const products = await Product.find({});
    res.status(200).json({
      status: 'success',
      count: products.length,
      products
    });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  getProducts
};
