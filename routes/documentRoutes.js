const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
const multer = require('multer');
const { getGridFS } = require('../config/gridfs');
const Document = require('../models/Document');
const { ObjectId } = require('mongodb');
const jwt = require('jsonwebtoken');
const mongoose = require('mongoose');

// ✅ Multer memory storage (Buffer mein rakhega, disk par nahi)
const storage = multer.memoryStorage();
const upload = multer({ 
  storage: storage,
  limits: { fileSize: 100 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    if (file.fieldname !== 'documents' && file.fieldname !== 'file') {
      return cb(new Error('Unexpected field: ' + file.fieldname));
    }
    const allowedTypes = ['image/jpeg', 'image/png', 'application/pdf', 'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', 'text/plain'];
    if (allowedTypes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error(`File type not allowed: ${file.mimetype}`));
    }
  }
});

// ✅ Upload - GridFS (Direct MongoDB Driver)
router.post('/upload', auth, upload.array('documents', 50), async (req, res) => {
  try {
    console.log('📥 Files received:', req.files?.length || 0);
    
    if (!req.files || req.files.length === 0) {
      return res.status(400).json({ message: 'No files uploaded' });
    }

    const { clientId } = req.body;
    if (!clientId) {
      return res.status(400).json({ message: 'Client ID is required!' });
    }

    // ✅ Wait for DB connection to be ready
    if (mongoose.connection.readyState !== 1) {
      console.error('❌ MongoDB not connected!');
      return res.status(500).json({ message: 'Database connection not established' });
    }

    const bucket = getGridFS();
    if (!bucket) {
      return res.status(500).json({ message: 'GridFS not initialized' });
    }

    const uploadedFiles = [];

    for (const file of req.files) {
      // ✅ Directly upload buffer to GridFS
      const uploadStream = bucket.openUploadStream(file.originalname, {
        contentType: file.mimetype,
        metadata: {
          uploadedBy: req.user.id,
          clientId: clientId,
          uploadDate: new Date()
        }
      });

      // ✅ Write buffer to stream
      uploadStream.write(file.buffer);
      uploadStream.end();

      // ✅ Wait for finish event
      const fileId = await new Promise((resolve, reject) => {
        uploadStream.on('finish', () => resolve(uploadStream.id));
        uploadStream.on('error', (err) => reject(err));
      });

      // ✅ Save metadata to MongoDB
      const host = req.get('host');
      const protocol = req.protocol === 'https' ? 'https' : 'http';
      const url = `${protocol}://${host}/api/documents/${fileId}`;

      const doc = new Document({
        clientId: clientId,
        filename: file.originalname,
        originalName: file.originalname,
        fileType: file.mimetype.startsWith('image/') ? 'image' : 
                 file.mimetype === 'application/pdf' ? 'pdf' : 'document',
        fileSize: file.size,
        fileUrl: url,
        fileId: fileId,
        mimeType: file.mimetype,
        uploadedBy: req.user.id
      });
      
      await doc.save();

      uploadedFiles.push({
        id: doc._id,
        url: url,
        fileId: fileId,
        filename: file.originalname,
        size: file.size,
        mimeType: file.mimetype
      });
    }

    res.json({
      message: `${uploadedFiles.length} files uploaded successfully`,
      files: uploadedFiles
    });

  } catch (error) {
    console.error('❌ Upload error:', error);
    res.status(500).json({ message: error.message });
  }
});

// ✅ Rename document
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

// ✅ Get all documents for a client
router.get('/client/:clientId', auth, async (req, res) => {
  try {
    const documents = await Document.find({ clientId: req.params.clientId, isDeleted: false }).sort({ createdAt: -1 });
    res.json(documents);
  } catch (error) {
    console.error('Error fetching documents:', error);
    res.status(500).json({ message: error.message });
  }
});

// ✅ Delete document (soft delete)
router.delete('/:id', auth, async (req, res) => {
  try {
    const doc = await Document.findOneAndUpdate({ _id: req.params.id, isDeleted: false }, { isDeleted: true }, { new: true });
    if (!doc) return res.status(404).json({ message: 'Document not found' });
    res.json({ message: 'Document deleted successfully' });
  } catch (error) {
    console.error('Delete error:', error);
    res.status(500).json({ message: error.message });
  }
});

// ✅ Get document by GridFS file ID (view/download) — FIXED with auth middleware
router.get('/:id', auth, async (req, res) => {
  try {
    const fileId = new ObjectId(req.params.id);
    const doc = await Document.findOne({ fileId, isDeleted: false });
    if (!doc) return res.status(404).json({ message: 'Document not found' });

    const bucket = getGridFS();
    if (!bucket) return res.status(500).json({ message: 'GridFS not available' });

    const downloadStream = bucket.openDownloadStream(fileId);
    res.setHeader('Content-Type', doc.mimeType);
    res.setHeader('Content-Disposition', `inline; filename="${doc.filename}"`);
    downloadStream.pipe(res);

    downloadStream.on('error', (error) => {
      console.error('Download error:', error);
      res.status(500).json({ message: 'Error downloading file' });
    });

  } catch (error) {
    console.error('Document fetch error:', error);
    res.status(500).json({ message: error.message });
  }
});

module.exports = router;