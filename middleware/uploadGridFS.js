const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
const multer = require('multer');
const PDF = require('../models/PDF');
const { ObjectId } = require('mongodb');
const { getGridFS } = require('../config/gridfs');
const { uploadFilesSmart, deleteFileSmart } = require('../controllers/storageController');

// Multer memory storage
const storage = multer.memoryStorage();
const upload = multer({
  storage: storage,
  limits: { fileSize: 100 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    if (file.fieldname !== 'pdf' && file.fieldname !== 'document') {
      return cb(new Error('Unexpected field: ' + file.fieldname));
    }
    const allowedTypes = [
      'application/pdf',
      'image/jpeg',
      'image/png',
      'image/webp',
    ];
    if (allowedTypes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('File type not allowed: ' + file.mimetype));
    }
  },
});

// ===========================================
// Upload Multiple PDFs (R2 or GridFS)
// ===========================================
router.post('/pdf', auth, upload.array('pdf', 10), async (req, res) => {
  try {
    if (!req.files || req.files.length === 0) {
      return res.status(400).json({ message: 'No files uploaded' });
    }

    const { clientId, registrationId, automationId } = req.body;

    // SMART UPLOAD (R2 or GridFS)
    const uploadedFiles = await uploadFilesSmart(req.files, {
      folder: `clients/${clientId || 'general'}/pdfs`,
      metadata: { uploadedBy: req.user.id, clientId, registrationId, automationId },
      gridfsUrlPrefix: '/api/pdfs',
    });

    const savedDocs = [];
    for (const fileData of uploadedFiles) {
      let url = fileData.fileUrl;
      if (fileData.storageType === 'gridfs' && fileData.fileId) {
        url = `/api/pdfs/${fileData.fileId}`;
      }

      const pdfDoc = new PDF({
        filename: fileData.filename,
        contentType: fileData.mimeType,
        size: fileData.fileSize,
        uploadedBy: req.user.id,
        clientId,
        registrationId,
        automationId,
        storageType: fileData.storageType,
        r2Key: fileData.r2Key || null,
        fileId: fileData.fileId || null,
      });
      await pdfDoc.save();

      savedDocs.push({
        url,
        fileId: pdfDoc.fileId,
        r2Key: pdfDoc.r2Key,
        storageType: pdfDoc.storageType,
        filename: pdfDoc.filename,
        size: pdfDoc.size,
        contentType: pdfDoc.contentType,
      });
    }

    res.json({
      message: 'PDFs uploaded successfully',
      files: savedDocs,
      urls: savedDocs.map((f) => f.url),
    });
  } catch (error) {
    console.error('Upload error:', error);
    res.status(500).json({ message: error.message });
  }
});

// ===========================================
// Get PDF by ID (R2 redirect or GridFS stream)
// ===========================================
router.get('/:id', auth, async (req, res) => {
  try {
    const fileId = new ObjectId(req.params.id);
    const pdfDoc = await PDF.findOne({ fileId });
    if (!pdfDoc) return res.status(404).json({ message: 'PDF not found' });

    // R2 file - redirect
    if (pdfDoc.storageType === 'r2' && pdfDoc.r2Key) {
      return res.redirect(`${process.env.R2_PUBLIC_URL}/${pdfDoc.r2Key}`);
    }

    // GridFS file - stream
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

// ===========================================
// Delete document (R2 or GridFS)
// ===========================================
router.delete('/:id', auth, async (req, res) => {
  try {
    const fileId = new ObjectId(req.params.id);
    const pdfDoc = await PDF.findOne({ fileId });
    if (!pdfDoc) return res.status(404).json({ message: 'Document not found' });

    // Smart delete (R2 or GridFS)
    await deleteFileSmart(pdfDoc);

    // Delete from DB
    await pdfDoc.deleteOne();

    res.json({ message: 'Document deleted successfully' });
  } catch (error) {
    console.error('Delete error:', error);
    res.status(500).json({ message: error.message });
  }
});

module.exports = router;