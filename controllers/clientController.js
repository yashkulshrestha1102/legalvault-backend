const Client = require('../models/Client');
const mongoose = require('mongoose');

const isValidObjectId = (id) => mongoose.Types.ObjectId.isValid(id);
const sanitizeString = (str) => str?.trim() || '';

// ✅ GET ALL CLIENTS (Role + Folder Access) - FULLY FIXED
exports.getClients = async (req, res) => {
  try {
    const user = req.user;
    const query = { isDeleted: false };
    
    console.log('🔍 Fetching clients for user:', user.email, 'Role:', user.role);
    
    // 🔥 Sabhi clients fetch karo, userPermissions populate karo
    const clients = await Client.find(query)
      .select('name company email phone status _id contactPerson onboardingDate userPermissions')
      .populate('userPermissions.userId', 'name email role')
      .sort({ createdAt: -1 })
      .lean();
    
    let filteredClients = clients;
    
    // 🔥 CRITICAL FIX: Non-admin users ke liye filter
    if (user.role !== 'admin') {
      console.log('🔒 Filtering clients for non-admin user:', user.email);
      
      filteredClients = clients.filter(client => {
        // Agar client ke pass userPermissions nahi hai toh skip
        if (!client.userPermissions || !Array.isArray(client.userPermissions)) {
          console.log(`❌ Client ${client.name} has no permissions, skipping`);
          return false;
        }
        
        // Check if current user is assigned to this client
        const hasAccess = client.userPermissions.some(perm => {
          const userId = perm.userId?._id || perm.userId;
          return String(userId) === String(user.id);
        });
        
        if (hasAccess) {
          console.log(`✅ User ${user.email} has access to client: ${client.name}`);
        } else {
          console.log(`❌ User ${user.email} has NO access to client: ${client.name}`);
        }
        
        return hasAccess;
      });
      
      console.log(`🔒 Filtered to ${filteredClients.length} clients for user ${user.email}`);
    } else {
      console.log(`✅ Admin ${user.email} - Showing all ${clients.length} clients`);
    }
    
    res.json(filteredClients);
    
  } catch (error) {
    console.error('❌ Get clients error:', error);
    res.status(500).json({ message: error.message });
  }
};

// ✅ GET CLIENT BY ID - FIXED with access check
exports.getClientById = async (req, res) => {
  try {
    const { id } = req.params;
    const user = req.user;

    if (!isValidObjectId(id)) {
      return res.status(400).json({ message: 'Invalid client ID format' });
    }

    const query = { _id: id, isDeleted: false };
    
    const client = await Client.findOne(query)
      .select('name company email phone status contactPerson onboardingDate createdBy createdAt userPermissions')
      .populate('userPermissions.userId', 'name email role')
      .lean();
    
    if (!client) {
      return res.status(404).json({ message: 'Client not found' });
    }
    
    // ✅ CRITICAL FIX: Non-admin users ke liye access check
    if (user.role !== 'admin') {
      if (!client.userPermissions || !Array.isArray(client.userPermissions)) {
        console.log(`❌ Access denied: ${user.email} - No permissions for client ${client.name}`);
        return res.status(403).json({ message: 'Access denied. You are not assigned to this client.' });
      }
      
      const hasAccess = client.userPermissions.some(p => {
        const userId = p.userId?._id || p.userId;
        return String(userId) === String(user.id);
      });
      
      if (!hasAccess) {
        console.log(`❌ Access denied: ${user.email} - Not assigned to client ${client.name}`);
        return res.status(403).json({ message: 'Access denied. You are not assigned to this client.' });
      }
      
      console.log(`✅ Access granted: ${user.email} - Client ${client.name}`);
    }
    
    res.json(client);
  } catch (error) {
    console.error('❌ Get client by ID error:', error);
    res.status(500).json({ message: error.message });
  }
};

// ✅ Create client (Admin only)
exports.createClient = async (req, res) => {
  try {
    const { name, company, email, phone, status, contactPerson, onboardingDate, userPermissions } = req.body;

    if (req.user.role !== 'admin') {
      return res.status(403).json({ message: 'Only admin can create clients' });
    }

    const sanitized = {
      name: sanitizeString(name),
      company: sanitizeString(company),
      email: sanitizeString(email).toLowerCase(),
      phone: sanitizeString(phone),
      status: status || 'Active',
      contactPerson: sanitizeString(contactPerson || ''),
      onboardingDate: onboardingDate || '',
      userPermissions: userPermissions || [],
      createdBy: req.user.id
    };

    if (!sanitized.email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(sanitized.email)) {
      return res.status(400).json({ message: 'Valid email is required' });
    }

    const existingClient = await Client.findOne({ email: sanitized.email });
    if (existingClient) {
      return res.status(400).json({ message: 'Client with this email already exists' });
    }

    const client = new Client(sanitized);
    await client.save();
    
    const populatedClient = await Client.findById(client._id)
      .populate('userPermissions.userId', 'name email role');
    
    res.status(201).json(populatedClient);
  } catch (error) {
    console.error('❌ Create client error:', error);
    res.status(400).json({ message: error.message });
  }
};

// ✅ Update client (Admin only)
exports.updateClient = async (req, res) => {
  try {
    const { id } = req.params;

    if (req.user.role !== 'admin') {
      return res.status(403).json({ message: 'Only admin can update clients' });
    }

    if (!isValidObjectId(id)) {
      return res.status(400).json({ message: 'Invalid client ID format' });
    }

    const { name, company, email, phone, status, contactPerson, onboardingDate, userPermissions } = req.body;

    const updateData = {};
    if (name !== undefined) updateData.name = sanitizeString(name);
    if (company !== undefined) updateData.company = sanitizeString(company);
    if (email !== undefined) {
      const sanitizedEmail = sanitizeString(email).toLowerCase();
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(sanitizedEmail)) {
        return res.status(400).json({ message: 'Valid email is required' });
      }
      updateData.email = sanitizedEmail;
    }
    if (phone !== undefined) updateData.phone = sanitizeString(phone);
    if (status !== undefined) updateData.status = status;
    if (contactPerson !== undefined) updateData.contactPerson = sanitizeString(contactPerson);
    if (onboardingDate !== undefined) updateData.onboardingDate = onboardingDate;
    
    if (userPermissions !== undefined) {
      updateData.userPermissions = userPermissions
        .filter(p => p.userId && Array.isArray(p.folderPermissions))
        .map(p => ({
          userId: p.userId,
          folderPermissions: p.folderPermissions
        }));
    }

    const client = await Client.findOneAndUpdate(
      { _id: id, isDeleted: false },
      updateData,
      { new: true, runValidators: true }
    ).populate('userPermissions.userId', 'name email role');

    if (!client) {
      return res.status(404).json({ message: 'Client not found' });
    }
    res.json(client);
  } catch (error) {
    console.error('❌ Update client error:', error);
    res.status(400).json({ message: error.message });
  }
};

// ✅ Delete client (Admin only)
exports.deleteClient = async (req, res) => {
  try {
    const { id } = req.params;

    if (req.user.role !== 'admin') {
      return res.status(403).json({ message: 'Only admin can delete clients' });
    }

    if (!isValidObjectId(id)) {
      return res.status(400).json({ message: 'Invalid client ID format' });
    }

    const client = await Client.findOneAndUpdate(
      { _id: id, isDeleted: false },
      { isDeleted: true },
      { new: true }
    );

    if (!client) {
      return res.status(404).json({ message: 'Client not found' });
    }
    res.json({ message: 'Client deleted successfully' });
  } catch (error) {
    console.error('❌ Delete client error:', error);
    res.status(500).json({ message: error.message });
  }
};

// ✅ Dashboard stats
exports.getDashboardStats = async (req, res) => {
  try {
    const totalClients = await Client.countDocuments({ isDeleted: false });
    const activeClients = await Client.countDocuments({ 
      isDeleted: false,
      status: 'Active'
    });
    
    res.json({
      totalClients,
      activeCases: 89,
      documents: 1842,
      consultants: 18
    });
  } catch (error) {
    console.error('❌ Dashboard stats error:', error);
    res.status(500).json({ message: error.message });
  }
};