require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });
const mongoose = require('mongoose');
const { GridFSBucket } = require('mongodb');
const fs = require('fs');
const path = require('path');

const DRY_RUN = process.env.DRY_RUN !== 'false';

const COLLECTIONS_WITH_PDFS_ARRAY = [
  'registrations',
  'contracts',
  'policies',
  'corporatesecretariats',
  'gsts',
  'incometaxes',
  'hrs',
  'financials',
];

(async () => {
  try {
    console.log('===========================================');
    console.log('CLEAN ORPHAN PDF RECORDS');
    console.log('DRY RUN:', DRY_RUN);
    console.log('===========================================');

    await mongoose.connect(process.env.MONGO_URI);
    console.log('Connected to MongoDB\n');

    const bucket = new GridFSBucket(mongoose.connection.db, { bucketName: 'uploads' });

    // STEP 1: Find orphan PDFs
    console.log('--- STEP 1: Finding orphan PDFs ---\n');

    const pdfsCollection = mongoose.connection.db.collection('pdfs');
    const allPdfs = await pdfsCollection.find({}).toArray();
    console.log('Total PDF records:', allPdfs.length);

    const orphanPdfs = [];
    const validPdfIds = new Set();

    for (const pdf of allPdfs) {
      // Skip R2 PDFs (they're valid)
      if (pdf.storageType === 'r2' || pdf.r2Key) {
        validPdfIds.add(pdf._id.toString());
        continue;
      }

      // Check GridFS
      if (!pdf.fileId) {
        console.log(`  [Orphan] No fileId: ${pdf.filename}`);
        orphanPdfs.push(pdf);
        continue;
      }

      try {
        const files = await bucket.find({ _id: pdf.fileId }).toArray();
        if (files.length === 0) {
          console.log(`  [Orphan] ${pdf.filename}`);
          orphanPdfs.push(pdf);
        } else {
          validPdfIds.add(pdf.fileId.toString());
        }
      } catch (err) {
        console.error(`  Error: ${pdf._id}:`, err.message);
        orphanPdfs.push(pdf);
      }
    }

    console.log('');
    console.log('Orphan PDF records:', orphanPdfs.length);
    console.log('Valid PDF records:', validPdfIds.size);

    // STEP 1.5: Backup orphan PDFs to JSON
    if (orphanPdfs.length > 0) {
      const backupPath = path.join(__dirname, '..', 'backup-orphan-pdfs.json');
      fs.writeFileSync(backupPath, JSON.stringify(orphanPdfs, null, 2));
      console.log(`\n[BACKUP] Saved ${orphanPdfs.length} records to: ${backupPath}`);
    }

    // STEP 2: Delete orphan PDF records
    if (!DRY_RUN && orphanPdfs.length > 0) {
      console.log('\n--- STEP 2: Deleting orphan PDF records ---\n');

      let deleted = 0;
      for (const pdf of orphanPdfs) {
        await pdfsCollection.deleteOne({ _id: pdf._id });
        deleted++;
        if (deleted % 20 === 0) console.log(`  Deleted: ${deleted}/${orphanPdfs.length}`);
      }
      console.log(`\nDeleted ${deleted} orphan PDF records`);
    } else if (DRY_RUN) {
      console.log(`\n[DRY RUN] Would delete ${orphanPdfs.length} orphan PDF records`);
    }

    // STEP 3: Clean references in array collections
    console.log('\n--- STEP 3: Cleaning references in array collections ---\n');

    const orphanIds = new Set(orphanPdfs.map(p => p._id.toString()));
    const orphanFileIds = new Set(
      orphanPdfs.map(p => p.fileId ? p.fileId.toString() : null).filter(Boolean)
    );

    let totalRefsCleaned = 0;

    for (const collName of COLLECTIONS_WITH_PDFS_ARRAY) {
      try {
        const collection = mongoose.connection.db.collection(collName);
        const docs = await collection.find({}).toArray();
        let cleanedInColl = 0;

        for (const doc of docs) {
          const arr = doc.pdfs;
          if (!Array.isArray(arr) || arr.length === 0) continue;

          const newArr = arr.filter((url) => {
            const match = String(url).match(/\/api\/pdfs\/([a-f0-9]{24})/);
            if (!match) return true;

            const refPdfId = match[1];
            if (orphanIds.has(refPdfId)) return false;
            if (orphanFileIds.has(refPdfId)) return false;
            return true;
          });

          if (newArr.length !== arr.length) {
            if (!DRY_RUN) {
              await collection.updateOne(
                { _id: doc._id },
                { $set: { pdfs: newArr } }
              );
            }
            console.log(`  ${DRY_RUN ? '[DRY]' : '[CLEANED]'} ${collName}/${doc._id}: ${arr.length} -> ${newArr.length}`);
            cleanedInColl++;
            totalRefsCleaned++;
          }
        }

        if (cleanedInColl === 0) {
          console.log(`  [${collName}] No broken refs`);
        }
      } catch (err) {
        console.error(`  Error in ${collName}:`, err.message);
      }
    }

    // SUMMARY
    console.log('\n===========================================');
    console.log('SUMMARY');
    console.log('===========================================');
    console.log('Orphan PDF records found:', orphanPdfs.length);
    console.log('Array references cleaned:', totalRefsCleaned);
    console.log('DRY RUN:', DRY_RUN);

    if (DRY_RUN) {
      console.log('\nTo actually clean:');
      console.log('  $env:DRY_RUN="false"');
      console.log('  node scripts\\clean-orphan-pdfs.js');
    }

    process.exit(0);
  } catch (err) {
    console.error('Fatal error:', err);
    process.exit(1);
  }
})();