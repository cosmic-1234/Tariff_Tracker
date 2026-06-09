const mongoose = require('mongoose');

const SupplierSchema = new mongoose.Schema({
  productErpCode: {
    type: String,
    required: [true, 'Product ERP Code is required'],
    trim: true,
    index: true,
  },
  supplierId: {
    type: String,
    required: [true, 'Supplier ID is required'],
    trim: true,
    index: true,
  },
  supplierName: {
    type: String,
    default: 'Unknown Supplier',
    trim: true,
  },
  country: {
    type: String,
    default: 'China',
    trim: true,
  },
  region: {
    type: String,
    default: 'Asia',
    trim: true,
  },
  countryCode: {
    type: String,
    default: 'CN',
    trim: true,
  },
  supplyPct: {
    type: Number,
    default: 0,
  },
  leadTimeDays: {
    type: Number,
    default: 0,
  },
  defaultTransport: {
    type: String,
    default: 'Ship/Ocean',
  },
  reliability: {
    type: Number,
    default: 0,
  },
  moq: {
    type: Number,
    default: 1,
  }
}, {
  timestamps: true
});

module.exports = mongoose.model('Supplier', SupplierSchema);
