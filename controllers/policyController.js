const Policy = require('../models/Policy');

// ✅ Get all policies for a client
exports.getPoliciesByClient = async (req, res) => {
  try {
    const { clientId } = req.params;
    const policies = await Policy.find({ clientId }).sort({ createdAt: -1 });
    res.json(policies);
  } catch (error) {
    console.error('❌ Error fetching policies:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

// ✅ Get single policy
exports.getPolicyById = async (req, res) => {
  try {
    const { id } = req.params;
    const policy = await Policy.findById(id);
    if (!policy) {
      return res.status(404).json({ message: 'Policy not found' });
    }
    res.json(policy);
  } catch (error) {
    console.error('❌ Error fetching policy:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

// ✅ Create policy
exports.createPolicy = async (req, res) => {
  try {
    const policyData = {
      ...req.body,
      createdBy: req.user?.id
    };
    const policy = new Policy(policyData);
    await policy.save();
    res.status(201).json(policy);
  } catch (error) {
    console.error('❌ Error creating policy:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

// ✅ Update policy
exports.updatePolicy = async (req, res) => {
  try {
    const { id } = req.params;
    const policy = await Policy.findByIdAndUpdate(id, req.body, { new: true });
    if (!policy) {
      return res.status(404).json({ message: 'Policy not found' });
    }
    res.json(policy);
  } catch (error) {
    console.error('❌ Error updating policy:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

// ✅ Delete policy
exports.deletePolicy = async (req, res) => {
  try {
    const { id } = req.params;
    const policy = await Policy.findByIdAndDelete(id);
    if (!policy) {
      return res.status(404).json({ message: 'Policy not found' });
    }
    res.json({ message: 'Policy deleted successfully' });
  } catch (error) {
    console.error('❌ Error deleting policy:', error);
    res.status(500).json({ message: 'Server error' });
  }
};