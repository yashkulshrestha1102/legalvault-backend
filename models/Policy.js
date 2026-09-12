const mongoose = require('mongoose');

const PolicySchema = new mongoose.Schema({
  policyName: {
    type: String,
    required: true,
    trim: true
  },
  policyType: {
    type: String,
    required: true,
    enum: ['HR Policy', 'Compliance', 'Data Privacy', 'Security', 'Financial', 'Quality', 'Other']
  },
  category: {
    type: String,
    enum: ['Internal', 'External', 'Client', 'Vendor'],
    default: 'Internal'
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
    default: 'General'
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

// Indexes for faster queries
PolicySchema.index({ clientId: 1 });
PolicySchema.index({ policyType: 1 });
PolicySchema.index({ status: 1 });
PolicySchema.index({ expiryDate: 1 });

module.exports = mongoose.model('Policy', PolicySchema);