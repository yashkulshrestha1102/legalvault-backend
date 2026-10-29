const Compliance = require('../models/Compliance');
const { sendComplianceReminderEmail } = require('../utils/email');

// ✅ Naya sendReminderFor (Passing complianceId)
const sendReminderFor = async (compliance, daysLeft, type = 'auto') => {
  // Auto-Stop: Agar manually 'Filed' mark ho chuka hai, toh skip karo
  if (compliance.status === 'Filed') {
    console.log(`⏭️ Skipping: Status is Filed for ${compliance.companyName}`);
    return { email: [] };
  }

  const results = { email: [] };
  const title = compliance.complianceType === 'Custom'
    ? compliance.customName
    : compliance.complianceType;

  const allFiles = compliance.attachmentUrls?.length > 0 
    ? compliance.attachmentUrls 
    : (compliance.attachmentUrl ? [compliance.attachmentUrl] : []);

  for (const r of compliance.recipients) {
    if (!r.email) continue;
    
    const res = await sendComplianceReminderEmail({
      to: r.email,
      name: r.name,
      complianceName: title,
      companyName: compliance.companyName,
      dueDate: compliance.dueDate,
      daysLeft,
      period: compliance.period,
      notes: compliance.notes,
      attachmentUrls: allFiles, 
      complianceId: compliance._id.toString() // ✅ PASSED ID FOR BUTTON
    });
    results.email.push({ to: r.email, ...res });
  }

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
    const user = req.user; 
    
    const filter = { isDeleted: false };
    if (clientId) filter.clientId = clientId;
    if (from || to) {
      filter.dueDate = {};
      if (from) filter.dueDate.$gte = new Date(from);
      if (to) filter.dueDate.$lte = new Date(to);
    }

    // ✅ FIX: Non-admin ko unke assigned compliance + unassigned compliance dikhao
    if (user.role !== 'admin') {
      filter.$or = [
        { assignedTo: user.id },
        { assignedTo: { $exists: true, $size: 0 } },
        { assignedTo: { $exists: false } }
      ];
    }

    const list = await Compliance.find(filter)
      .populate('clientId', 'name company')
      .populate('assignedTo', 'name email')
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
    if (data.attachmentUrls && Array.isArray(data.attachmentUrls)) {
      data.attachmentUrls = data.attachmentUrls.filter(u => u && u.trim() !== '');
    }
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
    const updateData = { ...req.body };
    if (updateData.attachmentUrls && Array.isArray(updateData.attachmentUrls)) {
      updateData.attachmentUrls = updateData.attachmentUrls.filter(u => u && u.trim() !== '');
    }
    const doc = await Compliance.findByIdAndUpdate(req.params.id, updateData, { new: true, runValidators: true });
    if (!doc) return res.status(404).json({ message: 'Not found' });
    res.json(doc);
  } catch (err) {
    console.error('❌ updateCompliance:', err);
    res.status(400).json({ message: err.message });
  }
};

exports.deleteCompliance = async (req, res) => {
  try {
    const doc = await Compliance.findByIdAndUpdate(req.params.id, { isDeleted: true }, { new: true });
    if (!doc) return res.status(404).json({ message: 'Not found' });
    res.json({ message: 'Deleted' });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// ✅ NAYA: Email ke button se filing confirm karne ke liye
exports.confirmFilingFromEmail = async (req, res) => {
  try {
    const { id } = req.params;
    const doc = await Compliance.findById(id);
    
    if (!doc) return res.status(404).json({ message: 'Compliance record not found.' });
    if (doc.status === 'Filed') {
      return res.status(400).json({ message: 'This compliance is already marked as Filed.' });
    }

    doc.status = 'Filed';
    await doc.save();
    res.json({ success: true, message: 'Compliance marked as Filed successfully! Reminders stopped.' });
  } catch (err) {
    console.error('❌ confirmFilingFromEmail:', err);
    res.status(500).json({ message: err.message });
  }
};

// ═══════════════════════════════════════════
// ✅ MANUAL TRIGGER
// ═══════════════════════════════════════════
exports.sendManualReminder = async (req, res) => {
  try {
    const doc = await Compliance.findById(req.params.id);
    if (!doc || doc.isDeleted) return res.status(404).json({ message: 'Not found' });
    
    if (doc.status === 'Filed') {
      return res.status(400).json({ message: `Cannot send reminder. Status is Filed.` });
    }

    const today = new Date(); today.setHours(0, 0, 0, 0);
    const due = new Date(doc.dueDate); due.setHours(0, 0, 0, 0);
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
    const today = new Date(); today.setHours(0, 0, 0, 0);

    // ✅ FIX: Ab future ka nahi, balki SAARE Pending (aur Overdue) records uthayenge
    const list = await Compliance.find({
      isDeleted: false,
      status: { $in: ['Pending', 'Overdue'] } // Overdue bhi include kiya
    });

    let sentCount = 0;
    
    for (const c of list) {
      const due = new Date(c.dueDate); due.setHours(0, 0, 0, 0);
      const daysLeft = Math.ceil((due - today) / (1000 * 60 * 60 * 24));

      // ✅ Status automatically Overdue mark karo agar date nikal gayi
      if (daysLeft < 0 && c.status !== 'Overdue') {
        c.status = 'Overdue';
        await c.save();
      }

      // ✅ RULE: Mail tabhi bhejo jab:
      // 1. Due date aane wali ho (daysLeft <= reminderDays)
      // 2. YA Overdue ho chuka ho (daysLeft < 0)
      if (daysLeft > c.reminderDays && daysLeft >= 0) {
        continue; // Bahut zyada time bacha hai, skip karo
      }

      // Check if already sent today
      const alreadySentToday = (c.sentReminders || []).some(r => {
        const d = new Date(r.sentAt); d.setHours(0, 0, 0, 0);
        return d.getTime() === today.getTime() && r.type === 'auto';
      });
      
      if (alreadySentToday) continue;

      await sendReminderFor(c, daysLeft, 'auto');
      sentCount++;
      console.log(`✅ Reminder sent: ${c.complianceType} — ${daysLeft < 0 ? 'OVERDUE' : daysLeft + ' days left'}`);
    }
    
    console.log(`🎉 Daily reminders done. Sent: ${sentCount}`);
    return sentCount;
  } catch (err) {
    console.error('❌ runDailyReminders error:', err.message);
    throw err;
  }
};

exports.getUniqueCompanies = async (req, res) => {
  try {
    const companies = await Compliance.distinct('companyName', { isDeleted: false });
    res.json(companies);
  } catch (err) {
    console.error('❌ getUniqueCompanies:', err);
    res.status(500).json({ message: err.message });
  }
};