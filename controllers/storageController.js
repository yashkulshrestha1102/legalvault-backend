// controllers/storageController.js
const { uploadMultipleFiles } = require('../utils/r2Uploader');
const { getGridFS } = require('../config/gridfs');
const { isR2Configured } = require('../config/r2');
const { getFileType } = require('../utils/fileTypeDetector');

const getStorageBackend = () => {
  const backend = process.env.STORAGE_BACKEND || 'gridfs';
  if (backend === 'r2' && !isR2Configured()) {
    console.warn('R2 selected but not configured, falling back to gridfs');
    return 'gridfs';
  }
  return backend;
};

const uploadToR2Storage = async (files, folder) => {
  const uploaded = await uploadMultipleFiles(files, folder);
  return uploaded.map((f) => ({
    storageType: 'r2',
    r2Key: f.key,
    fileUrl: f.url,
    filename: f.filename,
    originalName: f.filename,
    fileSize: f.size,
    mimeType: f.mimeType,
    fileType: getFileType(f.mimeType),
    fileId: null,
  }));
};

const uploadToGridFSStorage = async (files, metadata = {}) => {
  const bucket = getGridFS();
  if (!bucket) throw new Error('GridFS not initialized');

  const results = [];
  for (const file of files) {
    const uploadStream = bucket.openUploadStream(file.originalname, {
      contentType: file.mimetype,
      metadata: { ...metadata, uploadDate: new Date() },
    });

    uploadStream.write(file.buffer);
    uploadStream.end();

    const fileId = await new Promise((resolve, reject) => {
      uploadStream.on('finish', () => resolve(uploadStream.id));
      uploadStream.on('error', reject);
    });

    results.push({
      storageType: 'gridfs',
      fileId,
      r2Key: null,
      fileUrl: `/api/documents/file/${fileId}`,
      filename: file.originalname,
      originalName: file.originalname,
      fileSize: file.size,
      mimeType: file.mimetype,
      fileType: getFileType(file.mimetype),
    });
  }
  return results;
};

const uploadFilesSmart = async (files, { folder, metadata, gridfsUrlPrefix }) => {
  const backend = getStorageBackend();
  console.log(`Uploading ${files.length} file(s) to ${backend}`);

  if (backend === 'r2') {
    return uploadToR2Storage(files, folder);
  }

  if (backend === 'gridfs') {
    const results = await uploadToGridFSStorage(files, metadata);
    if (gridfsUrlPrefix) {
      results.forEach(r => { r.fileUrl = `${gridfsUrlPrefix}/${r.fileId}`; });
    }
    return results;
  }

  throw new Error(`Unknown storage backend: ${backend}`);
};

const deleteFileSmart = async (doc) => {
  const { deleteFromR2 } = require('../config/r2');
  const { getGridFS } = require('../config/gridfs');

  if (doc.storageType === 'r2' && doc.r2Key) {
    try {
      await deleteFromR2(doc.r2Key);
      console.log('Deleted from R2:', doc.r2Key);
    } catch (err) {
      console.error('R2 delete failed:', err.message);
    }
  } else if (doc.storageType === 'gridfs' && doc.fileId) {
    try {
      const bucket = getGridFS();
      if (bucket) await bucket.delete(doc.fileId);
      console.log('Deleted from GridFS:', doc.fileId);
    } catch (err) {
      console.error('GridFS delete failed:', err.message);
    }
  }
};

module.exports = {
  uploadFilesSmart,
  deleteFileSmart,
  getStorageBackend,
};
