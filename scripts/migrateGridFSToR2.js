// scripts/migrateGridFSToR2.js
// One-time migration: GridFS -> Cloudflare R2
require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });
const mongoose = require('mongoose');
const { GridFSBucket, ObjectId } = require('mongodb');
const { uploadToR2 } = require('../config/r2');
const Document = require('../models/Document');
const CustomFile = require('../models/CustomFile');

const DRY_RUN = process.env.DRY_RUN !== 'false';

const run = async () => {
  console.log('===========================================');
  console.log('GridFS to R2 Migration');
  console.log('DRY RUN:', DRY_RUN);
  console.log('===========================================');

  await mongoose.connect(process.env.MONGO_URI);
  console.log('Connected to MongoDB\n');

  const bucket = new GridFSBucket(mongoose.connection.db, { bucketName: 'uploads' });

  // ==========================================
  // PART 1: Documents
  // ==========================================
  console.log('===========================================');
  console.log('PART 1: Migrating Documents');
  console.log('===========================================');

  const documents = await Document.find({
    isDeleted: false,
    storageType: { $ne: 'r2' },
    fileId: { $exists: true, $ne: null },
  });

  console.log('Documents to migrate:', documents.length);

  let docSuccess = 0, docFailed = 0, docSkipped = 0;

  for (const doc of documents) {
    try {
      console.log(`\n[${docSuccess + docFailed + 1}/${documents.length}] ${doc.filename}`);

      const chunks = [];
      const stream = bucket.openDownloadStream(doc.fileId);

      await new Promise((resolve, reject) => {
        stream.on('data', (chunk) => chunks.push(chunk));
        stream.on('end', resolve);
        stream.on('error', reject);
      });

      const buffer = Buffer.concat(chunks);
      const key = `clients/${doc.clientId}/documents/${doc._id}-${doc.filename}`;

      if (DRY_RUN) {
        console.log(`  [DRY RUN] Would upload: ${key} (${buffer.length} bytes)`);
        docSkipped++;
        continue;
      }

      await uploadToR2({
        buffer,
        key,
        contentType: doc.mimeType || 'application/octet-stream',
        metadata: { originalName: doc.originalName || doc.filename, migratedFrom: 'gridfs' },
      });

      // Update doc with R2 info
      doc.r2Key = key;
      doc.storageType = 'r2';
      doc.fileUrl = `${process.env.R2_PUBLIC_URL}/${key}`;
      await doc.save();

      // Delete from GridFS
      await bucket.delete(doc.fileId);

      console.log(`  SUCCESS: ${key}`);
      docSuccess++;
    } catch (err) {
      console.error(`  FAILED: ${err.message}`);
      docFailed++;
    }
  }

  console.log('\n--- Documents Summary ---');
  console.log('Success:', docSuccess, '| Failed:', docFailed, '| Skipped:', docSkipped);

  // ==========================================
  // PART 2: CustomFiles
  // ==========================================
  console.log('\n===========================================');
  console.log('PART 2: Migrating CustomFiles');
  console.log('===========================================');

  const customFiles = await CustomFile.find({
    isDeleted: false,
    storageType: { $ne: 'r2' },
    fileId: { $exists: true, $ne: null },
  });

  console.log('CustomFiles to migrate:', customFiles.length);

  let cfSuccess = 0, cfFailed = 0, cfSkipped = 0;

  for (const file of customFiles) {
    try {
      console.log(`\n[${cfSuccess + cfFailed + 1}/${customFiles.length}] ${file.filename}`);

      const chunks = [];
      const stream = bucket.openDownloadStream(file.fileId);

      await new Promise((resolve, reject) => {
        stream.on('data', (chunk) => chunks.push(chunk));
        stream.on('end', resolve);
        stream.on('error', reject);
      });

      const buffer = Buffer.concat(chunks);
      const key = `clients/${file.clientId}/folders/${file.folderId}/${file._id}-${file.filename}`;

      if (DRY_RUN) {
        console.log(`  [DRY RUN] Would upload: ${key} (${buffer.length} bytes)`);
        cfSkipped++;
        continue;
      }

      await uploadToR2({
        buffer,
        key,
        contentType: file.mimeType || 'application/octet-stream',
        metadata: { originalName: file.originalName || file.filename, migratedFrom: 'gridfs' },
      });

      file.r2Key = key;
      file.storageType = 'r2';
      await file.save();

      await bucket.delete(file.fileId);

      console.log(`  SUCCESS: ${key}`);
      cfSuccess++;
    } catch (err) {
      console.error(`  FAILED: ${err.message}`);
      cfFailed++;
    }
  }

  console.log('\n--- CustomFiles Summary ---');
  console.log('Success:', cfSuccess, '| Failed:', cfFailed, '| Skipped:', cfSkipped);

  // ==========================================
  // FINAL SUMMARY
  // ==========================================
  console.log('\n===========================================');
  console.log('MIGRATION COMPLETE');
  console.log('===========================================');
  console.log('Documents migrated:', docSuccess);
  console.log('CustomFiles migrated:', cfSuccess);
  console.log('Total migrated:', docSuccess + cfSuccess);
  console.log('Total failed:', docFailed + cfFailed);

  if (DRY_RUN) {
    console.log('\nTo actually migrate:');
    console.log('  $env:DRY_RUN="false"');
    console.log('  node scripts\\migrateGridFSToR2.js');
  }

  process.exit(0);
};

run().catch((err) => {
  console.error('Migration failed:', err);
  process.exit(1);
});
