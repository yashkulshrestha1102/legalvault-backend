const express = require('express');
const router = express.Router();
const {
  getHRByClient,
  getHRById,
  createHR,
  updateHR,
  deleteHR
} = require('../controllers/hrController');
const auth = require('../middleware/auth');

// ✅ All routes require authentication
router.use(auth);

// ✅ Get all HR for a client
router.get('/client/:clientId', getHRByClient);

// ✅ Get single HR record
router.get('/:id', getHRById);

// ✅ Create HR record
router.post('/', createHR);

// ✅ Update HR record
router.put('/:id', updateHR);

// ✅ Delete HR record
router.delete('/:id', deleteHR);

module.exports = router;