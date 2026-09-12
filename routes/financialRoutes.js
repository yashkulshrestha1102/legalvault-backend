const express = require('express');
const router = express.Router();
const {
  getFinancialByClient,
  getFinancialById,
  createFinancial,
  updateFinancial,
  deleteFinancial
} = require('../controllers/financialController');
const auth = require('../middleware/auth');

// ✅ All routes require authentication
router.use(auth);

// ✅ Get all Financials for a client
router.get('/client/:clientId', getFinancialByClient);

// ✅ Get single Financial record
router.get('/:id', getFinancialById);

// ✅ Create Financial record
router.post('/', createFinancial);

// ✅ Update Financial record
router.put('/:id', updateFinancial);

// ✅ Delete Financial record
router.delete('/:id', deleteFinancial);

module.exports = router;