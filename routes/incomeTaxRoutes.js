const express = require('express');
const router = express.Router();
const {
  getIncomeTaxByClient,
  getIncomeTaxById,
  createIncomeTax,
  updateIncomeTax,
  deleteIncomeTax
} = require('../controllers/incomeTaxController');
const auth = require('../middleware/auth');

// ✅ All routes require authentication
router.use(auth);

// ✅ Get all Income Tax for a client
router.get('/client/:clientId', getIncomeTaxByClient);

// ✅ Get single Income Tax record
router.get('/:id', getIncomeTaxById);

// ✅ Create Income Tax record
router.post('/', createIncomeTax);

// ✅ Update Income Tax record
router.put('/:id', updateIncomeTax);

// ✅ Delete Income Tax record
router.delete('/:id', deleteIncomeTax);

module.exports = router;