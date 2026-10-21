const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');

// ✅ Yahan getUniqueCompanies add karo import mein
const {
  getCompliances,
  createCompliance,
  updateCompliance,
  deleteCompliance,
  sendManualReminder,
  runDailyReminders,
  getUniqueCompanies, // <--- YEH ADD KARO
} = require('../controllers/complianceController');

router.use(auth);

router.get('/', getCompliances);
router.post('/', createCompliance);
router.put('/:id', updateCompliance);
router.delete('/:id', deleteCompliance);
router.post('/:id/send-now', sendManualReminder);

// ✅ Companies route
router.get('/companies', getUniqueCompanies);

// ✅ Manual trigger for whole daily job (testing ke liye)
router.post('/run-daily', async (req, res) => {
  try {
    const count = await runDailyReminders();
    res.json({ message: `Triggered ${count} reminders` });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

module.exports = router;