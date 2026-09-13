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

app.use((req, res, next) => {
  const allowedOrigins = [
    'http://localhost:5173',
    'http://localhost:5174',
    'https://legalvault-frontend-two.vercel.app',
    'https://legalvault-ochre.vercel.app',
    'https://legalvault.businezexcellence.com',
    'https://legalvault-jm2n.onrender.com',
    'legalvault-backend.onrender.com'
  ];
  
  const origin = req.headers.origin;



  
  // ✅ Only set if origin is in whitelist
  if (origin && allowedOrigins.includes(origin)) {
    res.setHeader('Access-Control-Allow-Origin', origin);
    res.setHeader('Vary', 'Origin'); // ✅ Cache busting for CDN
  } else if (!origin) {
    // ✅ No origin (like Postman, mobile apps) - allow
    res.setHeader('Access-Control-Allow-Origin', allowedOrigins[0]);
  }
  // ❌ Otherwise: NO CORS header → browser blocks
  
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, PATCH, OPTIONS');
  res.setHeader(
    'Access-Control-Allow-Headers', 
    'Origin, X-Requested-With, Content-Type, Accept, Authorization'
  );
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  res.setHeader('Access-Control-Max-Age', '86400'); // ✅ Cache preflight 24h
  
  if (req.method === 'OPTIONS') {
    return res.sendStatus(204); // ✅ 204 No Content better than 200
  }
  
  next();
});

// ✅ Force security headers
app.use((req, res, next) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('X-XSS-Protection', '1; mode=block');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains; preload');
  res.removeHeader('X-Powered-By');
  next();
});

// ✅ Security - Helmet
app.use(helmet({
  crossOriginEmbedderPolicy: false,
  crossOriginOpenerPolicy: false,
  crossOriginResourcePolicy: { policy: "cross-origin" },
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

// ✅ Compression
app.use(compression({
  level: 6,
  threshold: 1024,
  filter: (req, res) => {
    if (req.headers['x-no-compression']) {
      return false;
    }
    return compression.filter(req, res);
  }
}));

// ✅ Rate Limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100,
  message: 'Too many requests from this IP, please try again later.',
  standardHeaders: true,
  legacyHeaders: false,
  skip: (req) => {
    return false;
  }
});
app.use('/api/', limiter);

// ✅ Body Parser
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// ✅ cookie-parser -
app.use(cookieParser());


// ✅ Cache Headers
app.use('/api/clients', (req, res, next) => {
  if (req.method === 'GET') {
    res.set('Cache-Control', 'public, max-age=60');
  }
  next();
});

// ✅ Audit Log Middleware
app.use(auditLog);

// ✅ Connect to MongoDB first
connectDB().then(() => {
  console.log('✅ MongoDB Connected, initializing GridFS...');
  
  // ✅ GridFS synchronous call (No .catch() needed)
  try {
    initGridFS();
  } catch (err) {
    console.error('❌ GridFS initialization failed:', err.message);
  }
}).catch((err) => {
  console.error('❌ MongoDB connection failed:', err);
  process.exit(1);
});

// ✅ ✅ ✅ Routes - FIXED (no duplicate)
app.use('/api/auth', require('./routes/authRoutes'));
app.use('/api/clients', require('./routes/clientRoutes'));
app.use('/api/dashboard', require('./routes/dashboardRoutes'));
app.use('/api/users', require('./routes/userRoutes'));
app.use('/api/registrations', require('./routes/registrationRoutes'));
app.use('/api/contracts', require('./routes/contractRoutes'));
app.use('/api/pdfs', require('./routes/uploadGridFSRoutes'));
app.use('/api/audit', require('./routes/auditRoutes'));
app.use('/api/documents', require('./routes/documentRoutes')); // ✅ ONLY ONCE
app.use('/api/policies', require('./routes/policyRoutes'));
app.use('/api/gst', require('./routes/gstRoutes'));
app.use('/api/income-tax', require('./routes/incomeTaxRoutes'));
app.use('/api/hr', require('./routes/hrRoutes'));
app.use('/api/corporate-secretariat', require('./routes/corporateSecretariatRoutes'));
app.use('/api/financials', require('./routes/financialRoutes'));

// ✅ Health Check
app.get('/health', (req, res) => {
  res.status(200).json({ 
    status: 'OK', 
    timestamp: new Date(),
    environment: process.env.NODE_ENV || 'development'
  });
});

// ✅ Root
app.get('/', (req, res) => {
  res.send('LegalVault API is running');
});

// ✅ 404 Handler
app.use((req, res) => {
  res.status(404).json({ message: 'Route not found' });
});

// ✅ Global Error Handler
app.use((err, req, res, next) => {
  console.error('❌ Error:', {
    message: err.message,
    stack: err.stack,
    status: err.status || 500,
    path: req.path,
    method: req.method,
    ip: req.ip
  });

  const isDevelopment = process.env.NODE_ENV === 'development';
  
  res.status(err.status || 500).json({
    message: err.message || 'Something went wrong!',
    ...(isDevelopment && { 
      error: err,
      stack: err.stack 
    })
  });
});

const PORT = process.env.PORT || 5000;
const server = app.listen(PORT, () => {
  console.log(`✅ Server running on port ${PORT}`);
  console.log(`🔧 Environment: ${process.env.NODE_ENV || 'development'}`);
  console.log(`🛡️  Security Headers: Enabled (Manual)`);
  console.log(`🚦 Rate Limiting: 100 requests per 15 minutes`);
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