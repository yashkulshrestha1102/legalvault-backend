const express = require('express');
const router = express.Router();
const { body, validationResult } = require('express-validator');
const { 
  register, 
  login, 
  logout, 
  forgotPassword, 
  resetPassword 
} = require('../controllers/authController');

// ✅ Validation Rules
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

// ✅ Handle Validation Errors
const handleValidation = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }
  next();
};


// ✅ Logout - Clear HTTP-only cookie
exports.logout = async (req, res) => {
  try {
    res.clearCookie('token', {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      path: '/',
    });
    
    console.log('✅ Logout successful');
    res.json({ message: 'Logged out successfully' });
  } catch (error) {
    console.error('❌ Logout error:', error);
    res.status(500).json({ message: 'Logout failed' });
  }
};
// ✅ Public Routes
router.post('/register', validateRegister, handleValidation, register);
router.post('/login', validateLogin, handleValidation, login);
router.post('/forgot-password', validateForgotPassword, handleValidation, forgotPassword);
router.post('/reset-password', validateResetPassword, handleValidation, resetPassword);
router.post('/logout', logout);

module.exports = router;