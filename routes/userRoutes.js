const express = require('express');
const router = express.Router();
const { body, validationResult } = require('express-validator');
const auth = require('../middleware/auth');
const admin = require('../middleware/admin');
const User = require('../models/User');
const bcrypt = require('bcryptjs');
const { sendUserWelcomeEmail } = require('../utils/email');
const mongoose = require('mongoose');
const auditLog = require('../middleware/audit');

console.log('✅ userRoutes.js loaded - Production Fix');

const ALLOWED_FOLDERS = [
  'registrations', 'contracts', 'policies', 'corporate-secretariat',
  'hr', 'gst', 'income-tax', 'financials',
  'documents', 'client-folder'
];

const validateUser = [
  body('name').notEmpty().withMessage('Name is required'),
  body('email').isEmail().withMessage('Valid email is required'),
  body('password')
    .if((value, { req }) => req.method === 'POST')
    .isLength({ min: 6 }).withMessage('Password must be at least 6 characters'),
  body('role')
    .optional()
    .custom((value) => {
      if (!value) return true;
      const allowedRoles = ['admin', 'lawyer', 'consultant', 'manager', 'user'];
      return allowedRoles.includes(value.toLowerCase());
    })
    .withMessage('Invalid role'),
  body('status').optional().isIn(['Active', 'Inactive']).withMessage('Invalid status'),
  body('folderPermissions')
    .optional()
    .customSanitizer(value => {
      if (!value) return [];
      if (!Array.isArray(value)) return [value];
      return value;
    })
];

const handleValidation = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    console.log('❌ Validation errors:', JSON.stringify(errors.array(), null, 2));
    return res.status(400).json({ errors: errors.array() });
  }
  next();
};

// GET - All users (Admin only) — exclude deleted
router.get('/', [auth, admin], async (req, res) => {
  try {
    const users = await User.find({ isDeleted: false }).select('-password');
    res.json(users);
  } catch (error) {
    console.error('❌ GET users error:', error);
    res.status(500).json({ message: error.message });
  }
});

// ✅ POST - Create user (Admin only) — FIXED: revive deleted user
router.post('/', [auth, admin, auditLog], validateUser, handleValidation, async (req, res) => {
  try {
    console.log('📥 POST /api/users - Request body:', JSON.stringify(req.body, null, 2));

    const { name, email, password, department, role, status, phone, folderPermissions } = req.body;
    
    if (!password) {
      return res.status(400).json({ message: 'Password is required' });
    }
    if (password.length < 6) {
      return res.status(400).json({ message: 'Password must be at least 6 characters' });
    }

    const normalizedEmail = email.toLowerCase().trim();

    // ✅ STEP 1: Check ACTIVE user with same email
    const activeUser = await User.findOne({ 
      email: normalizedEmail, 
      isDeleted: false 
    });
    if (activeUser) {
      console.log('❌ Active user already exists:', normalizedEmail);
      return res.status(400).json({ message: 'User with this email already exists' });
    }

    // ✅ STEP 2: Check if a DELETED user exists with same email
    const deletedUser = await User.findOne({ 
      email: normalizedEmail, 
      isDeleted: true 
    });

    // ✅ Validate folder permissions
    let validPermissions = [];
    if (folderPermissions && Array.isArray(folderPermissions)) {
      validPermissions = folderPermissions
        .filter(f => typeof f === 'string')
        .filter(f => ALLOWED_FOLDERS.includes(f));
    }

    const normalizedRole = role ? role.toLowerCase() : 'user';

    // ✅ Hash password
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);

    let user;

    if (deletedUser) {
      // ✅ REVIVE deleted user — naya document nahi banao
      console.log('♻️ Reviving deleted user:', normalizedEmail);
      deletedUser.name = name;
      deletedUser.password = hashedPassword;
      deletedUser.department = department || 'General';
      deletedUser.role = normalizedRole;
      deletedUser.status = status || 'Active';
      deletedUser.phone = phone || '';
      deletedUser.folderPermissions = validPermissions;
      deletedUser.isDeleted = false;
      await deletedUser.save();
      user = deletedUser;
      console.log('✅ Deleted user revived:', user.email);
    } else {
      // ✅ CREATE new user
      user = new User({
        name,
        email: normalizedEmail,
        password: hashedPassword,
        department: department || 'General',
        role: normalizedRole,
        status: status || 'Active',
        phone: phone || '',
        folderPermissions: validPermissions
      });
      await user.save();
      console.log('✅ New user created:', user.email);
    }

    // ✅ Send welcome email (non-blocking)
    try {
      await sendUserWelcomeEmail(normalizedEmail, name, password);
      console.log('✅ Welcome email sent to:', normalizedEmail);
    } catch (emailError) {
      console.error('❌ Failed to send welcome email:', emailError.message);
    }

    const userResponse = user.toObject();
    delete userResponse.password;
    
    res.status(201).json({ 
      message: deletedUser 
        ? 'User re-activated successfully' 
        : 'User created successfully', 
      user: userResponse 
    });
  } catch (error) {
    console.error('❌ POST error:', error);
    
    // ✅ Handle MongoDB duplicate key error gracefully
    if (error.code === 11000) {
      return res.status(400).json({ 
        message: 'Email already exists. Please try a different email or delete the existing user first.' 
      });
    }
    
    res.status(500).json({ message: error.message });
  }
});

// ✅ PUT - Update user (unchanged mostly)
router.put('/:id', auth, auditLog, validateUser, handleValidation, async (req, res) => {
  try {
    const { name, email, department, role, status, phone, folderPermissions, password } = req.body;
    
    const existingUser = await User.findById(req.params.id);
    if (!existingUser) {
      return res.status(404).json({ message: 'User not found' });
    }

    if (req.user.id !== req.params.id && req.user.role !== 'admin') {
      return res.status(403).json({ message: 'You can only update your own profile' });
    }

    const updateData = {
      name: name || existingUser.name,
      department: department || existingUser.department || 'General',
      phone: phone || existingUser.phone || '',
      status: status || existingUser.status || 'Active'
    };

    if (req.user.role === 'admin') {
      if (role) updateData.role = role.toLowerCase();
      if (email) {
        // ✅ Check if new email is already used by another ACTIVE user
        const emailTaken = await User.findOne({
          email: email.toLowerCase().trim(),
          isDeleted: false,
          _id: { $ne: req.params.id }
        });
        if (emailTaken) {
          return res.status(400).json({ message: 'Email already used by another user' });
        }
        updateData.email = email.toLowerCase().trim();
      }
      if (folderPermissions) {
        updateData.folderPermissions = folderPermissions
          .filter(f => typeof f === 'string')
          .filter(f => ALLOWED_FOLDERS.includes(f));
      }
    }

    if (password) {
      if (password.length < 6) {
        return res.status(400).json({ message: 'Password must be at least 6 characters' });
      }
      const salt = await bcrypt.genSalt(10);
      updateData.password = await bcrypt.hash(password, salt);
    }

    const updatedUser = await User.findByIdAndUpdate(
      req.params.id,
      updateData,
      { new: true, runValidators: true }
    ).select('-password');
    
    res.json(updatedUser);
  } catch (error) {
    console.error('❌ PUT error:', error);
    if (error.code === 11000) {
      return res.status(400).json({ message: 'Email already exists' });
    }
    res.status(500).json({ message: error.message });
  }
});

// ✅ DELETE - Soft delete (admin only) — taaki email dobara use ho sake
router.delete('/:id', [auth, admin, auditLog], async (req, res) => {
  try {
    const { id } = req.params;
    
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ message: 'Invalid user ID format' });
    }
    
    const user = await User.findById(id);
    if (!user || user.isDeleted) {
      return res.status(404).json({ message: 'User not found' });
    }

    const adminCount = await User.countDocuments({ role: 'admin', isDeleted: false });
    if (user.role === 'admin' && adminCount <= 1) {
      return res.status(400).json({ message: 'Cannot delete the last admin user' });
    }

    // ✅ SOFT DELETE — email ko free kar do future use ke liye
    user.isDeleted = true;
    await user.save();

    res.json({ message: 'User deleted successfully' });
  } catch (error) {
    console.error('❌ DELETE error:', error);
    res.status(500).json({ message: error.message });
  }
});

// GET - All users for dropdown
router.get('/dropdown/all', auth, async (req, res) => {
  try {
    const users = await User.find({ isDeleted: false }).select('name email role _id');
    res.json(users);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

module.exports = router;