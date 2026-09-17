const mongoose = require('mongoose');

const CustomFileSchema = new mongoose.Schema({
  filename: {
    type: String,
    required: true,
    trim: true
  },
  originalName: {
    type: String,
    required: true
  },
  mimeType: {
    type: String,
    required: true
  },
  fileType: {
    type: String,
    enum: ['pdf', 'image', 'word', 'excel', 'text', 'other'],
    required: true
  },
  fileSize: {
    type: Number,
    required: true
  },

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

  folderId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'CustomFolder',
    required: true,
    index: true
  },
  clientId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Client',
    required: true,
    index: true
  },
  uploadedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  isDeleted: {
    type: Boolean,
    default: false,
    index: true
  },
  deletedAt: { type: Date },
  deletedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' }
}, {
  timestamps: true
});

CustomFileSchema.index({ folderId: 1, isDeleted: 1 });
CustomFileSchema.index({ clientId: 1, isDeleted: 1 });

module.exports = mongoose.model('CustomFile', CustomFileSchema);