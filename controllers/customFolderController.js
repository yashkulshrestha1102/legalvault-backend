const CustomFolder = require('../models/CustomFolder');
const CustomFile = require('../models/CustomFile');
const Client = require('../models/Client');
const mongoose = require('mongoose');

const isValidObjectId = (id) => mongoose.Types.ObjectId.isValid(id);
const sanitizeString = (str) => str?.trim() || '';

// ✅ Helper: Check user has access to client's custom-folder
const checkClientAccess = async (user, clientId, requiredFolder = 'client-folder') => {
  if (user.role === 'admin') return true;

  const client = await Client.findById(clientId).select('userPermissions');
  if (!client) return false;

  const perm = client.userPermissions?.find(
    p => String(p.userId?._id || p.userId) === String(user.id)
  );

  if (!perm) return false;
  return perm.folderPermissions?.includes(requiredFolder);
};

// ✅ CREATE — Auto-create root folder (called from clientController on client create)
exports.createRootFolder = async (clientId, clientName, userId) => {
  try {
    const existing = await CustomFolder.findOne({
      clientId,
      isRoot: true,
      isDeleted: false
    });
    if (existing) return existing;

    const folder = new CustomFolder({
      name: clientName,
      clientId,
      parentFolderId: null,
      path: '/',
      isRoot: true,
      createdBy: userId
    });
    await folder.save();
    console.log('✅ Root custom folder created for client:', clientName);
    return folder;
  } catch (error) {
    console.error('❌ Error creating root folder:', error);
    throw error;
  }
};

// ✅ GET — Full folder tree for a client
exports.getFoldersByClient = async (req, res) => {
  try {
    const { clientId } = req.params;

    if (!isValidObjectId(clientId)) {
      return res.status(400).json({ message: 'Invalid client ID' });
    }

    const hasAccess = await checkClientAccess(req.user, clientId);
    if (!hasAccess) {
      return res.status(403).json({ message: 'Access denied to this folder' });
    }

    const folders = await CustomFolder.find({
      clientId,
      isDeleted: false
    }).sort({ createdAt: 1 }).lean();

    res.json(folders);
  } catch (error) {
    console.error('❌ Get folders error:', error);
    res.status(500).json({ message: error.message });
  }
};

// ✅ GET — Single folder by id
exports.getFolderById = async (req, res) => {
  try {
    const { id } = req.params;
    if (!isValidObjectId(id)) {
      return res.status(400).json({ message: 'Invalid folder ID' });
    }

    const folder = await CustomFolder.findOne({ _id: id, isDeleted: false });
    if (!folder) {
      return res.status(404).json({ message: 'Folder not found' });
    }

    const hasAccess = await checkClientAccess(req.user, folder.clientId);
    if (!hasAccess) {
      return res.status(403).json({ message: 'Access denied' });
    }

    res.json(folder);
  } catch (error) {
    console.error('❌ Get folder error:', error);
    res.status(500).json({ message: error.message });
  }
};

// ✅ POST — Create new folder
exports.createFolder = async (req, res) => {
  try {
    const { name, clientId, parentFolderId } = req.body;

    if (!name?.trim()) {
      return res.status(400).json({ message: 'Folder name is required' });
    }
    if (!isValidObjectId(clientId)) {
      return res.status(400).json({ message: 'Invalid client ID' });
    }

    const hasAccess = await checkClientAccess(req.user, clientId);
    if (!hasAccess) {
      return res.status(403).json({ message: 'Access denied' });
    }

    // Check duplicate name in same parent
    const duplicate = await CustomFolder.findOne({
      name: sanitizeString(name),
      clientId,
      parentFolderId: parentFolderId || null,
      isDeleted: false
    });
    if (duplicate) {
      return res.status(400).json({ message: 'Folder with this name already exists here' });
    }

    // Compute path
    let path = '/';
    if (parentFolderId) {
      if (!isValidObjectId(parentFolderId)) {
        return res.status(400).json({ message: 'Invalid parent folder ID' });
      }
      const parent = await CustomFolder.findOne({
        _id: parentFolderId,
        clientId,
        isDeleted: false
      });
      if (!parent) {
        return res.status(404).json({ message: 'Parent folder not found' });
      }
      path = `${parent.path === '/' ? '' : parent.path}/${parent.name}`;
    }

    const folder = new CustomFolder({
      name: sanitizeString(name),
      clientId,
      parentFolderId: parentFolderId || null,
      path,
      isRoot: false,
      createdBy: req.user.id
    });

    await folder.save();
    res.status(201).json(folder);
  } catch (error) {
    console.error('❌ Create folder error:', error);
    res.status(500).json({ message: error.message });
  }
};

// ✅ PUT — Rename folder (root can be renamed too)
exports.renameFolder = async (req, res) => {
  try {
    const { id } = req.params;
    const { name } = req.body;

    if (!name?.trim()) {
      return res.status(400).json({ message: 'New name is required' });
    }
    if (!isValidObjectId(id)) {
      return res.status(400).json({ message: 'Invalid folder ID' });
    }

    const folder = await CustomFolder.findOne({ _id: id, isDeleted: false });
    if (!folder) {
      return res.status(404).json({ message: 'Folder not found' });
    }

    const hasAccess = await checkClientAccess(req.user, folder.clientId);
    if (!hasAccess) {
      return res.status(403).json({ message: 'Access denied' });
    }

    // Duplicate check in same parent
    const duplicate = await CustomFolder.findOne({
      _id: { $ne: id },
      name: sanitizeString(name),
      clientId: folder.clientId,
      parentFolderId: folder.parentFolderId,
      isDeleted: false
    });
    if (duplicate) {
      return res.status(400).json({ message: 'Folder with this name already exists here' });
    }

    folder.name = sanitizeString(name);
    await folder.save();

    res.json(folder);
  } catch (error) {
    console.error('❌ Rename folder error:', error);
    res.status(500).json({ message: error.message });
  }
};

// ✅ DELETE — Soft delete folder + children + files (recursive)
exports.deleteFolder = async (req, res) => {
  try {
    const { id } = req.params;
    if (!isValidObjectId(id)) {
      return res.status(400).json({ message: 'Invalid folder ID' });
    }

    const folder = await CustomFolder.findOne({ _id: id, isDeleted: false });
    if (!folder) {
      return res.status(404).json({ message: 'Folder not found' });
    }

    // ✅ Root folder delete nahi ho sakta
    if (folder.isRoot) {
      return res.status(400).json({ message: 'Root folder cannot be deleted' });
    }

    const hasAccess = await checkClientAccess(req.user, folder.clientId);
    if (!hasAccess) {
      return res.status(403).json({ message: 'Access denied' });
    }

    // ✅ Recursive soft delete — collect all descendant IDs
    const toDelete = [folder._id];
    const queue = [folder._id];

    while (queue.length > 0) {
      const parentId = queue.shift();
      const children = await CustomFolder.find({
        parentFolderId: parentId,
        isDeleted: false
      }).select('_id');

      for (const child of children) {
        toDelete.push(child._id);
        queue.push(child._id);
      }
    }

    const now = new Date();

    // Soft delete all folders
    await CustomFolder.updateMany(
      { _id: { $in: toDelete } },
      { isDeleted: true, deletedAt: now, deletedBy: req.user.id }
    );

    // Soft delete all files inside these folders
    const fileResult = await CustomFile.updateMany(
      { folderId: { $in: toDelete }, isDeleted: false },
      { isDeleted: true, deletedAt: now, deletedBy: req.user.id }
    );

    res.json({
      message: 'Folder deleted successfully',
      foldersDeleted: toDelete.length,
      filesDeleted: fileResult.modifiedCount
    });
  } catch (error) {
    console.error('❌ Delete folder error:', error);
    res.status(500).json({ message: error.message });
  }
};