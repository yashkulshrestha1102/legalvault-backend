const express = require('express');
const router = express.Router();
const auditLog = require('../middleware/audit');

const {
  getCSByClient,
  getCSById,
  createCS,
  updateCS,
  deleteCS
} = require('../controllers/corporateSecretariatController');
const auth = require('../middleware/auth');

// ✅ All routes require authentication
router.use(auth);

// ✅ Get all records for a client
router.get('/client/:clientId', getCSByClient);

// ✅ Get single record
router.get('/:id', getCSById);

// ✅ Create record
router.post('/',auditLog, createCS);

// ✅ Update record
router.put('/:id',auditLog, updateCS);

// ✅ Delete record
router.delete('/:id',auditLog, deleteCS);

module.exports = router;