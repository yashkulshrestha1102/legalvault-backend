const express = require('express');
const router = express.Router();
const auditLog = require('../middleware/audit');

const {
  getGSTByClient,
  getGSTById,
  createGST,
  updateGST,
  deleteGST
} = require('../controllers/gstController');
const auth = require('../middleware/auth');

// ✅ All routes require authentication
router.use(auth);

// ✅ Get all GST for a client
router.get('/client/:clientId', getGSTByClient);

// ✅ Get single GST
router.get('/:id', getGSTById);

// ✅ Create GST
router.post('/',auditLog, createGST);

// ✅ Update GST
router.put('/:id',auditLog, updateGST);

// ✅ Delete GST
router.delete('/:id',auditLog, deleteGST);

module.exports = router;