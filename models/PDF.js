const mongoose = require('mongoose');

const PDFSchema = new mongoose.Schema({
  filename: { type: String, required: true },
  contentType: { type: String, required: true },
  size: { type: Number, required: true },
  uploadedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  clientId: { type: mongoose.Schema.Types.ObjectId, ref: 'Client' },
  registrationId: { type: mongoose.Schema.Types.ObjectId, ref: 'Registration' },
  automationId: { type: mongoose.Schema.Types.ObjectId, ref: 'Automation' },

  // OLD (GridFS) - optional for backwards compatibility
  fileId: {
    type: mongoose.Schema.Types.ObjectId,
    required: false,
    index: true,
    sparse: true,
  },

  // NEW (R2) - optional
  r2Key: {
    type: String,
    required: false,
    index: true,
    sparse: true,
  },

  // Storage type indicator
  storageType: {
    type: String,
    enum: ['gridfs', 'r2'],
    default: 'gridfs',
  },

  createdAt: { type: Date, default: Date.now },
});

module.exports = mongoose.model('PDF', PDFSchema);