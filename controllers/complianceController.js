const Compliance = require('../models/Compliance');
const { sendComplianceReminderEmail } = require('../utils/email');

// ✅ Naya sendReminderFor (Auto-Stop logic added)
const sendReminderFor = async (compliance, daysLeft, type = 'auto') => {
  // ✅ Auto-Stop: Agar Filed ya Overdue hai, toh skip karo
  if (compliance.status === 'Filed' || compliance.status === 'Overdue') {
    console.log(`⏭️ Skipping: Status is ${compliance.status} for ${compliance.companyName}`);
    return { email: [] };
  }

  const results = { email: [] };
  const title = compliance.complianceType === 'Custom'
    ? compliance.customName
    : compliance.complianceType;

  // ✅ Multiple Files Handle Karne Ka Logic
  // Purana single attachment + Naya multiple attachmentUrls dono check karega
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
      // ✅ Email me pehli file ka direct link jayega, aur baaki files ka count
      attachmentUrl: allFiles.length > 0 ? allFiles[0] : null,
      totalFiles: allFiles.length, 
    });
    results.email.push({ to: r.email, ...res });
  }

  // Log the reminder
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
    const user = req.user; // Auth middleware se aata hai
    
    const filter = { isDeleted: false };
    if (clientId) filter.clientId = clientId;
    if (from || to) {
      filter.dueDate = {};
      if (from) filter.dueDate.$gte = new Date(from);
      if (to) filter.dueDate.$lte = new Date(to);
    }

    // ✅ Role-Based Access: Agar admin nahi hai, toh sirf apni assigned dekhe
    if (user.role !== 'admin') {
      filter.assignedTo = user.id;
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
    
    // ✅ NAYA: Array ko clean karo taaki koi empty string save na ho
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
    
    // ✅ NAYA: Array ko clean karo
    if (updateData.attachmentUrls && Array.isArray(updateData.attachmentUrls)) {
      updateData.attachmentUrls = updateData.attachmentUrls.filter(u => u && u.trim() !== '');
    }

    const doc = await Compliance.findByIdAndUpdate(
      req.params.id,
      updateData,
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
    
    // ✅ Auto-Stop manual me bhi lagega
    if (doc.status === 'Filed' || doc.status === 'Overdue') {
      return res.status(400).json({ message: `Cannot send reminder. Status is ${doc.status}.` });
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

    const future = new Date(today);
    future.setDate(future.getDate() + 30);

    // ✅ Auto-Stop: Sirf Pending walo ko check karega
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

      if (daysLeft < 0 || daysLeft > c.reminderDays) continue;

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

// ═══════════════════════════════════════════
// ✅ NAYA: Unique company names fetch karne ke liye
// ═══════════════════════════════════════════
exports.getUniqueCompanies = async (req, res) => {
  try {
    const companies = await Compliance.distinct('companyName', { isDeleted: false });
    res.json(companies);
  } catch (err) {
    console.error('❌ getUniqueCompanies:', err);
    res.status(500).json({ message: err.message });
  }
};