const jwt = require('jsonwebtoken');

module.exports = (req, res, next) => {
  try {
    // 🔍 DEBUG LOGS
    console.log('🔍 ===== AUTH MIDDLEWARE =====');
    console.log('🔍 URL:', req.method, req.originalUrl);
    console.log('🔍 Cookies:', req.cookies);
    console.log('🔍 req.cookies.token:', req.cookies?.token ? '✅ Present' : '❌ Missing');
    console.log('🔍 Auth Header:', req.header('Authorization') ? '✅ Present' : '❌ Missing');
    console.log('🔍 ============================');

    // ✅ Check cookie first, then fallback
    const token = req.cookies?.token 
      || req.header('Authorization')?.replace('Bearer ', '')
      || req.query?.token;
    
    if (!token) {
      console.log('❌ NO TOKEN FOUND - Returning 401');
      return res.status(401).json({ message: 'Access Denied. No token provided.' });
    }
    
    console.log('✅ Token found, verifying...');
    
    const secret = process.env.JWT_SECRET;
    if (!secret) {
      return res.status(500).json({ message: 'Server configuration error' });
    }
    
    const decoded = jwt.verify(token, secret);
    console.log('✅ Token verified for:', decoded.email);
    req.user = decoded;
    next();
  } catch (error) {
    console.log('❌ Token verification failed:', error.message);
    return res.status(401).json({ message: 'Invalid or expired token.' });
  }
};