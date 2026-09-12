const express = require('express');
const router = express.Router();
const { body, validationResult } = require('express-validator');
const auth = require('../middleware/auth');
const Registration = require('../models/Registration');

// ✅ Validation Rules
const validateRegistration = [
  body('clientId').notEmpty().withMessage('Client ID is required'),
  body('category').notEmpty().withMessage('Category is required'),
  body('registrationName').notEmpty().withMessage('Registration name is required'),
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

// ✅ GET - All registrations for a client
router.get('/client/:clientId', auth, async (req, res) => {
  try {
    console.log('📋 GET /registrations/client/:clientId - Client ID:', req.params.clientId);
    const registrations = await Registration.find({ clientId: req.params.clientId })
      .populate('createdBy', 'name email');
    console.log('✅ Found registrations:', registrations.length);
    res.json(registrations);
  } catch (error) {
    console.error('❌ Error fetching registrations:', error);
    res.status(500).json({ message: error.message });
  }
});

// ✅ GET - Single registration by ID
router.get('/:id', auth, async (req, res) => {
  try {
    console.log('📋 GET /registrations/:id - ID:', req.params.id);
    const registration = await Registration.findById(req.params.id)
      .populate('createdBy', 'name email');
    if (!registration) {
      return res.status(404).json({ message: 'Registration not found' });
    }
    console.log('✅ Registration found:', registration._id);
    res.json(registration);
  } catch (error) {
    console.error('❌ Error fetching registration:', error);
    res.status(500).json({ message: error.message });
  }
});

// ✅ POST - Create registration
router.post('/', auth, validateRegistration, handleValidation, async (req, res) => {
  try {
    console.log('📥 POST /registrations - Request body:', req.body);
    const registration = new Registration({
      ...req.body,
      createdBy: req.user.id
    });
    await registration.save();
    console.log('✅ Registration saved:', registration._id);
    res.status(201).json(registration);
  } catch (error) {
    console.error('❌ Error saving registration:', error);
    res.status(400).json({ message: error.message });
  }
});

// ✅ PUT - Update registration
router.put('/:id', auth, validateRegistration, handleValidation, async (req, res) => {
  try {
    console.log('📥 PUT /registrations/:id - ID:', req.params.id);
    const registration = await Registration.findByIdAndUpdate(
      req.params.id,
      req.body,
      { new: true }
    );
    if (!registration) {
      return res.status(404).json({ message: 'Registration not found' });
    }
    console.log('✅ Registration updated:', registration._id);
    res.json(registration);
  } catch (error) {
    console.error('❌ Error updating registration:', error);
    res.status(400).json({ message: error.message });
  }
});

// ✅ DELETE - Delete registration
router.delete('/:id', auth, async (req, res) => {
  try {
    console.log('📥 DELETE /registrations/:id - ID:', req.params.id);
    const registration = await Registration.findByIdAndDelete(req.params.id);
    if (!registration) {
      return res.status(404).json({ message: 'Registration not found' });
    }
    console.log('✅ Registration deleted:', registration._id);
    res.json({ message: 'Registration deleted successfully' });
  } catch (error) {
    console.error('❌ Error deleting registration:', error);
    res.status(500).json({ message: error.message });
  }
});

module.exports = router;