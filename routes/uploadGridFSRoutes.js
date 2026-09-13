const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
const multer = require('multer');
const { getGridFS } = require('../config/gridfs');
const PDF = require('../models/PDF');
const { ObjectId } = require('mongodb');

// ✅ Multer memory storage
const storage = multer.memoryStorage();
const upload = multer({ 
  storage: storage,
  limits: { fileSize: 100 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    if (file.fieldname !== 'pdf' && file.fieldname !== 'document') {
      return cb(new Error('Unexpected field: ' + file.fieldname));
    }
    // ✅ Ab PDF ke alawa images bhi allow karega
    const allowedTypes = ['application/pdf', 'image/jpeg', 'image/png', 'image/webp'];
    if (allowedTypes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('File type not allowed: ' + file.mimetype));
    }
  }
});

// ✅ Upload Multiple PDFs
router.post('/pdf', auth, upload.array('pdf', 10), async (req, res) => {
  try {
    if (!req.files || req.files.length === 0) {
      return res.status(400).json({ message: 'No files uploaded' });
    }

    const bucket = getGridFS();
    if (!bucket) return res.status(500).json({ message: 'GridFS not available' });

    const { clientId, registrationId, automationId } = req.body;
    const uploadedFiles = [];

    for (const file of req.files) {
      const uploadStream = bucket.openUploadStream(file.originalname, {
        contentType: file.mimetype,
        metadata: { 
          uploadedBy: req.user.id, 
          clientId, 
          registrationId, 
          automationId, 
          uploadDate: new Date() 
        }
      });
      uploadStream.write(file.buffer);
      uploadStream.end();

      const fileId = await new Promise((resolve, reject) => {
        uploadStream.on('finish', () => resolve(uploadStream.id));
        uploadStream.on('error', (err) => reject(err));
      });

      const pdfDoc = new PDF({
        filename: file.originalname, 
        contentType: file.mimetype, 
        size: file.size,
        uploadedBy: req.user.id, 
        clientId, 
        registrationId, 
        automationId, 
        fileId
      });
      await pdfDoc.save();

      // ✅ FIX: Relative URL — host-independent
      const url = `/api/pdfs/${fileId}`;
      
      uploadedFiles.push({ 
        url, 
        fileId, 
        filename: file.originalname, 
        size: file.size, 
        contentType: file.mimetype 
      });
    }

    res.json({ 
      message: 'PDFs uploaded successfully', 
      files: uploadedFiles, 
      urls: uploadedFiles.map(f => f.url) 
    });
  } catch (error) {
    console.error('Upload error:', error);
    res.status(500).json({ message: error.message });
  }
});

// ✅ Get PDF by ID — with auth middleware
router.get('/:id', auth, async (req, res) => {
  try {
    const fileId = new ObjectId(req.params.id);
    const pdfDoc = await PDF.findOne({ fileId });
    if (!pdfDoc) return res.status(404).json({ message: 'PDF not found' });

    const bucket = getGridFS();
    if (!bucket) return res.status(500).json({ message: 'GridFS not available' });

    const downloadStream = bucket.openDownloadStream(fileId);
    
    downloadStream.on('file', (file) => {
      res.setHeader('Content-Type', file.contentType || pdfDoc.contentType);
      res.setHeader('Content-Length', file.length);
      res.setHeader('Content-Disposition', `inline; filename="${pdfDoc.filename}"`);
    });

    downloadStream.on('error', (error) => {
      console.error('Download error:', error);
      if (!res.headersSent) {
        res.status(500).json({ message: 'Error downloading file' });
      }
    });

    downloadStream.pipe(res);
  } catch (error) {
    console.error('PDF fetch error:', error);
    if (!res.headersSent) {
      res.status(500).json({ message: error.message });
    }
  }
});

// ✅ Delete document
router.delete('/:id', auth, async (req, res) => {
  try {
    const fileId = new ObjectId(req.params.id);
    const pdfDoc = await PDF.findOne({ fileId });
    if (!pdfDoc) return res.status(404).json({ message: 'Document not found' });

    const bucket = getGridFS();
    if (!bucket) return res.status(500).json({ message: 'GridFS not available' });

    await bucket.delete(fileId);
    await pdfDoc.deleteOne();
    res.json({ message: 'Document deleted successfully' });
  } catch (error) {
    console.error('Delete error:', error);
    res.status(500).json({ message: error.message });
  }
});

module.exports = router;