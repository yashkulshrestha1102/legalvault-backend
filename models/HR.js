const mongoose = require('mongoose');

const HRSchema = new mongoose.Schema({
  hrName: {
    type: String,
    required: true,
    trim: true
  },
  hrType: {
    type: String,
    required: true,
    enum: ['Policy', 'Record', 'Compliance', 'Training', 'Leave Policy', 'Performance', 'Other']
  },
  employeeId: {
    type: String,
    trim: true,
    default: ''
  },
  department: {
    type: String,
    default: 'General'
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
HRSchema.index({ clientId: 1 });
HRSchema.index({ hrType: 1 });
HRSchema.index({ status: 1 });
HRSchema.index({ employeeId: 1 });

module.exports = mongoose.model('HR', HRSchema);