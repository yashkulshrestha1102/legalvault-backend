const express = require('express');
const router = express.Router();
const { body, validationResult } = require('express-validator');
const { 
  register, 
  login, 
  logout, 
  forgotPassword, 
  resetPassword,
  getMe,                          // ✅ ADDED
} = require('../controllers/authController');

const auth = require('../middleware/auth');   // ✅ ADDED

// ═══════════════════════════════════════════
// ✅ Validation Rules
// ═══════════════════════════════════════════
const validateRegister = [
  body('name').notEmpty().withMessage('Name is required'),
  body('email').isEmail().withMessage('Valid email is required'),
  body('password').isLength({ min: 6 }).withMessage('Password must be at least 6 characters')
];

const validateLogin = [
  body('email').isEmail().withMessage('Valid email is required'),
  body('password').notEmpty().withMessage('Password is required')
];

const validateForgotPassword = [
  body('email').isEmail().withMessage('Valid email is required')
];

const validateResetPassword = [
  body('token').notEmpty().withMessage('Token is required'),
  body('newPassword').isLength({ min: 6 }).withMessage('Password must be at least 6 characters')
];

// ═══════════════════════════════════════════
// ✅ Handle Validation Errors
// ═══════════════════════════════════════════
const handleValidation = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }
  next();
};

// ═══════════════════════════════════════════
// ✅ Public Routes
// ═══════════════════════════════════════════
router.post('/register', validateRegister, handleValidation, register);
router.post('/login', validateLogin, handleValidation, login);
router.post('/forgot-password', validateForgotPassword, handleValidation, forgotPassword);
router.post('/reset-password', validateResetPassword, handleValidation, resetPassword);
router.post('/logout', logout);

// ═══════════════════════════════════════════
// ✅ Protected Routes (require auth)
// ═══════════════════════════════════════════
router.get('/me', auth, getMe); 

module.exports = router;