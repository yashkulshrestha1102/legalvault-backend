const jwt = require('jsonwebtoken');

module.exports = (req, res, next) => {
  try {
    // ✅ Development-only logging (NO token leak)
    if (process.env.NODE_ENV !== 'production') {
      console.log('🔍 Auth:', req.method, req.originalUrl);
      console.log('🔍 Token present:', req.cookies?.token ? '✅' : '❌');
    }

    // ✅ Check cookie first, then fallback
    const token = req.cookies?.token
      || req.header('Authorization')?.replace('Bearer ', '')
      || req.query?.token;

    if (!token) {
      return res.status(401).json({ message: 'Access Denied. No token provided.' });
    }

    const secret = process.env.JWT_SECRET;
    if (!secret) {
      return res.status(500).json({ message: 'Server configuration error' });
    }

    const decoded = jwt.verify(token, secret);
    req.user = decoded;
    next();
  } catch (error) {
    console.error('❌ Auth error:', error.message);
    return res.status(401).json({ message: 'Invalid or expired token.' });
  }
};