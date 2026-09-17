const mongoose = require('mongoose');

const DocumentSchema = new mongoose.Schema({
  clientId: { type: mongoose.Schema.Types.ObjectId, ref: 'Client', required: true },
  filename: { type: String, required: true },
  originalName: { type: String, required: true },
  fileType: { type: String, required: true },
  fileSize: { type: Number, required: true },
  fileUrl: { type: String, required: true },

  // OLD (GridFS) - optional for backwards compatibility
  fileId: { type: mongoose.Schema.Types.ObjectId, required: false },

  // NEW (R2) - optional
  r2Key: { type: String, required: false, index: true, sparse: true },

  // Storage type indicator
  storageType: {
    type: String,
    enum: ['gridfs', 'r2'],
    default: 'gridfs',
  },

  mimeType: { type: String, required: true },
  uploadedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  isDeleted: { type: Boolean, default: false },
  createdAt: { type: Date, default: Date.now },
});

DocumentSchema.index({ clientId: 1 });
DocumentSchema.index({ fileType: 1 });
DocumentSchema.index({ isDeleted: 1 });

module.exports = mongoose.model('Document', DocumentSchema);
