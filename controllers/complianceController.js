const Compliance = require('../models/Compliance');
const { sendComplianceReminderEmail } = require('../utils/email');

// ✅ Naya sendReminderFor
const sendReminderFor = async (compliance, daysLeft, type = 'auto') => {
  const results = { email: [] };
  const title = compliance.complianceType === 'Custom'
    ? compliance.customName
    : compliance.complianceType;

  for (const r of compliance.recipients) {
    if (!r.email) continue;
    const res = await sendComplianceReminderEmail({
      to: r.email,
      name: r.name,
      complianceName: title,
      dueDate: compliance.dueDate,
      daysLeft,
      period: compliance.period,
      notes: compliance.notes,
    });
    results.email.push({ to: r.email, ...res });
  }

  // Log the reminder (sirf email)
  if (results.email.some(r => r.success)) {
    compliance.sentReminders.push({
      sentAt: new Date(),
      channels: ['email'],
      type,
      daysBefore: daysLeft,
    });
    await compliance.save();
  }
  return results;
};

// ═══════════════════════════════════════════
// ✅ CRUD
// ═══════════════════════════════════════════
exports.getCompliances = async (req, res) => {
  try {
    const { clientId, from, to } = req.query;
    const filter = { isDeleted: false };
    if (clientId) filter.clientId = clientId;
    if (from || to) {
      filter.dueDate = {};
      if (from) filter.dueDate.$gte = new Date(from);
      if (to) filter.dueDate.$lte = new Date(to);
    }
    const list = await Compliance.find(filter)
      .populate('clientId', 'name company')
      .sort({ dueDate: 1 });
    res.json(list);
  } catch (err) {
    console.error('❌ getCompliances:', err);
    res.status(500).json({ message: err.message });
  }
};

exports.createCompliance = async (req, res) => {
  try {
    const data = { ...req.body, createdBy: req.user?.id };
    const doc = new Compliance(data);
    await doc.save();
    res.status(201).json(doc);
  } catch (err) {
    console.error('❌ createCompliance:', err);
    res.status(400).json({ message: err.message });
  }
};

exports.updateCompliance = async (req, res) => {
  try {
    const doc = await Compliance.findByIdAndUpdate(
      req.params.id,
      req.body,
      { new: true, runValidators: true }
    );
    if (!doc) return res.status(404).json({ message: 'Not found' });
    res.json(doc);
  } catch (err) {
    console.error('❌ updateCompliance:', err);
    res.status(400).json({ message: err.message });
  }
};

exports.deleteCompliance = async (req, res) => {
  try {
    const doc = await Compliance.findByIdAndUpdate(
      req.params.id,
      { isDeleted: true },
      { new: true }
    );
    if (!doc) return res.status(404).json({ message: 'Not found' });
    res.json({ message: 'Deleted' });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// ═══════════════════════════════════════════
// ✅ MANUAL TRIGGER (testing + on-demand)
// ═══════════════════════════════════════════
exports.sendManualReminder = async (req, res) => {
  try {
    const doc = await Compliance.findById(req.params.id);
    if (!doc || doc.isDeleted) {
      return res.status(404).json({ message: 'Not found' });
    }
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const due = new Date(doc.dueDate);
    due.setHours(0, 0, 0, 0);
    const daysLeft = Math.ceil((due - today) / (1000 * 60 * 60 * 24));

    const results = await sendReminderFor(doc, daysLeft, 'manual');
    res.json({ message: 'Reminder triggered', daysLeft, results });
  } catch (err) {
    console.error('❌ sendManualReminder:', err);
    res.status(500).json({ message: err.message });
  }
};

// ═══════════════════════════════════════════
// ✅ CRON JOB HANDLER — auto reminders
// ═══════════════════════════════════════════
exports.runDailyReminders = async () => {
  console.log('🔄 Running daily compliance reminders...');
  try {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    // Due date range: aaj se 30 din tak (safety)
    const future = new Date(today);
    future.setDate(future.getDate() + 30);

    const list = await Compliance.find({
      isDeleted: false,
      status: 'Pending',
      dueDate: { $gte: today, $lte: future },
    });

    let sentCount = 0;
    for (const c of list) {
      const due = new Date(c.dueDate);
      due.setHours(0, 0, 0, 0);
      const daysLeft = Math.ceil((due - today) / (1000 * 60 * 60 * 24));

      // ✅ Rule: reminderDays se lekar 0 din tak HAR DIN bhejna
      // (5,4,3,2,1,0) — aap chahe to 1 din pehle band kar sakte ho
      if (daysLeft < 0 || daysLeft > c.reminderDays) continue;

      // Aaj ke liye already bheja? Duplicate rok
      const alreadySentToday = (c.sentReminders || []).some(r => {
        const d = new Date(r.sentAt);
        d.setHours(0, 0, 0, 0);
        return d.getTime() === today.getTime() && r.type === 'auto';
      });
      if (alreadySentToday) continue;

      await sendReminderFor(c, daysLeft, 'auto');
      sentCount++;
      console.log(`✅ Reminder sent: ${c.complianceType} — ${daysLeft} days left`);
    }
    console.log(`🎉 Daily reminders done. Sent: ${sentCount}`);
    return sentCount;
  } catch (err) {
    console.error('❌ runDailyReminders error:', err.message);
    throw err;
  }
};