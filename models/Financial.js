const mongoose = require('mongoose');

const FinancialSchema = new mongoose.Schema({
  financeName: {
    type: String,
    required: true,
    trim: true
  },
  financeType: {
    type: String,
    required: true,
    enum: ['Balance Sheet', 'Income Statement', 'Budget', 'Cash Flow', 'Audit Report', 'Tax Report', 'Other']
  },
  period: {
    type: String,
    trim: true,
    default: ''
  },
  amount: {
    type: Number,
    default: 0
  },
  currency: {
    type: String,
    default: 'INR',
    enum: ['INR', 'USD', 'EUR', 'GBP']
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
    default: 'Finance'
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
FinancialSchema.index({ clientId: 1 });
FinancialSchema.index({ financeType: 1 });
FinancialSchema.index({ status: 1 });

module.exports = mongoose.model('Financial', FinancialSchema);