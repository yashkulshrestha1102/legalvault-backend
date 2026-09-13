const CustomFile = require('../models/CustomFile');
const CustomFolder = require('../models/CustomFolder');
const Client = require('../models/Client');
const { getGridFS } = require('../config/gridfs');
const { getFileType } = require('../utils/fileTypeDetector');
const { ObjectId } = require('mongodb');
const mongoose = require('mongoose');
const archiver = require('archiver');


const createArchive = archiver.create || archiver;
const isValidObjectId = (id) => mongoose.Types.ObjectId.isValid(id);

// ✅ Helper: access check
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

// ✅ UPLOAD — Bulk upload files into a folder
exports.uploadFiles = async (req, res) => {
  try {
    const { folderId, clientId } = req.body;

    if (!req.files || req.files.length === 0) {
      return res.status(400).json({ message: 'No files uploaded' });
    }
    if (!isValidObjectId(folderId)) {
      return res.status(400).json({ message: 'Invalid folder ID' });
    }
    if (!isValidObjectId(clientId)) {
      return res.status(400).json({ message: 'Invalid client ID' });
    }

    const folder = await CustomFolder.findOne({
      _id: folderId,
      clientId,
      isDeleted: false
    });
    if (!folder) {
      return res.status(404).json({ message: 'Folder not found' });
    }

    const hasAccess = await checkClientAccess(req.user, clientId);
    if (!hasAccess) {
      return res.status(403).json({ message: 'Access denied' });
    }

    if (mongoose.connection.readyState !== 1) {
      return res.status(500).json({ message: 'Database not connected' });
    }

    const bucket = getGridFS();
    if (!bucket) return res.status(500).json({ message: 'GridFS not initialized' });

    const uploadedFiles = [];

    for (const file of req.files) {
      // Upload to GridFS
      const uploadStream = bucket.openUploadStream(file.originalname, {
        contentType: file.mimetype,
        metadata: {
          uploadedBy: req.user.id,
          clientId,
          folderId,
          uploadDate: new Date()
        }
      });

      uploadStream.write(file.buffer);
      uploadStream.end();

      const fileId = await new Promise((resolve, reject) => {
        uploadStream.on('finish', () => resolve(uploadStream.id));
        uploadStream.on('error', reject);
      });

      const doc = new CustomFile({
        filename: file.originalname,
        originalName: file.originalname,
        mimeType: file.mimetype,
        fileType: getFileType(file.mimetype),
        fileSize: file.size,
        fileId,
        folderId,
        clientId,
        uploadedBy: req.user.id
      });
      await doc.save();

      uploadedFiles.push({
        id: doc._id,
        filename: doc.filename,
        fileType: doc.fileType,
        mimeType: doc.mimeType,
        fileSize: doc.fileSize,
        fileId: doc.fileId,
        url: `/api/custom-files/file/${fileId}`
      });
    }

    res.json({
      message: `${uploadedFiles.length} file(s) uploaded successfully`,
      files: uploadedFiles
    });
  } catch (error) {
    console.error('❌ Upload error:', error);
    res.status(500).json({ message: error.message });
  }
};

// ✅ GET — Files inside a folder
exports.getFilesByFolder = async (req, res) => {
  try {
    const { folderId } = req.params;
    const { search } = req.query;

    if (!isValidObjectId(folderId)) {
      return res.status(400).json({ message: 'Invalid folder ID' });
    }

    const folder = await CustomFolder.findOne({ _id: folderId, isDeleted: false });
    if (!folder) {
      return res.status(404).json({ message: 'Folder not found' });
    }

    const hasAccess = await checkClientAccess(req.user, folder.clientId);
    if (!hasAccess) {
      return res.status(403).json({ message: 'Access denied' });
    }

    const filter = { folderId, isDeleted: false };
    if (search?.trim()) {
      filter.filename = { $regex: search.trim(), $options: 'i' };
    }

    const files = await CustomFile.find(filter).sort({ createdAt: -1 });

    // Add virtual URL
    const filesWithUrl = files.map(f => ({
      ...f.toObject(),
      url: `/api/custom-files/file/${f.fileId}`
    }));

    res.json(filesWithUrl);
  } catch (error) {
    console.error('❌ Get files error:', error);
    res.status(500).json({ message: error.message });
  }
};

// ✅ SEARCH — Search across all folders of a client
exports.searchFiles = async (req, res) => {
  try {
    const { clientId } = req.params;
    const { q } = req.query;

    if (!isValidObjectId(clientId)) {
      return res.status(400).json({ message: 'Invalid client ID' });
    }
    if (!q?.trim()) {
      return res.json({ folders: [], files: [] });
    }

    const hasAccess = await checkClientAccess(req.user, clientId);
    if (!hasAccess) {
      return res.status(403).json({ message: 'Access denied' });
    }

    const searchRegex = { $regex: q.trim(), $options: 'i' };

    const [folders, files] = await Promise.all([
      CustomFolder.find({
        clientId,
        isDeleted: false,
        isRoot: false,
        name: searchRegex
      }).limit(50),
      CustomFile.find({
        clientId,
        isDeleted: false,
        filename: searchRegex
      }).limit(100)
    ]);

    res.json({
      folders,
      files: files.map(f => ({
        ...f.toObject(),
        url: `/api/custom-files/file/${f.fileId}`
      }))
    });
  } catch (error) {
    console.error('❌ Search error:', error);
    res.status(500).json({ message: error.message });
  }
};

// ✅ VIEW/DOWNLOAD — Stream file from GridFS
exports.streamFile = async (req, res) => {
  try {
    const { fileId } = req.params;
    if (!isValidObjectId(fileId)) {
      return res.status(400).json({ message: 'Invalid file ID' });
    }

    const fileDoc = await CustomFile.findOne({ fileId, isDeleted: false });
    if (!fileDoc) {
      return res.status(404).json({ message: 'File not found' });
    }

    const hasAccess = await checkClientAccess(req.user, fileDoc.clientId);
    if (!hasAccess) {
      return res.status(403).json({ message: 'Access denied' });
    }

    const bucket = getGridFS();
    if (!bucket) return res.status(500).json({ message: 'GridFS not available' });

    // ?download=1 forces download; otherwise inline
    const isDownload = req.query.download === '1';
    const disposition = isDownload ? 'attachment' : 'inline';

    const downloadStream = bucket.openDownloadStream(new ObjectId(fileId));

    downloadStream.on('file', (file) => {
      res.setHeader('Content-Type', file.contentType || fileDoc.mimeType);
      res.setHeader('Content-Length', file.length);
      res.setHeader(
        'Content-Disposition',
        `${disposition}; filename="${encodeURIComponent(fileDoc.filename)}"`
      );
    });

    downloadStream.on('error', (error) => {
      console.error('Stream error:', error);
      if (!res.headersSent) {
        res.status(500).json({ message: 'Error streaming file' });
      }
    });

    downloadStream.pipe(res);
  } catch (error) {
    console.error('❌ Stream error:', error);
    if (!res.headersSent) {
      res.status(500).json({ message: error.message });
    }
  }
};

// ✅ RENAME file
exports.renameFile = async (req, res) => {
  try {
    const { id } = req.params;
    const { newName } = req.body;

    if (!newName?.trim()) {
      return res.status(400).json({ message: 'New name is required' });
    }
    if (!isValidObjectId(id)) {
      return res.status(400).json({ message: 'Invalid file ID' });
    }

    const file = await CustomFile.findOne({ _id: id, isDeleted: false });
    if (!file) return res.status(404).json({ message: 'File not found' });

    const hasAccess = await checkClientAccess(req.user, file.clientId);
    if (!hasAccess) return res.status(403).json({ message: 'Access denied' });

    file.filename = newName.trim();
    file.originalName = newName.trim();
    await file.save();

    res.json({ message: 'File renamed', file });
  } catch (error) {
    console.error('❌ Rename file error:', error);
    res.status(500).json({ message: error.message });
  }
};

// ✅ DELETE file (soft)
exports.deleteFile = async (req, res) => {
  try {
    const { id } = req.params;
    if (!isValidObjectId(id)) {
      return res.status(400).json({ message: 'Invalid file ID' });
    }

    const file = await CustomFile.findOne({ _id: id, isDeleted: false });
    if (!file) return res.status(404).json({ message: 'File not found' });

    const hasAccess = await checkClientAccess(req.user, file.clientId);
    if (!hasAccess) return res.status(403).json({ message: 'Access denied' });

    file.isDeleted = true;
    file.deletedAt = new Date();
    file.deletedBy = req.user.id;
    await file.save();

    res.json({ message: 'File deleted successfully' });
  } catch (error) {
    console.error('❌ Delete file error:', error);
    res.status(500).json({ message: error.message });
  }
};

// ✅ ZIP DOWNLOAD — Download entire folder as ZIP (with subfolders)
exports.downloadFolderZip = async (req, res) => {
  try {
    const { folderId } = req.params;
    if (!isValidObjectId(folderId)) {
      return res.status(400).json({ message: 'Invalid folder ID' });
    }

    const rootFolder = await CustomFolder.findOne({
      _id: folderId,
      isDeleted: false
    });
    if (!rootFolder) return res.status(404).json({ message: 'Folder not found' });

    const hasAccess = await checkClientAccess(req.user, rootFolder.clientId);
    if (!hasAccess) return res.status(403).json({ message: 'Access denied' });

    const bucket = getGridFS();
    if (!bucket) return res.status(500).json({ message: 'GridFS not available' });

    // Collect all subfolders recursively
    const allFolders = [rootFolder];
    const queue = [rootFolder._id];

    while (queue.length > 0) {
      const parentId = queue.shift();
      const children = await CustomFolder.find({
        parentFolderId: parentId,
        isDeleted: false
      });
      for (const child of children) {
        allFolders.push(child);
        queue.push(child._id);
      }
    }

    const folderIds = allFolders.map(f => f._id);
    const files = await CustomFile.find({
      folderId: { $in: folderIds },
      isDeleted: false
    });

    // Sanitize filename for header
    const safeName = rootFolder.name.replace(/[^\w\-\s]/g, '').trim() || 'folder';
    const zipName = `${safeName}.zip`;

    res.setHeader('Content-Type', 'application/zip');
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="${encodeURIComponent(zipName)}"`
    );

const archive = createArchive('zip', { zlib: { level: 6 } });

    archive.on('warning', (err) => {
      if (err.code === 'ENOENT') console.warn('Zip warning:', err);
      else throw err;
    });
    archive.on('error', (err) => {
      console.error('Archive error:', err);
      if (!res.headersSent) res.status(500).end();
    });

    archive.pipe(res);

    // Build folder map: _id -> relative path
    const pathMap = new Map();
    pathMap.set(rootFolder._id.toString(), ''); // root inside zip is empty prefix

    // Sort folders so parents come first
    allFolders.sort((a, b) => (a.path?.length || 0) - (b.path?.length || 0));

    for (const folder of allFolders) {
      if (folder._id.toString() === rootFolder._id.toString()) continue;

      const parentId = folder.parentFolderId?.toString();
      const parentPath = pathMap.get(parentId) || '';
      const currentPath = parentPath ? `${parentPath}/${folder.name}` : folder.name;
      pathMap.set(folder._id.toString(), currentPath);
    }

    // Add files to archive
    for (const file of files) {
      const folderPath = pathMap.get(file.folderId.toString()) || '';
      const archivePath = folderPath
        ? `${folderPath}/${file.filename}`
        : file.filename;

      try {
        const stream = bucket.openDownloadStream(new ObjectId(file.fileId));
        archive.append(stream, { name: archivePath });
      } catch (err) {
        console.error(`Failed to append ${file.filename}:`, err.message);
      }
    }

    // If no files, add a placeholder README
    if (files.length === 0) {
      archive.append('This folder is empty.', { name: '_EMPTY.txt' });
    }

    await archive.finalize();
  } catch (error) {
    console.error('❌ ZIP download error:', error);
    if (!res.headersSent) {
      res.status(500).json({ message: error.message });
    }
  }
};