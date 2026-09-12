const GST = require('../models/GST');

// ✅ Get all GST for a client
exports.getGSTByClient = async (req, res) => {
  try {
    const { clientId } = req.params;
    console.log('📋 Fetching GST for client:', clientId);
    const gstRecords = await GST.find({ clientId }).sort({ createdAt: -1 });
    console.log('✅ GST found:', gstRecords.length);
    res.json(gstRecords);
  } catch (error) {
    console.error('❌ Error fetching GST:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

// ✅ Get single GST
exports.getGSTById = async (req, res) => {
  try {
    const { id } = req.params;
    const gst = await GST.findById(id);
    if (!gst) {
      return res.status(404).json({ message: 'GST record not found' });
    }
    res.json(gst);
  } catch (error) {
    console.error('❌ Error fetching GST:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

// ✅ Create GST
exports.createGST = async (req, res) => {
  try {
    const gstData = {
      ...req.body,
      createdBy: req.user?.id
    };
    console.log('📋 Creating GST:', gstData);
    const gst = new GST(gstData);
    await gst.save();
    console.log('✅ GST created:', gst._id);
    res.status(201).json(gst);
  } catch (error) {
    console.error('❌ Error creating GST:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

// ✅ Update GST
exports.updateGST = async (req, res) => {
  try {
    const { id } = req.params;
    const gst = await GST.findByIdAndUpdate(id, req.body, { new: true });
    if (!gst) {
      return res.status(404).json({ message: 'GST record not found' });
    }
    console.log('✅ GST updated:', gst._id);
    res.json(gst);
  } catch (error) {
    console.error('❌ Error updating GST:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

// ✅ Delete GST
exports.deleteGST = async (req, res) => {
  try {
    const { id } = req.params;
    const gst = await GST.findByIdAndDelete(id);
    if (!gst) {
      return res.status(404).json({ message: 'GST record not found' });
    }
    console.log('✅ GST deleted:', id);
    res.json({ message: 'GST record deleted successfully' });
  } catch (error) {
    console.error('❌ Error deleting GST:', error);
    res.status(500).json({ message: 'Server error' });
  }
};