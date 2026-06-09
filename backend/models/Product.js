const mongoose = require('mongoose');

const ProductSchema = new mongoose.Schema({
  erpCode: {
    type: String,
    required: [true, 'ERP Code is required'],
    unique: true,
    trim: true,
  },
  hsCode: {
    type: String,
    required: [true, 'HS Code is required'],
    trim: true,
  },
  category: {
    type: String,
    default: 'General',
    trim: true,
  },
  description: {
    type: String,
    default: 'No Description',
    trim: true,
  },
  inHandInventory: {
    type: Number,
    default: 0,
  },
  inventoryValue: {
    type: Number,
    default: 0,
  },
  inTransitInventory: {
    type: Number,
    default: 0,
  },
  daysOfCoverage: {
    type: Number,
    default: 0,
  },
  roq: {
    type: Number,
    default: 0,
  },
  reviewType: {
    type: String,
    default: 'Perpetual',
  },
  safetyStock: {
    type: Number,
    default: 0,
  },
  holdingCostPct: {
    type: Number,
    default: 0,
  }
}, {
  timestamps: true
});

module.exports = mongoose.model('Product', ProductSchema);
