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



// routes/complianceRoutes.js

// ... existing imports ...

// ✅ Naya route: GitHub Actions se trigger karne ke liye
router.get('/trigger-cron-secret', async (req, res) => {
  // Secret key check karo (ise .env mein daal dena)
  if (req.query.key !== process.env.CRON_SECRET_KEY) {
    return res.status(403).json({ message: 'Unauthorized' });
  }

  try {
    console.log('⏰ External Cron Trigger received from GitHub Actions');
    const count = await runDailyReminders();
    res.json({ success: true, message: `Triggered ${count} reminders` });
  } catch (err) {
    console.error('❌ Cron trigger error:', err);
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;