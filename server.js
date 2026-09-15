const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '.env') });

const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const compression = require('compression');
const morgan = require('morgan');
const connectDB = require('./config/db');
const { initGridFS } = require('./config/gridfs');
const auditLog = require('./middleware/audit');
const cookieParser = require('cookie-parser');

const app = express();

// ✅ Environment Variable Validation
const requiredEnv = ['MONGO_URI', 'JWT_SECRET'];
requiredEnv.forEach(key => {
  if (!process.env[key]) {
    console.error(`❌ Missing environment variable: ${key}`);
    process.exit(1);
  }
});
console.log('✅ All environment variables are set');

// ═══════════════════════════════════════════
// 1️⃣ CORS — Sabse pehla layer
// ═══════════════════════════════════════════
app.use((req, res, next) => {
  const allowedOrigins = [
    'http://localhost:5173',
    'http://localhost:5174',
    'http://localhost:3000',
    'https://legalvault-frontend-two.vercel.app',
    'https://legalvault-ochre.vercel.app',
    'https://legalvault.businezexcellence.com',
    'https://legalvault-jm2n.onrender.com',
    'legalvault-backend.onrender.com'
  ];
  
  const origin = req.headers.origin;

  if (origin && allowedOrigins.includes(origin)) {
    res.setHeader('Access-Control-Allow-Origin', origin);
    res.setHeader('Vary', 'Origin');
  } else if (!origin) {
    res.setHeader('Access-Control-Allow-Origin', allowedOrigins[0]);
  }
  
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, PATCH, OPTIONS');
  res.setHeader(
    'Access-Control-Allow-Headers', 
    'Origin, X-Requested-With, Content-Type, Accept, Authorization'
  );
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  res.setHeader('Access-Control-Max-Age', '86400');
  
  if (req.method === 'OPTIONS') {
    return res.sendStatus(204);
  }
  
  next();
});

// ═══════════════════════════════════════════
// 2️⃣ Security Headers
// ═══════════════════════════════════════════
app.use((req, res, next) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('X-XSS-Protection', '1; mode=block');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  res.removeHeader('X-Powered-By');
  next();
});

// ✅ Helmet — after custom headers
app.use(helmet({
  crossOriginEmbedderPolicy: false,
  crossOriginOpenerPolicy: false,
  crossOriginResourcePolicy: { policy: "cross-origin" },
  contentSecurityPolicy: false,   // ✅ ADDED: Disable CSP (was causing issues sometimes)
  dnsPrefetchControl: true,
  frameguard: false,
  hidePoweredBy: true,
  hsts: false,
  ieNoOpen: true,
  noSniff: false,
  referrerPolicy: false,
  xssFilter: false
}));

// ✅ Trust Proxy
app.set('trust proxy', 1);

// ✅ Morgan
app.use(morgan(process.env.NODE_ENV === 'production' ? 'combined' : 'dev'));

// ═══════════════════════════════════════════
// 3️⃣ Body Parsers — Ye pehle aane chahiye (compression ke baad)
// ═══════════════════════════════════════════
// ✅ Increase limits to 50mb for JSON/urlencoded
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// ✅ cookie-parser — BEFORE any auth middleware
app.use(cookieParser());

// ═══════════════════════════════════════════
// 4️⃣ Rate Limiting
// ═══════════════════════════════════════════
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 500,                             // ✅ Increased from 100 → 500
  message: 'Too many requests from this IP, please try again later.',
  standardHeaders: true,
  legacyHeaders: false,
  // ✅ Skip rate limit for upload endpoints (they're heavy)
  skip: (req) => {
    if (req.path.includes('upload')) return true;
    return false;
  }
});
app.use('/api/', limiter);

// ═══════════════════════════════════════════
// 5️⃣ Compression (AFTER body parsers, BEFORE routes)
// ═══════════════════════════════════════════
app.use(compression({
  level: 6,
  threshold: 1024,
  // ✅ Don't compress uploads (multipart already heavy)
  filter: (req, res) => {
    if (req.headers['x-no-compression']) return false;
    if (req.path.includes('upload')) return false;   // ✅ ADDED
    return compression.filter(req, res);
  }
}));

// ═══════════════════════════════════════════
// 6️⃣ DEBUG Logger — AFTER body parsers
// ═══════════════════════════════════════════
app.use((req, res, next) => {
  if (req.path.includes('upload')) {
    console.log('═══════════════════════════════');
    console.log('📥 Incoming:', req.method, req.path);
    console.log('   Content-Type:', req.headers['content-type']);
    console.log('   Content-Length:', req.headers['content-length'], 'bytes');
    console.log('   Origin:', req.headers['origin']);
    console.log('   User-Agent:', req.headers['user-agent']?.slice(0, 50));
    console.log('═══════════════════════════════');
  }
  next();
});

// ═══════════════════════════════════════════
// 7️⃣ Cache Headers
// ═══════════════════════════════════════════
app.use('/api/clients', (req, res, next) => {
  if (req.method === 'GET') {
    res.set('Cache-Control', 'public, max-age=60');
  }
  next();
});

// ═══════════════════════════════════════════
// 8️⃣ Connect to MongoDB (BEFORE audit log & routes)
// ═══════════════════════════════════════════
connectDB().then(() => {
  console.log('✅ MongoDB Connected, initializing GridFS...');
  try {
    initGridFS();
  } catch (err) {
    console.error('❌ GridFS initialization failed:', err.message);
  }
}).catch((err) => {
  console.error('❌ MongoDB connection failed:', err);
  process.exit(1);
});

// ═══════════════════════════════════════════
// 9️⃣ Audit Log Middleware — Only for specific routes
// ═══════════════════════════════════════════
// ❌ REMOVED: app.use(auditLog);  // was global
// ✅ Instead, apply selectively inside routes (see below)
// Or keep global but skip uploads:

app.use((req, res, next) => {
  // ✅ Skip audit log for upload endpoints (they break res.send)
  if (req.path.includes('upload')) {
    return next();
  }
  return auditLog(req, res, next);
});

// ═══════════════════════════════════════════
// 🔟 Routes
// ═══════════════════════════════════════════
app.use('/api/auth', require('./routes/authRoutes'));
console.log('   ✅ /api/auth');

app.use('/api/clients', require('./routes/clientRoutes'));
console.log('   ✅ /api/clients');

app.use('/api/dashboard', require('./routes/dashboardRoutes'));
console.log('   ✅ /api/dashboard');

app.use('/api/users', require('./routes/userRoutes'));
console.log('   ✅ /api/users');

app.use('/api/registrations', require('./routes/registrationRoutes'));
console.log('   ✅ /api/registrations');

app.use('/api/contracts', require('./routes/contractRoutes'));
console.log('   ✅ /api/contracts');

app.use('/api/pdfs', require('./routes/uploadGridFSRoutes'));
console.log('   ✅ /api/pdfs');

app.use('/api/audit', require('./routes/auditRoutes'));
console.log('   ✅ /api/audit');

app.use('/api/documents', require('./routes/documentRoutes'));
console.log('   ✅ /api/documents');

app.use('/api/policies', require('./routes/policyRoutes'));
console.log('   ✅ /api/policies');

app.use('/api/gst', require('./routes/gstRoutes'));
console.log('   ✅ /api/gst');

app.use('/api/income-tax', require('./routes/incomeTaxRoutes'));
console.log('   ✅ /api/income-tax');

app.use('/api/hr', require('./routes/hrRoutes'));
console.log('   ✅ /api/hr');

app.use('/api/corporate-secretariat', require('./routes/corporateSecretariatRoutes'));
console.log('   ✅ /api/corporate-secretariat');

app.use('/api/financials', require('./routes/financialRoutes'));
console.log('   ✅ /api/financials');

app.use('/api/custom-folders', require('./routes/customFolderRoutes'));
console.log('   ✅ /api/custom-folders');

app.use('/api/custom-files', require('./routes/customFileRoutes'));
console.log('   ✅ /api/custom-files');


console.log('═══════════════════════════════════════');


// ═══════════════════════════════════════════
// 1️⃣1️⃣ Health & Root
// ═══════════════════════════════════════════
app.get('/health', (req, res) => {
  res.status(200).json({ 
    status: 'OK', 
    timestamp: new Date(),
    environment: process.env.NODE_ENV || 'development'
  });
});

app.get('/', (req, res) => {
  res.send('LegalVault API is running');
});

// ═══════════════════════════════════════════
// 1️⃣2️⃣ 404 Handler
// ═══════════════════════════════════════════
app.use((req, res) => {
  res.status(404).json({ message: 'Route not found' });
});

// ═══════════════════════════════════════════
// 1️⃣3️⃣ Global Error Handler
// ═══════════════════════════════════════════
app.use((err, req, res, next) => {
  console.error('❌ Error:', {
    message: err.message,
    name: err.name,
    code: err.code,
    stack: err.stack?.split('\n').slice(0, 3).join('\n'), // ✅ Shorter stack
    status: err.status || 500,
    path: req.path,
    method: req.method,
    ip: req.ip
  });

  // ✅ Multer-specific errors
  if (err.name === 'MulterError') {
    if (err.code === 'LIMIT_FILE_SIZE') {
      return res.status(413).json({ 
        message: 'File too large. Max 100MB per file.' 
      });
    }
    if (err.code === 'LIMIT_FILE_COUNT') {
      return res.status(413).json({ 
        message: 'Too many files. Max 500 per upload.' 
      });
    }
    if (err.code === 'LIMIT_UNEXPECTED_FILE') {
      return res.status(400).json({ 
        message: `Unexpected field: ${err.field}` 
      });
    }
    return res.status(400).json({ message: err.message });
  }

  const isDevelopment = process.env.NODE_ENV === 'development';
  
  res.status(err.status || 500).json({
    message: err.message || 'Something went wrong!',
    ...(isDevelopment && { 
      error: err.message,
      stack: err.stack 
    })
  });
});

// ═══════════════════════════════════════════
// 1️⃣4️⃣ Server Listen
// ═══════════════════════════════════════════
const PORT = process.env.PORT || 5000;
const server = app.listen(PORT, () => {
  console.log(`✅ Server running on port ${PORT}`);
  console.log(`🔧 Environment: ${process.env.NODE_ENV || 'development'}`);
  console.log(`🛡️  Security Headers: Enabled`);
  console.log(`🚦 Rate Limiting: 500 requests per 15 min (uploads skipped)`);
});

// ✅ Graceful Shutdown
process.on('SIGTERM', () => {
  console.log('SIGTERM received, closing server...');
  server.close(() => {
    console.log('Server closed');
    process.exit(0);
  });
});

process.on('SIGINT', () => {
  console.log('SIGINT received, closing server...');
  server.close(() => {
    console.log('Server closed');
    process.exit(0);
  });
});