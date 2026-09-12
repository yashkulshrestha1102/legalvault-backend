const CorporateSecretariat = require('../models/CorporateSecretariat');

// ✅ Get all records for a client
exports.getCSByClient = async (req, res) => {
  try {
    const { clientId } = req.params;
    console.log('📋 Fetching Corporate Secretariat for client:', clientId);
    const records = await CorporateSecretariat.find({ clientId }).sort({ createdAt: -1 });
    console.log('✅ Corporate Secretariat found:', records.length);
    res.json(records);
  } catch (error) {
    console.error('❌ Error fetching Corporate Secretariat:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

// ✅ Get single record
exports.getCSById = async (req, res) => {
  try {
    const { id } = req.params;
    const record = await CorporateSecretariat.findById(id);
    if (!record) {
      return res.status(404).json({ message: 'Corporate Secretariat record not found' });
    }
    res.json(record);
  } catch (error) {
    console.error('❌ Error fetching Corporate Secretariat:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

// ✅ Create record
exports.createCS = async (req, res) => {
  try {
    const data = {
      ...req.body,
      createdBy: req.user?.id
    };
    console.log('📋 Creating Corporate Secretariat:', data);
    const record = new CorporateSecretariat(data);
    await record.save();
    console.log('✅ Corporate Secretariat created:', record._id);
    res.status(201).json(record);
  } catch (error) {
    console.error('❌ Error creating Corporate Secretariat:', error);
    res.status(500).json({ message: error.message || 'Server error' });
  }
};

// ✅ Update record
exports.updateCS = async (req, res) => {
  try {
    const { id } = req.params;
    const record = await CorporateSecretariat.findByIdAndUpdate(id, req.body, { new: true });
    if (!record) {
      return res.status(404).json({ message: 'Corporate Secretariat record not found' });
    }
    console.log('✅ Corporate Secretariat updated:', record._id);
    res.json(record);
  } catch (error) {
    console.error('❌ Error updating Corporate Secretariat:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

// ✅ Delete record
exports.deleteCS = async (req, res) => {
  try {
    const { id } = req.params;
    const record = await CorporateSecretariat.findByIdAndDelete(id);
    if (!record) {
      return res.status(404).json({ message: 'Corporate Secretariat record not found' });
    }
    console.log('✅ Corporate Secretariat deleted:', id);
    res.json({ message: 'Corporate Secretariat record deleted successfully' });
  } catch (error) {
    console.error('❌ Error deleting Corporate Secretariat:', error);
    res.status(500).json({ message: 'Server error' });
  }
};