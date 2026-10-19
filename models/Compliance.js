const mongoose = require('mongoose');

const ComplianceSchema = new mongoose.Schema({
  clientId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Client',
    required: false, // Internal team ke liye optional
  },
  complianceType: {
    type: String,
    required: true,
    enum: ['GSTR-1', 'GSTR-3B', 'TDS', 'TCS', 'ITR', 'Advance Tax', 'GSTR-9', 'Custom'],
  },
  customName: { type: String, default: '', trim: true },
  
  // ✅ NAYA: Company Name (Email aur UI me dikhega)
  companyName: { type: String, required: true, trim: true },

  period: { type: String, default: '' },
  dueDate: { type: Date, required: true, index: true },
  reminderDays: { type: Number, default: 5, min: 0 },
  
  channels: { email: { type: Boolean, default: true } },
  
  recipients: [{
    name: { type: String, required: true },
    email: { type: String, required: true },
  }],

  // ✅ NAYA: Invoice/Attachment Link
  attachmentUrl: { type: String, default: '' },

  // ✅ NAYA: Kis user ko assign hai (Role-based access ke liye)
  assignedTo: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    default: null,
  },

  status: {
    type: String,
    enum: ['Pending', 'Filed', 'Overdue'],
    default: 'Pending',
  },
  notes: { type: String, default: '' },

  sentReminders: [{
    sentAt: { type: Date, default: Date.now },
    channels: [String],
    type: { type: String, enum: ['auto', 'manual'], default: 'auto' },
    daysBefore: Number,
  }],

  isDeleted: { type: Boolean, default: false },
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
}, { timestamps: true });

ComplianceSchema.index({ dueDate: 1, isDeleted: 1 });
ComplianceSchema.index({ status: 1 });

module.exports = mongoose.model('Compliance', ComplianceSchema);