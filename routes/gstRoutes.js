const express = require('express');
const router = express.Router();
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
router.post('/', createGST);

// ✅ Update GST
router.put('/:id', updateGST);

// ✅ Delete GST
router.delete('/:id', deleteGST);

module.exports = router;