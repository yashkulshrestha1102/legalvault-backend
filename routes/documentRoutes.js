const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
const multer = require('multer');
const Document = require('../models/Document');
const { ObjectId } = require('mongodb');
const mongoose = require('mongoose');
const { getGridFS } = require('../config/gridfs');
const { uploadFilesSmart, deleteFileSmart } = require('../controllers/storageController');

// Multer memory storage (Buffer in RAM)
const storage = multer.memoryStorage();
const upload = multer({
  storage: storage,
  limits: { fileSize: 100 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    if (file.fieldname !== 'documents' && file.fieldname !== 'file') {
      return cb(new Error('Unexpected field: ' + file.fieldname));
    }
    const allowedTypes = [
      'image/jpeg', 'image/png', 'application/pdf',
      'application/msword',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'text/plain'
    ];
    if (allowedTypes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error(`File type not allowed: ${file.mimetype}`));
    }
  }
});

// =========================================================================
// UPLOAD - Smart (R2 or GridFS based on STORAGE_BACKEND env)
// =========================================================================
router.post('/upload', auth, upload.array('documents', 50), async (req, res) => {
  try {
    console.log('Files received:', req.files?.length || 0);

    if (!req.files || req.files.length === 0) {
      return res.status(400).json({ message: 'No files uploaded' });
    }

    const { clientId } = req.body;
    if (!clientId) {
      return res.status(400).json({ message: 'Client ID is required!' });
    }

    if (mongoose.connection.readyState !== 1) {
      console.error('MongoDB not connected!');
      return res.status(500).json({ message: 'Database connection not established' });
    }

    // Smart upload (R2 or GridFS)
    const uploadedFiles = await uploadFilesSmart(req.files, {
      folder: `clients/${clientId}/documents`,
      metadata: { uploadedBy: req.user.id, clientId },
      gridfsUrlPrefix: '/api/documents/file',
    });

    const savedDocs = [];

    for (const fileData of uploadedFiles) {
      // Ensure GridFS-style URL for gridfs storage
      let fileUrl = fileData.fileUrl;
      if (fileData.storageType === 'gridfs' && fileData.fileId) {
        fileUrl = `/api/documents/file/${fileData.fileId}`;
      }

      const doc = new Document({
        clientId: clientId,
        filename: fileData.filename,
        originalName: fileData.originalName,
        fileType: fileData.fileType,
        fileSize: fileData.fileSize,
        fileUrl: fileUrl,
        mimeType: fileData.mimeType,
        uploadedBy: req.user.id,
        storageType: fileData.storageType,
        r2Key: fileData.r2Key || null,
        fileId: fileData.fileId || null,
      });

      await doc.save();

      savedDocs.push({
        id: doc._id,
        url: fileUrl,
        fileId: doc.fileId,
        r2Key: doc.r2Key,
        storageType: doc.storageType,
        filename: doc.filename,
        size: doc.fileSize,
        mimeType: doc.mimeType,
      });
    }

    res.json({
      message: `${savedDocs.length} files uploaded successfully`,
      files: savedDocs,
    });

  } catch (error) {
    console.error('Upload error:', error);
    res.status(500).json({ message: error.message });
  }
});

// =========================================================================
// RENAME document
// =========================================================================
router.put('/:id/rename', auth, async (req, res) => {
  try {
    const { newName } = req.body;
    if (!newName || newName.trim() === '') {
      return res.status(400).json({ message: 'New name is required' });
    }

    const doc = await Document.findOneAndUpdate(
      { _id: req.params.id, isDeleted: false },
      { $set: { filename: newName.trim(), originalName: newName.trim() } },
      { new: true }
    );
    if (!doc) return res.status(404).json({ message: 'Document not found' });
    res.json({ message: 'Document renamed successfully', document: doc });
  } catch (error) {
    console.error('Rename error:', error);
    res.status(500).json({ message: error.message });
  }
});

// =========================================================================
// GET all documents for a client
// =========================================================================
router.get('/client/:clientId', auth, async (req, res) => {
  try {
    const documents = await Document.find({
      clientId: req.params.clientId,
      isDeleted: false,
    }).sort({ createdAt: -1 });
    res.json(documents);
  } catch (error) {
    console.error('Error fetching documents:', error);
    res.status(500).json({ message: error.message });
  }
});

// =========================================================================
// DELETE document (soft delete + storage cleanup)
// =========================================================================
router.delete('/:id', auth, async (req, res) => {
  try {
    const doc = await Document.findOneAndUpdate(
      { _id: req.params.id, isDeleted: false },
      { isDeleted: true },
      { new: true }
    );
    if (!doc) return res.status(404).json({ message: 'Document not found' });

    // Cleanup from storage (R2 or GridFS) - non-blocking
    deleteFileSmart(doc).catch((err) =>
      console.error('Storage cleanup failed:', err.message)
    );

    res.json({ message: 'Document deleted successfully' });
  } catch (error) {
    console.error('Delete error:', error);
    res.status(500).json({ message: error.message });
  }
});

// =========================================================================
// GET document by file ID (supports BOTH R2 and GridFS)
// =========================================================================
router.get('/file/:fileId', auth, async (req, res) => {
  try {
    const fileId = new ObjectId(req.params.fileId);
    const doc = await Document.findOne({ fileId, isDeleted: false });

    // Case 1: R2 file - redirect to public URL
    if (doc && doc.storageType === 'r2' && doc.r2Key) {
      return res.redirect(`${process.env.R2_PUBLIC_URL}/${doc.r2Key}`);
    }

    // Case 2: GridFS file - stream
    if (!doc) return res.status(404).json({ message: 'Document not found' });

    const bucket = getGridFS();
    if (!bucket) return res.status(500).json({ message: 'GridFS not available' });

    const downloadStream = bucket.openDownloadStream(fileId);

    downloadStream.on('file', (file) => {
      res.setHeader('Content-Type', file.contentType || doc.mimeType);
      res.setHeader('Content-Length', file.length);
      res.setHeader('Content-Disposition', `inline; filename="${doc.filename}"`);
    });

    downloadStream.on('error', (error) => {
      console.error('Download error:', error);
      if (!res.headersSent) {
        res.status(500).json({ message: 'Error downloading file' });
      }
    });

    downloadStream.pipe(res);
  } catch (error) {
    console.error('Document fetch error:', error);
    if (!res.headersSent) {
      res.status(500).json({ message: error.message });
    }
  }
});

// =========================================================================
// BACKWARD COMPAT: Old route (/:id) - keeps old URLs working
// =========================================================================
router.get('/:id', auth, async (req, res) => {
  try {
    const fileId = new ObjectId(req.params.id);
    const doc = await Document.findOne({ fileId, isDeleted: false });

    // Case 1: R2 file - redirect
    if (doc && doc.storageType === 'r2' && doc.r2Key) {
      return res.redirect(`${process.env.R2_PUBLIC_URL}/${doc.r2Key}`);
    }

    // Case 2: GridFS file - stream
    if (!doc) return res.status(404).json({ message: 'Document not found' });

    const bucket = getGridFS();
    if (!bucket) return res.status(500).json({ message: 'GridFS not available' });

    const downloadStream = bucket.openDownloadStream(fileId);

    downloadStream.on('file', (file) => {
      res.setHeader('Content-Type', file.contentType || doc.mimeType);
      res.setHeader('Content-Length', file.length);
      res.setHeader('Content-Disposition', `inline; filename="${doc.filename}"`);
    });

    downloadStream.on('error', (error) => {
      console.error('Download error:', error);
      if (!res.headersSent) {
        res.status(500).json({ message: 'Error downloading file' });
      }
    });

    downloadStream.pipe(res);
  } catch (error) {
    console.error('Document fetch error:', error);
    if (!res.headersSent) {
      res.status(500).json({ message: error.message });
    }
  }
});

module.exports = router;
