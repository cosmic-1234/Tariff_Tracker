const mongoose = require('mongoose');

const SyncMetadataSchema = new mongoose.Schema({
  filename: {
    type: String,
    required: true,
    unique: true,
    trim: true,
  },
  lastModified: {
    type: Number,
    required: true,
  }
}, {
  timestamps: true
});

module.exports = mongoose.model('SyncMetadata', SyncMetadataSchema);
