// scripts/backfillFileTypes.js
// ✅ One-time script to fix fileType for old uploaded files

const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });

const mongoose = require('mongoose');
const CustomFile = require('../models/CustomFile');
const Document = require('../models/Document');
const { getFileType } = require('../utils/fileTypeDetector');

const run = async () => {
  try {
    console.log('🔌 Connecting to MongoDB...');
    await mongoose.connect(process.env.MONGO_URI);
    console.log('✅ Connected\n');

    // ═══════════════════════════════════════════
    // 1️⃣ CUSTOM FILES
    // ═══════════════════════════════════════════
    console.log('═══════════════════════════════════════');
    console.log('📁 Processing CustomFile collection');
    console.log('═══════════════════════════════════════');

    const customFiles = await CustomFile.find({ isDeleted: false });
    console.log(`📊 Found ${customFiles.length} custom files\n`);

    let updated = 0;
    let skipped = 0;
    let errors = 0;

    for (const file of customFiles) {
      try {
        const newType = getFileType(file.mimeType);

        if (newType !== file.fileType) {
          const oldType = file.fileType;
          file.fileType = newType;
          await file.save();
          console.log(`  ✅ ${file.filename}: ${oldType} → ${newType}`);
          updated++;
        } else {
          skipped++;
        }
      } catch (err) {
        console.error(`  ❌ ${file.filename}:`, err.message);
        errors++;
      }
    }

    console.log(`\n📊 Custom Files Summary:`);
    console.log(`   ✅ Updated: ${updated}`);
    console.log(`   ⏭️  Skipped: ${skipped}`);
    console.log(`   ❌ Errors:  ${errors}\n`);

    // ═══════════════════════════════════════════
    // 2️⃣ DOCUMENTS (Client Repository)
    // ═══════════════════════════════════════════
    console.log('═══════════════════════════════════════');
    console.log('📁 Processing Document collection');
    console.log('═══════════════════════════════════════');

    const documents = await Document.find({ isDeleted: false });
    console.log(`📊 Found ${documents.length} documents\n`);

    let docsUpdated = 0;
    let docsSkipped = 0;
    let docsErrors = 0;

    for (const doc of documents) {
      try {
        const newType = getFileType(doc.mimeType);

        if (newType !== doc.fileType) {
          const oldType = doc.fileType;
          doc.fileType = newType;
          await doc.save();
          console.log(`  ✅ ${doc.filename}: ${oldType} → ${newType}`);
          docsUpdated++;
        } else {
          docsSkipped++;
        }
      } catch (err) {
        console.error(`  ❌ ${doc.filename}:`, err.message);
        docsErrors++;
      }
    }

    console.log(`\n📊 Documents Summary:`);
    console.log(`   ✅ Updated: ${docsUpdated}`);
    console.log(`   ⏭️  Skipped: ${docsSkipped}`);
    console.log(`   ❌ Errors:  ${docsErrors}\n`);

    // ═══════════════════════════════════════════
    // FINAL SUMMARY
    // ═══════════════════════════════════════════
    console.log('═══════════════════════════════════════');
    console.log('🎉 BACKFILL COMPLETE');
    console.log('═══════════════════════════════════════');
    console.log(`📁 Custom Files:  ${updated} updated, ${skipped} skipped, ${errors} errors`);
    console.log(`📄 Documents:     ${docsUpdated} updated, ${docsSkipped} skipped, ${docsErrors} errors`);
    console.log('═══════════════════════════════════════\n');

    process.exit(0);
  } catch (error) {
    console.error('\n❌ Fatal error:', error.message);
    console.error(error);
    process.exit(1);
  }
};

run();