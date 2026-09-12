const mongoose = require('mongoose');

const GSTSchema = new mongoose.Schema({
  gstName: {
    type: String,
    required: true,
    trim: true
  },
  gstType: {
    type: String,
    required: true,
    enum: ['Regular', 'Composition', 'Unregistered', 'Casual', 'Non-Resident']
  },
  gstin: {
    type: String,
    trim: true,
    uppercase: true,
    sparse: true,  // ✅ Yeh line add karo
    default: '',   // ✅ Default empty string
    // ✅ Validation only if value is provided
    validate: {
      validator: function(v) {
        if (!v) return true; // Empty is allowed
        return /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$/.test(v);
      },
      message: 'Invalid GSTIN format'
    }
  },
  category: {
    type: String,
    enum: ['Central', 'State', 'Integrated', 'Union Territory'],
    default: 'Central'
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

// Indexes for faster queries
GSTSchema.index({ clientId: 1 });
GSTSchema.index({ gstType: 1 });
GSTSchema.index({ status: 1 });
GSTSchema.index({ gstin: 1 });

module.exports = mongoose.model('GST', GSTSchema);