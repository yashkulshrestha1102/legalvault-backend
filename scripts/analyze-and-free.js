require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });
const mongoose = require('mongoose');

const DRY_RUN = process.env.DRY_RUN !== 'false';

(async () => {
  await mongoose.connect(process.env.MONGO_URI);
  console.log('Connected to MongoDB\n');

  console.log('=== MONGO STORAGE ANALYSIS ===\n');

  const docsActive = await mongoose.connection.db.collection('documents').countDocuments({ isDeleted: false });
  const docsDeleted = await mongoose.connection.db.collection('documents').countDocuments({ isDeleted: true });
  const cfActive = await mongoose.connection.db.collection('customfiles').countDocuments({ isDeleted: false });
  const cfDeleted = await mongoose.connection.db.collection('customfiles').countDocuments({ isDeleted: true });

  console.log('DOCUMENTS:');
  console.log('  Active:', docsActive, '| Soft-deleted:', docsDeleted);
  console.log('');
  console.log('CUSTOMFILES:');
  console.log('  Active:', cfActive, '| Soft-deleted:', cfDeleted);
  console.log('');

  const deletedDocs = await mongoose.connection.db.collection('documents').find({ isDeleted: true }).toArray();
  const deletedCF = await mongoose.connection.db.collection('customfiles').find({ isDeleted: true }).toArray();

  const fileIdsToDelete = [
    ...deletedDocs.map(d => d.fileId),
    ...deletedCF.map(f => f.fileId),
  ].filter(Boolean);

  console.log('Soft-deleted files (total):', fileIdsToDelete.length);

  const fsFiles = await mongoose.connection.db.collection('uploads.files')
    .find({ _id: { $in: fileIdsToDelete } })
    .toArray();

  const totalSize = fsFiles.reduce((sum, f) => sum + (f.length || 0), 0);

  console.log('GridFS files found:', fsFiles.length);
  console.log('Size to free:', (totalSize / 1024 / 1024).toFixed(2), 'MB');
  console.log('');
  console.log('DRY RUN:', DRY_RUN);

  if (!DRY_RUN && fsFiles.length > 0) {
    console.log('\n=== DELETING SOFT-DELETED FILES FROM GRIDFS ===\n');
    const { GridFSBucket } = require('mongodb');
    const bucket = new GridFSBucket(mongoose.connection.db, { bucketName: 'uploads' });

    let deleted = 0, failed = 0;
    for (const file of fsFiles) {
      try {
        await bucket.delete(file._id);
        deleted++;
        if (deleted % 20 === 0) console.log('  Deleted:', deleted + '/' + fsFiles.length);
      } catch (err) {
        console.error('  Failed:', file._id, err.message);
        failed++;
      }
    }
    console.log('\nDone. Deleted:', deleted, '| Failed:', failed);
    console.log('Check MongoDB Atlas in 1-2 minutes.');
  } else if (DRY_RUN) {
    console.log('\nThis was a DRY RUN. No files were deleted.');
  }

  process.exit(0);
})().catch(err => {
  console.error('Error:', err);
  process.exit(1);
});
