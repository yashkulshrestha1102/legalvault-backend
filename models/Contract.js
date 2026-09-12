const mongoose = require('mongoose');

const ContractSchema = new mongoose.Schema({
  clientId: { type: mongoose.Schema.Types.ObjectId, ref: 'Client', required: true },
  contractType: { type: String, required: true },
  contractName: { type: String, required: true },
  firstParty: { type: String, required: true },
  secondParty: { type: String, required: true },
  startDate: { type: String, required: true },
  endDate: { type: String, required: true },
  status: { type: String, enum: ['Active', 'Expired', 'Renewed', 'Terminated'], default: 'Active' },
  // ✅ Changed: Single PDF to Multiple PDFs
  pdfs: { type: [String], default: [] },
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  isDeleted: { type: Boolean, default: false },
  createdAt: { type: Date, default: Date.now }
});

// ✅ Indexes
ContractSchema.index({ clientId: 1 });
ContractSchema.index({ contractType: 1 });
ContractSchema.index({ isDeleted: 1 });

module.exports = mongoose.model('Contract', ContractSchema);