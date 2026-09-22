const User = require('../models/User');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');

// ✅ CORRECT IMPORT - Check karo ki path sahi hai
const { sendPasswordResetEmail } = require('../utils/email');

// ✅ Helper: Validate email format
const isValidEmail = (email) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);

// ✅ Helper: Sanitize input
const sanitizeString = (str) => str?.trim() || '';

// ✅ Helper: Cookie options (cross-domain safe)
const getCookieOptions = () => {
  const isProduction = process.env.NODE_ENV === 'production';
  return {
    httpOnly: true,
    secure: isProduction,                          // HTTPS pe true (Render)
    sameSite: isProduction ? 'none' : 'lax',       // ✅ cross-domain ke liye 'none'
    maxAge: 7 * 24 * 60 * 60 * 1000,               // 7 days
    path: '/',
  };
};

// ✅ Register
exports.register = async (req, res) => {
  try {
    const { name, email, password, role } = req.body;

    console.log('📝 Register attempt:', { name, email, role });

    if (!name || !email || !password) {
      return res.status(400).json({ message: 'Name, email, and password are required' });
    }

    if (!isValidEmail(email)) {
      return res.status(400).json({ message: 'Please enter a valid email address' });
    }

    if (password.length < 6) {
      return res.status(400).json({ message: 'Password must be at least 6 characters' });
    }

    const sanitizedName = sanitizeString(name);
    const sanitizedEmail = sanitizeString(email).toLowerCase();

    const existingUser = await User.findOne({ email: sanitizedEmail });
    if (existingUser) {
      console.log('❌ User already exists:', sanitizedEmail);
      return res.status(400).json({ message: 'User already exists' });
    }

    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);

    const user = new User({
      name: sanitizedName,
      email: sanitizedEmail,
      password: hashedPassword,
      role: role || 'user'
    });
    await user.save();

    console.log('✅ User registered successfully:', sanitizedEmail);
    res.status(201).json({ message: 'User registered successfully' });
  } catch (error) {
    console.error('❌ Register error:', error);
    res.status(500).json({ message: error.message });
  }
};

// ✅ Login - FULLY FIXED for cross-domain cookies
exports.login = async (req, res) => {
  try {
    const { email, password } = req.body;

    console.log('🔐 Login attempt:', { email });

    // ✅ Validation
    if (!email || !password) {
      return res.status(400).json({ message: 'Email and password are required' });
    }

    if (!isValidEmail(email)) {
      return res.status(400).json({ message: 'Please enter a valid email address' });
    }

    // ✅ Sanitize email
    const sanitizedEmail = sanitizeString(email).toLowerCase();

    // ✅ Find user
    const user = await User.findOne({ email: sanitizedEmail });
    console.log('👤 User found:', user ? 'Yes' : 'No');

    if (!user) {
      return res.status(400).json({ message: 'Invalid credentials' });
    }

    // ✅ Check password
    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      return res.status(400).json({ message: 'Invalid credentials' });
    }

    // ✅ Generate JWT
    const token = jwt.sign(
      { id: user._id, email: user.email, role: user.role, name: user.name, },
      process.env.JWT_SECRET,
      { expiresIn: '7d' }
    );

    console.log('✅ Login successful:', sanitizedEmail);

    // ✅ Set HTTP-only cookie (cross-domain safe)
    res.cookie('token', token, getCookieOptions());

    // ✅ Send user data (NO token in body)
    res.json({
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
        folderPermissions: user.folderPermissions || [],
      },
    });
  } catch (error) {
    console.error('❌ Login error:', error);
    res.status(500).json({ message: error.message });
  }
};

// ✅ Logout - Clear HTTP-only cookie
exports.logout = async (req, res) => {
  try {
    // ✅ Same options use karo warna cookie clear nahi hogi
    const { maxAge, ...clearOptions } = getCookieOptions();
    res.clearCookie('token', clearOptions);

    console.log('✅ Logout successful');
    res.json({ message: 'Logged out successfully' });
  } catch (error) {
    console.error('❌ Logout error:', error);
    res.status(500).json({ message: 'Logout failed' });
  }
};

// ✅ Forgot Password - COMPLETE WORKING
exports.forgotPassword = async (req, res) => {
  try {
    const { email } = req.body;
    console.log('🔑 Forgot password attempt:', { email });

    if (!email) {
      return res.status(400).json({ message: 'Email is required' });
    }

    if (!isValidEmail(email)) {
      return res.status(400).json({ message: 'Please enter a valid email address' });
    }

    const sanitizedEmail = sanitizeString(email).toLowerCase();

    const user = await User.findOne({ email: sanitizedEmail });
    if (!user) {
      console.log('❌ User not found:', sanitizedEmail);
      return res.status(404).json({ message: 'No account found with this email' });
    }

    // ✅ Generate reset token
    const resetToken = crypto.randomBytes(32).toString('hex');
    const resetTokenExpiry = Date.now() + 3600000; // 1 hour

    // ✅ Save token to database
    user.resetPasswordToken = resetToken;
    user.resetPasswordExpires = resetTokenExpiry;
    await user.save();

    console.log('✅ Reset token generated for:', sanitizedEmail);

    // ✅ Send email with reset link
    try {
      const result = await sendPasswordResetEmail(sanitizedEmail, resetToken);
      console.log('✅ Email send result:', result);

      res.json({
        message: 'Password reset link sent to your email address!'
      });
    } catch (emailError) {
      console.error('❌ Email send error:', emailError);
      // ✅ TOKEN DELETE KARO AGAR EMAIL FAIL HO
      user.resetPasswordToken = undefined;
      user.resetPasswordExpires = undefined;
      await user.save();

      res.status(500).json({
        message: 'Failed to send reset email. Please try again.'
      });
    }
  } catch (error) {
    console.error('❌ Forgot password error:', error);
    res.status(500).json({ message: 'Something went wrong. Please try again.' });
  }
};

// ✅ Reset Password
exports.resetPassword = async (req, res) => {
  try {
    const { token, newPassword } = req.body;
    console.log('🔑 Reset password attempt');

    if (!token || !newPassword) {
      return res.status(400).json({ message: 'Token and new password are required' });
    }

    if (newPassword.length < 6) {
      return res.status(400).json({ message: 'Password must be at least 6 characters' });
    }

    // ✅ Find user by token and check expiry
    const user = await User.findOne({
      resetPasswordToken: token,
      resetPasswordExpires: { $gt: Date.now() }
    });

    if (!user) {
      return res.status(400).json({ message: 'Invalid or expired reset token' });
    }

    // ✅ Hash new password
    const salt = await bcrypt.genSalt(10);
    user.password = await bcrypt.hash(newPassword, salt);

    // ✅ Clear reset tokens
    user.resetPasswordToken = undefined;
    user.resetPasswordExpires = undefined;
    await user.save();

    console.log('✅ Password reset successfully for:', user.email);
    res.json({ message: 'Password reset successfully! You can now login with your new password.' });
  } catch (error) {
    console.error('❌ Reset password error:', error);
    res.status(500).json({ message: 'Failed to reset password. Please try again.' });
  }
};



// ═══════════════════════════════════════════
// ✅ Get Current User — /api/auth/me
// Returns fresh user data from database
// ═══════════════════════════════════════════
exports.getMe = async (req, res) => {
  try {
    // ✅ req.user decoded JWT se aata hai (auth middleware set karta hai)
    if (!req.user?.id) {
      return res.status(401).json({ message: 'Not authenticated' });
    }

    // ✅ Fresh data from DB — not from JWT
    const user = await User.findById(req.user.id).select('-password');

    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    // ✅ Inactive user check — security
    if (user.status === 'Inactive') {
      return res.status(403).json({ 
        message: 'Account is inactive. Please contact administrator.' 
      });
    }

    // ✅ Same shape as login response (frontend compatibility)
    res.json({
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
        folderPermissions: user.folderPermissions || [],
        department: user.department || 'General',
        phone: user.phone || '',
        status: user.status || 'Active',
        createdAt: user.createdAt,
      },
    });

  } catch (error) {
    console.error('❌ GetMe error:', error);
    res.status(500).json({ message: 'Failed to fetch user data' });
  }
};