const mongoose = require('mongoose');

const DocumentSchema = new mongoose.Schema({
  clientId: { type: mongoose.Schema.Types.ObjectId, ref: 'Client', required: true },
  filename: { type: String, required: true },
  originalName: { type: String, required: true },
  fileType: { type: String, required: true }, // pdf, image, document
  fileSize: { type: Number, required: true },
  fileUrl: { type: String, required: true },
  fileId: { type: mongoose.Schema.Types.ObjectId, required: true },
  mimeType: { type: String, required: true },
  uploadedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  isDeleted: { type: Boolean, default: false },
  createdAt: { type: Date, default: Date.now }
});

DocumentSchema.index({ clientId: 1 });
DocumentSchema.index({ fileType: 1 });
DocumentSchema.index({ isDeleted: 1 });

module.exports = mongoose.model('Document', DocumentSchema);