const mongoose = require('mongoose');

const ComplianceSchema = new mongoose.Schema({
  clientId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Client',
    required: false, // optional — apne internal team ke liye bhi use kar sakte ho
  },
  complianceType: {
    type: String,
    required: true,
    enum: ['GSTR-1', 'GSTR-3B', 'TDS', 'TCS', 'ITR', 'Advance Tax', 'GSTR-9', 'Custom'],
  },
  customName: {
    type: String,
    default: '',
    trim: true,
  },
  period: {
    type: String,
    default: '', // e.g. "Oct 2026", "Q2 FY26"
  },
  dueDate: {
    type: Date,
    required: true,
    index: true,
  },
  // Kitne din pehle reminder bhejna hai (default 5)
  reminderDays: {
    type: Number,
    default: 5,
    min: 0,
  },
  // Channels
  channels: {
    email: { type: Boolean, default: true },
    
  },
  // Recipients — team members
  recipients: [{
    name: { type: String, required: true },
    email: { type: String, required: true },
  }],
  status: {
    type: String,
    enum: ['Pending', 'Filed', 'Overdue'],
    default: 'Pending',
  },
  notes: {
    type: String,
    default: '',
  },
  // Reminder tracking — kis din bheja gaya
  sentReminders: [{
    sentAt: { type: Date, default: Date.now },
    channels: [String], // ['email', 'whatsapp']
    type: { type: String, enum: ['auto', 'manual'], default: 'auto' },
    daysBefore: Number, // 5, 4, 3...
  }],
  isDeleted: { type: Boolean, default: false },
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
}, { timestamps: true });

ComplianceSchema.index({ dueDate: 1, isDeleted: 1 });
ComplianceSchema.index({ status: 1 });

module.exports = mongoose.model('Compliance', ComplianceSchema);