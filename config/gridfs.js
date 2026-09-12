const { GridFSBucket } = require('mongodb');
const mongoose = require('mongoose');

let gridFSBucket = null;

const initGridFS = () => {
  try {
    const db = mongoose.connection.db;
    if (!db) {
      throw new Error('MongoDB connection not established');
    }
    gridFSBucket = new GridFSBucket(db, { bucketName: 'uploads' });
    console.log('✅ GridFS initialized successfully');
    return gridFSBucket;
  } catch (error) {
    console.error('❌ GridFS init failed:', error);
    throw error;
  }
};

const getGridFS = () => {
  if (!gridFSBucket) {
    throw new Error('GridFS not initialized');
  }
  return gridFSBucket;
};

module.exports = { initGridFS, getGridFS };