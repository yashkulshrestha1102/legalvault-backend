const express = require('express');
const router = express.Router();
const { body, validationResult } = require('express-validator');
const auth = require('../middleware/auth');
const admin = require('../middleware/admin');
const {
  getClients,
  getClientById,
  createClient,
  updateClient,
  deleteClient
} = require('../controllers/clientController');

// ✅ Validation rules (FIXED: userPermissions use kiya)
const validateClient = [
  body('name').notEmpty().withMessage('Name is required'),
  body('company').notEmpty().withMessage('Company is required'),
  body('email').isEmail().withMessage('Valid email is required'),
  body('phone').isLength({ min: 10, max: 15 }).withMessage('Phone must be 10-15 digits'),
  body('status').optional().isIn(['Active', 'Inactive']),
  body('userPermissions').optional().isArray().withMessage('userPermissions must be an array')
];

const handleValidation = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }
  next();
};

router.get('/', auth, getClients);
router.get('/:id', auth, getClientById);
router.post('/', auth, validateClient, handleValidation, createClient);
router.put('/:id', auth, validateClient, handleValidation, updateClient);
router.delete('/:id', [auth, admin], deleteClient);

module.exports = router;