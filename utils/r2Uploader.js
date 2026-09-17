// utils/r2Uploader.js
const crypto = require('crypto');
const path = require('path');
const { uploadToR2, isR2Configured } = require('../config/r2');

const generateR2Key = (folder, originalName) => {
  const ext = path.extname(originalName).toLowerCase();
  const hash = crypto.randomBytes(16).toString('hex');
  const timestamp = Date.now();
  const baseName = path.basename(originalName, ext)
    .replace(/[^\w\-]/g, '_')
    .slice(0, 50);
  return `${folder}/${timestamp}-${hash}-${baseName}${ext}`;
};

const uploadSingleFile = async (file, folder = 'uploads') => {
  if (!isR2Configured()) {
    throw new Error('R2 not configured');
  }

  const key = generateR2Key(folder, file.originalname);

  await uploadToR2({
    buffer: file.buffer,
    key,
    contentType: file.mimetype,
    metadata: {
      originalName: file.originalname,
      uploadedAt: new Date().toISOString(),
    },
  });

  return {
    key,
    url: `${process.env.R2_PUBLIC_URL}/${key}`,
    filename: file.originalname,
    size: file.size,
    mimeType: file.mimetype,
  };
};

const uploadMultipleFiles = async (files, folder = 'uploads') => {
  return Promise.all(files.map((f) => uploadSingleFile(f, folder)));
};

module.exports = { generateR2Key, uploadSingleFile, uploadMultipleFiles };
