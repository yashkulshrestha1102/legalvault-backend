const mongoose = require('mongoose');

const CorporateSecretariatSchema = new mongoose.Schema({
  csName: {
    type: String,
    required: true,
    trim: true
  },
  csType: {
    type: String,
    required: true,
    enum: ['Board Meeting', 'Compliance', 'Resolution', 'Annual Report', 'Shareholder Meeting', 'Other']
  },
  companyName: {
    type: String,
    trim: true,
    default: ''
  },
  meetingDate: {
    type: Date
  },
  issueDate: {
    type: Date,
    required: true
  },
  reviewDate: {
    type: Date
  },
  expiryDate: {
    type: Date
  },
  status: {
    type: String,
    enum: ['Active', 'Draft', 'Under Review', 'Expired'],
    default: 'Active'
  },
  description: {
    type: String,
    default: ''
  },
  department: {
    type: String,
    default: 'Secretariat'
  },
  approvedBy: {
    type: String,
    default: ''
  },
  pdfs: {
    type: [String],
    default: []
  },
  clientId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Client',
    required: true
  },
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  }
}, {
  timestamps: true
});

// Indexes
CorporateSecretariatSchema.index({ clientId: 1 });
CorporateSecretariatSchema.index({ csType: 1 });
CorporateSecretariatSchema.index({ status: 1 });

module.exports = mongoose.model('CorporateSecretariat', CorporateSecretariatSchema);