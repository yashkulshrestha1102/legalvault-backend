const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');

const {
  getCompliances,
  createCompliance,
  updateCompliance,
  deleteCompliance,
  sendManualReminder,
  runDailyReminders,
  getUniqueCompanies,
} = require('../controllers/complianceController');

// ✅ YEH ROUTE SABSE PEHLE HONA CHAHIYE (auth ke pehle)
router.get('/trigger-cron-secret', async (req, res) => {
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

// 🚨 Ab yahan se neeche auth lagega
router.use(auth);

router.get('/', getCompliances);
router.post('/', createCompliance);
router.put('/:id', updateCompliance);
router.delete('/:id', deleteCompliance);
router.post('/:id/send-now', sendManualReminder);

router.get('/companies', getUniqueCompanies);

router.post('/run-daily', async (req, res) => {
  try {
    const count = await runDailyReminders();
    res.json({ message: `Triggered ${count} reminders` });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

module.exports = router;