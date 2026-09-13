const mongoose = require('mongoose');

const CustomFolderSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    trim: true
  },
  clientId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Client',
    required: true,
    index: true
  },
  parentFolderId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'CustomFolder',
    default: null, // null = root folder (client folder)
    index: true
  },
  // Materialized path for fast subtree queries
  path: {
    type: String,
    default: '/',
    index: true
  },
  isRoot: {
    type: Boolean,
    default: false // true for the auto-created client folder
  },
  createdBy: {
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

// Compound indexes for fast lookups
CustomFolderSchema.index({ clientId: 1, parentFolderId: 1, isDeleted: 1 });
CustomFolderSchema.index({ clientId: 1, isRoot: 1 });

module.exports = mongoose.model('CustomFolder', CustomFolderSchema);