const mongoose = require('mongoose');

const AuditLogSchema = new mongoose.Schema({
  user: {
    id: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    name: { type: String, required: true },
    email: { type: String, required: true },
    role: { type: String, required: true }
  },
  action: {
    type: String,
    enum: ['CREATE', 'UPDATE', 'DELETE', 'LOGIN', 'LOGOUT', 'VIEW', 'ROLLBACK', 'UPLOAD'],
    required: true
  },
  entity: {
    type: String,
    enum: ['CLIENT', 'REGISTRATION', 'CONTRACT', 'USER', 'DOCUMENT', 'FOLDER', 'AUTOMATION', 'OTHER'],
    required: true
  },
  entityId: { type: mongoose.Schema.Types.ObjectId },
  entityName: { type: String },
  clientId: { type: mongoose.Schema.Types.ObjectId, ref: 'Client' },
  clientName: { type: String },
  changes: {
    before: { type: mongoose.Schema.Types.Mixed, default: {} },
    after: { type: mongoose.Schema.Types.Mixed, default: {} },
    fields: { type: [String], default: [] }
  },
  documentInfo: {
    filename: { type: String },
    fileType: { type: String },
    fileSize: { type: Number },
    fileId: { type: String }
  },
  rollbacked: { type: Boolean, default: false },
  rollbackedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  rollbackedAt: { type: Date },
  rollbackReason: { type: String },
  ipAddress: { type: String },
  userAgent: { type: String },
  timestamp: { type: Date, default: Date.now }
});

AuditLogSchema.index({ timestamp: -1 });
AuditLogSchema.index({ clientId: 1 });
AuditLogSchema.index({ action: 1 });
AuditLogSchema.index({ entity: 1 });
AuditLogSchema.index({ rollbacked: 1 });

module.exports = mongoose.model('AuditLog', AuditLogSchema);