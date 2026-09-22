const express = require('express');
const router = express.Router();
const auditLog = require('../middleware/audit');

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
router.post('/',auditLog, createFinancial);

// ✅ Update Financial record
router.put('/:id',auditLog, updateFinancial);

// ✅ Delete Financial record
router.delete('/:id',auditLog, deleteFinancial);

module.exports = router;