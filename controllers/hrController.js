const HR = require('../models/HR');

// ✅ Get all HR records for a client
exports.getHRByClient = async (req, res) => {
  try {
    const { clientId } = req.params;
    console.log('📋 Fetching HR for client:', clientId);
    const records = await HR.find({ clientId }).sort({ createdAt: -1 });
    console.log('✅ HR found:', records.length);
    res.json(records);
  } catch (error) {
    console.error('❌ Error fetching HR:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

// ✅ Get single HR record
exports.getHRById = async (req, res) => {
  try {
    const { id } = req.params;
    const record = await HR.findById(id);
    if (!record) {
      return res.status(404).json({ message: 'HR record not found' });
    }
    res.json(record);
  } catch (error) {
    console.error('❌ Error fetching HR:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

// ✅ Create HR record
exports.createHR = async (req, res) => {
  try {
    const data = {
      ...req.body,
      createdBy: req.user?.id
    };
    console.log('📋 Creating HR:', data);
    const record = new HR(data);
    await record.save();
    console.log('✅ HR created:', record._id);
    res.status(201).json(record);
  } catch (error) {
    console.error('❌ Error creating HR:', error);
    res.status(500).json({ message: error.message || 'Server error' });
  }
};

// ✅ Update HR record
exports.updateHR = async (req, res) => {
  try {
    const { id } = req.params;
    const record = await HR.findByIdAndUpdate(id, req.body, { new: true });
    if (!record) {
      return res.status(404).json({ message: 'HR record not found' });
    }
    console.log('✅ HR updated:', record._id);
    res.json(record);
  } catch (error) {
    console.error('❌ Error updating HR:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

// ✅ Delete HR record
exports.deleteHR = async (req, res) => {
  try {
    const { id } = req.params;
    const record = await HR.findByIdAndDelete(id);
    if (!record) {
      return res.status(404).json({ message: 'HR record not found' });
    }
    console.log('✅ HR deleted:', id);
    res.json({ message: 'HR record deleted successfully' });
  } catch (error) {
    console.error('❌ Error deleting HR:', error);
    res.status(500).json({ message: 'Server error' });
  }
};