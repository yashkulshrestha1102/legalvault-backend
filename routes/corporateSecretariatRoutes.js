const express = require('express');
const router = express.Router();
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
router.post('/', createCS);

// ✅ Update record
router.put('/:id', updateCS);

// ✅ Delete record
router.delete('/:id', deleteCS);

module.exports = router;