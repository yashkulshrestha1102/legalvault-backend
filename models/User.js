const mongoose = require('mongoose');

const UserSchema = new mongoose.Schema({
  name: { type: String, required: true },
  // ✅ unique hata diya yahan se
  email: { type: String, required: true },
  password: { type: String, required: true },
  role: { type: String, default: 'user' },
  department: { type: String, default: 'General' },
  phone: { type: String, default: '' },
  status: { 
    type: String, 
    enum: ['Active', 'Inactive'], 
    default: 'Active' 
  },
  folderPermissions: {
    type: [String],
    default: []
  },
  resetPasswordToken: { type: String },
  resetPasswordExpires: { type: Date },
  isDeleted: { type: Boolean, default: false },
  createdAt: { type: Date, default: Date.now }
});

// ✅ Partial unique index — sirf active users ke liye
// isDeleted: true wale users ka email dobara use ho sakta hai
UserSchema.index(
  { email: 1 },
  { 
    unique: true, 
    partialFilterExpression: { isDeleted: false },
    name: 'email_active_unique'
  }
);

// ✅ Baaki indexes
UserSchema.index({ role: 1 });
UserSchema.index({ status: 1 });
UserSchema.index({ isDeleted: 1 });

module.exports = mongoose.model('User', UserSchema);