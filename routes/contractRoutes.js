const express = require('express');
const router = express.Router();
const { body, validationResult } = require('express-validator');
const auth = require('../middleware/auth');
const Contract = require('../models/Contract');

// ✅ Validation Rules
const validateContract = [
  body('clientId').notEmpty().withMessage('Client ID is required'),
  body('contractType').notEmpty().withMessage('Contract type is required'),
  body('contractName').notEmpty().withMessage('Contract name is required'),
  body('firstParty').notEmpty().withMessage('First party is required'),
  body('secondParty').notEmpty().withMessage('Second party is required'),
  body('startDate').notEmpty().withMessage('Start date is required'),
  body('endDate').notEmpty().withMessage('End date is required')
];

const handleValidation = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }
  next();
};

// ✅ GET - All contracts for a client
router.get('/client/:clientId', auth, async (req, res) => {
  try {
    const contracts = await Contract.find({ 
      clientId: req.params.clientId,
      isDeleted: false 
    }).populate('createdBy', 'name email');
    res.json(contracts);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// ✅ GET - Single contract by ID
router.get('/:id', auth, async (req, res) => {
  try {
    const contract = await Contract.findOne({ 
      _id: req.params.id, 
      isDeleted: false 
    }).populate('createdBy', 'name email');
    
    if (!contract) {
      return res.status(404).json({ message: 'Contract not found' });
    }
    res.json(contract);
  } catch (error) {
    console.error('❌ Error fetching contract:', error);
    res.status(500).json({ message: error.message });
  }
});

// ✅ POST - Create contract
router.post('/', auth, validateContract, handleValidation, async (req, res) => {
  try {
    const contract = new Contract({
      ...req.body,
      createdBy: req.user.id
    });
    await contract.save();
    res.status(201).json(contract);
  } catch (error) {
    console.error('❌ Error creating contract:', error);
    res.status(400).json({ message: error.message });
  }
});

// ✅ PUT - Update contract
router.put('/:id', auth, validateContract, handleValidation, async (req, res) => {
  try {
    const contract = await Contract.findOneAndUpdate(
      { _id: req.params.id, isDeleted: false },
      req.body,
      { new: true }
    );
    if (!contract) {
      return res.status(404).json({ message: 'Contract not found' });
    }
    res.json(contract);
  } catch (error) {
    console.error('❌ Error updating contract:', error);
    res.status(400).json({ message: error.message });
  }
});

// ✅ DELETE - Delete contract (Soft Delete)
router.delete('/:id', auth, async (req, res) => {
  try {
    const contract = await Contract.findOneAndUpdate(
      { _id: req.params.id, isDeleted: false },
      { isDeleted: true },
      { new: true }
    );
    if (!contract) {
      return res.status(404).json({ message: 'Contract not found' });
    }
    res.json({ message: 'Contract deleted successfully' });
  } catch (error) {
    console.error('❌ Error deleting contract:', error);
    res.status(500).json({ message: error.message });
  }
});

module.exports = router;