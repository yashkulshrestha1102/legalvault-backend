const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
const multer = require('multer');
const auditLog = require('../middleware/audit');

const {
  uploadFiles,
  getFilesByFolder,
  searchFiles,
  streamFile,
  renameFile,
  deleteFile,
  downloadFolderZip,
  uploadFolder  // ✅ This must exist
} = require('../controllers/customFileController');
const { isAllowedMimeType } = require('../utils/fileTypeDetector');

// ✅ DEBUG: Confirm route file loading
console.log('✅ customFileRoutes.js loaded');
console.log('   uploadFolder:', typeof uploadFolder);
console.log('   uploadFiles:', typeof uploadFiles);

// Multer memory storage
const storage = multer.memoryStorage();
const upload = multer({
  storage,
  limits: { 
    fileSize: 100 * 1024 * 1024,
    files: 500,
    fieldSize: 10 * 1024 * 1024,
  },
  fileFilter: (req, file, cb) => {
    if (!isAllowedMimeType(file.mimetype)) {
      return cb(new Error(`File type not allowed: ${file.mimetype}`), false);
    }
    cb(null, true);
  }
});

// ✅ Multer error handler
const handleMulterError = (err, req, res, next) => {
  if (err) {
    console.error('❌ Multer error:', err.message, '| Code:', err.code);
    return res.status(400).json({ 
      message: err.message,
      code: err.code 
    });
  }
  next();
};

router.use(auth);

// ✅ Specific routes FIRST
router.post('/upload', upload.array('files', 50), handleMulterError, uploadFiles);

// ✅ NEW: Folder upload with debug log
router.post(
  '/upload-folder',
  (req, res, next) => {
    console.log('═══════════════════════════════');
    console.log('📥 Route /upload-folder HIT');
    console.log('   Content-Type:', req.headers['content-type']);
    console.log('   Content-Length:', req.headers['content-length']);
    console.log('═══════════════════════════════');
    next();
  },
  upload.array('files', 500),
  handleMulterError,
  uploadFolder
);

router.get('/folder/:folderId', getFilesByFolder);
router.get('/search/:clientId', searchFiles);
router.get('/download-folder/:folderId', downloadFolderZip);
router.get('/file/:fileId', streamFile);
router.put('/:id/rename',auditLog, renameFile);
router.delete('/:id',auditLog, deleteFile);

console.log('✅ customFileRoutes.js routes registered:');
console.log('   POST /upload');
console.log('   POST /upload-folder');
console.log('   GET /folder/:folderId');
console.log('   GET /search/:clientId');
console.log('   GET /download-folder/:folderId');
console.log('   GET /file/:fileId');
console.log('   PUT /:id/rename');
console.log('   DELETE /:id');

module.exports = router;