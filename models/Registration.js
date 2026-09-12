const mongoose = require('mongoose');

const RegistrationSchema = new mongoose.Schema({
  clientId: { type: mongoose.Schema.Types.ObjectId, ref: 'Client', required: true },
  category: { type: String, required: true },
  registrationName: { type: String, required: true },
  startDate: { type: String, required: true },
  endDate: { type: String, required: true },
  // ✅ Changed: Single PDF to Multiple PDFs
  pdfs: { type: [String], default: [] },  // Array of PDF URLs
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  isDeleted: { type: Boolean, default: false },
  createdAt: { type: Date, default: Date.now }
});

// ✅ Indexes
RegistrationSchema.index({ clientId: 1 });
RegistrationSchema.index({ category: 1 });
RegistrationSchema.index({ isDeleted: 1 });

module.exports = mongoose.model('Registration', RegistrationSchema);