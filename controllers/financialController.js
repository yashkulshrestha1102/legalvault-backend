const Financial = require('../models/Financial');

// ✅ Get all Financial records for a client
exports.getFinancialByClient = async (req, res) => {
  try {
    const { clientId } = req.params;
    console.log('📋 Fetching Financials for client:', clientId);
    const records = await Financial.find({ clientId }).sort({ createdAt: -1 });
    console.log('✅ Financials found:', records.length);
    res.json(records);
  } catch (error) {
    console.error('❌ Error fetching Financials:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

// ✅ Get single Financial record
exports.getFinancialById = async (req, res) => {
  try {
    const { id } = req.params;
    const record = await Financial.findById(id);
    if (!record) {
      return res.status(404).json({ message: 'Financial record not found' });
    }
    res.json(record);
  } catch (error) {
    console.error('❌ Error fetching Financial:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

// ✅ Create Financial record
exports.createFinancial = async (req, res) => {
  try {
    const data = {
      ...req.body,
      createdBy: req.user?.id
    };
    console.log('📋 Creating Financial:', data);
    const record = new Financial(data);
    await record.save();
    console.log('✅ Financial created:', record._id);
    res.status(201).json(record);
  } catch (error) {
    console.error('❌ Error creating Financial:', error);
    res.status(500).json({ message: error.message || 'Server error' });
  }
};

// ✅ Update Financial record
exports.updateFinancial = async (req, res) => {
  try {
    const { id } = req.params;
    const record = await Financial.findByIdAndUpdate(id, req.body, { new: true });
    if (!record) {
      return res.status(404).json({ message: 'Financial record not found' });
    }
    console.log('✅ Financial updated:', record._id);
    res.json(record);
  } catch (error) {
    console.error('❌ Error updating Financial:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

// ✅ Delete Financial record
exports.deleteFinancial = async (req, res) => {
  try {
    const { id } = req.params;
    const record = await Financial.findByIdAndDelete(id);
    if (!record) {
      return res.status(404).json({ message: 'Financial record not found' });
    }
    console.log('✅ Financial deleted:', id);
    res.json({ message: 'Financial record deleted successfully' });
  } catch (error) {
    console.error('❌ Error deleting Financial:', error);
    res.status(500).json({ message: 'Server error' });
  }
};