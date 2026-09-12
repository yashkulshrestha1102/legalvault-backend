const express = require('express');
const router = express.Router();
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
router.post('/', createPolicy);

// ✅ Update policy
router.put('/:id', updatePolicy);

// ✅ Delete policy
router.delete('/:id', deletePolicy);

module.exports = router;