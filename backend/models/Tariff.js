const mongoose = require('mongoose');

const TariffSchema = new mongoose.Schema({
  name: {
    type: String,
    required: [true, 'Please add a tariff name'],
    trim: true,
  },
  provider: {
    type: String,
    required: [true, 'Please add a utility/service provider name'],
  },
  rate: {
    type: Number,
    required: [true, 'Please add a tariff rate'],
  },
  unit: {
    type: String,
    default: 'kWh', // e.g., per kWh, per min, per GB
  },
  category: {
    type: String,
    enum: ['electricity', 'water', 'gas', 'internet', 'mobile', 'other'],
    default: 'electricity',
  },
  notes: {
    type: String,
  }
}, {
  timestamps: true
});

module.exports = mongoose.model('Tariff', TariffSchema);
