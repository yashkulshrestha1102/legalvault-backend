const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
const multer = require('multer');
const {
  uploadFiles,
  getFilesByFolder,
  searchFiles,
  streamFile,
  renameFile,
  deleteFile,
  downloadFolderZip
} = require('../controllers/customFileController');
const { isAllowedMimeType } = require('../utils/fileTypeDetector');

// Multer memory storage
const storage = multer.memoryStorage();
const upload = multer({
  storage,
  limits: { fileSize: 100 * 1024 * 1024 }, // 100 MB per file
  fileFilter: (req, file, cb) => {
    if (!isAllowedMimeType(file.mimetype)) {
      return cb(new Error(`File type not allowed: ${file.mimetype}`), false);
    }
    cb(null, true);
  }
});

router.use(auth);

// ✅ Specific routes FIRST (before /:id)
router.post('/upload', upload.array('files', 50), uploadFiles);
router.get('/folder/:folderId', getFilesByFolder);
router.get('/search/:clientId', searchFiles);
router.get('/download-folder/:folderId', downloadFolderZip);
router.get('/file/:fileId', streamFile);
router.put('/:id/rename', renameFile);
router.delete('/:id', deleteFile);

module.exports = router;