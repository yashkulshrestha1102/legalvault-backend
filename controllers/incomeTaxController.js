const IncomeTax = require('../models/IncomeTax');

// ✅ Get all Income Tax records for a client
exports.getIncomeTaxByClient = async (req, res) => {
  try {
    const { clientId } = req.params;
    console.log('📋 Fetching Income Tax for client:', clientId);
    const records = await IncomeTax.find({ clientId }).sort({ createdAt: -1 });
    console.log('✅ Income Tax found:', records.length);
    res.json(records);
  } catch (error) {
    console.error('❌ Error fetching Income Tax:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

// ✅ Get single Income Tax record
exports.getIncomeTaxById = async (req, res) => {
  try {
    const { id } = req.params;
    const record = await IncomeTax.findById(id);
    if (!record) {
      return res.status(404).json({ message: 'Income Tax record not found' });
    }
    res.json(record);
  } catch (error) {
    console.error('❌ Error fetching Income Tax:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

// ✅ Create Income Tax record
exports.createIncomeTax = async (req, res) => {
  try {
    const data = {
      ...req.body,
      createdBy: req.user?.id
    };
    console.log('📋 Creating Income Tax:', data);
    const record = new IncomeTax(data);
    await record.save();
    console.log('✅ Income Tax created:', record._id);
    res.status(201).json(record);
  } catch (error) {
    console.error('❌ Error creating Income Tax:', error);
    res.status(500).json({ message: error.message || 'Server error' });
  }
};

// ✅ Update Income Tax record
exports.updateIncomeTax = async (req, res) => {
  try {
    const { id } = req.params;
    const record = await IncomeTax.findByIdAndUpdate(id, req.body, { new: true });
    if (!record) {
      return res.status(404).json({ message: 'Income Tax record not found' });
    }
    console.log('✅ Income Tax updated:', record._id);
    res.json(record);
  } catch (error) {
    console.error('❌ Error updating Income Tax:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

// ✅ Delete Income Tax record
exports.deleteIncomeTax = async (req, res) => {
  try {
    const { id } = req.params;
    const record = await IncomeTax.findByIdAndDelete(id);
    if (!record) {
      return res.status(404).json({ message: 'Income Tax record not found' });
    }
    console.log('✅ Income Tax deleted:', id);
    res.json({ message: 'Income Tax record deleted successfully' });
  } catch (error) {
    console.error('❌ Error deleting Income Tax:', error);
    res.status(500).json({ message: 'Server error' });
  }
};