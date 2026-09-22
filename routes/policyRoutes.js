const express = require('express');
const router = express.Router();
const auditLog = require('../middleware/audit');

const {
  getPoliciesByClient,
  getPolicyById,
  createPolicy,
  updatePolicy,
  deletePolicy
} = require('../controllers/policyController');
const auth = require('../middleware/auth');

// ✅ All routes require authentication
router.use(auth);

// ✅ Get all policies for a client
router.get('/client/:clientId', getPoliciesByClient);

// ✅ Get single policy
router.get('/:id', getPolicyById);

// ✅ Create policy
router.post('/',auditLog, createPolicy);

// ✅ Update policy
router.put('/:id',auditLog, updatePolicy);

// ✅ Delete policy
router.delete('/:id',auditLog, deletePolicy);

module.exports = router;