const mongoose = require('mongoose');

const PDFSchema = new mongoose.Schema({
  filename: { type: String, required: true },
  contentType: { type: String, required: true },
  size: { type: Number, required: true },
  uploadedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  clientId: { type: mongoose.Schema.Types.ObjectId, ref: 'Client' },
  registrationId: { type: mongoose.Schema.Types.ObjectId, ref: 'Registration' },
  automationId: { type: mongoose.Schema.Types.ObjectId, ref: 'Automation' }, // ✅ Added for automation
  fileId: { type: mongoose.Schema.Types.ObjectId, required: true },
  createdAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model('PDF', PDFSchema);