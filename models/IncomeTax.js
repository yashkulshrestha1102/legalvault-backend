const mongoose = require('mongoose');

const IncomeTaxSchema = new mongoose.Schema({
  taxName: {
    type: String,
    required: true,
    trim: true
  },
  taxType: {
    type: String,
    required: true,
    enum: ['Income Tax', 'TDS', 'TCS', 'Advance Tax', 'Self Assessment', 'Other']
  },
  panNumber: {
    type: String,
    trim: true,
    uppercase: true,
    default: '',
    validate: {
      validator: function(v) {
        if (!v) return true;
        return /^[A-Z]{5}[0-9]{4}[A-Z]{1}$/.test(v);
      },
      message: 'Invalid PAN format. Format: ABCDE1234F'
    }
  },
  assessmentYear: {
    type: String,
    trim: true,
    default: ''
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
    default: 'Tax'
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
IncomeTaxSchema.index({ clientId: 1 });
IncomeTaxSchema.index({ taxType: 1 });
IncomeTaxSchema.index({ status: 1 });
IncomeTaxSchema.index({ panNumber: 1 });

module.exports = mongoose.model('IncomeTax', IncomeTaxSchema);