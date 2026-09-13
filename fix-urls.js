// fix-urls.js — One-time script to fix fileUrl in database
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '.env') });

const mongoose = require('mongoose');
const Document = require('./models/Document');
const PDF = require('./models/PDF');

const run = async () => {
  try {
    console.log('🔌 Connecting to MongoDB...');
    await mongoose.connect(process.env.MONGO_URI);
    console.log('✅ MongoDB Connected\n');

    // ===== FIX DOCUMENTS =====
    console.log('📄 Checking documents collection...');
    
    // Use raw collection — validation skip karne ke liye
    const docsCollection = mongoose.connection.collection('documents');
    
    const badDocs = await docsCollection.find({ 
      fileUrl: { $regex: /^https?:\/\// } 
    }).toArray();

    console.log(`📊 Found ${badDocs.length} documents with full URL`);

    let fixedCount = 0;

    for (const doc of badDocs) {
      const match = doc.fileUrl.match(/\/(api\/.+)/);
      if (match) {
        const newUrl = '/' + match[1];
        await docsCollection.updateOne(
          { _id: doc._id },
          { $set: { fileUrl: newUrl } }
        );
        fixedCount++;
        if (fixedCount <= 5 || fixedCount % 10 === 0) {
          console.log(`  ✅ [${fixedCount}/${badDocs.length}] ${doc._id} → ${newUrl}`);
        }
      } else {
        console.log(`  ⚠️ Skipped (no /api/ found): ${doc.fileUrl}`);
      }
    }

    console.log(`✅ Fixed ${fixedCount} documents\n`);

    // ===== FIX PDFs =====
    console.log('📄 Checking pdfs collection...');
    
    const pdfsCollection = mongoose.connection.collection('pdfs');
    
    const badPdfs = await pdfsCollection.find({ 
      fileUrl: { $regex: /^https?:\/\// } 
    }).toArray();

    console.log(`📊 Found ${badPdfs.length} PDFs with full URL`);

    let fixedPdfs = 0;

    for (const pdf of badPdfs) {
      const match = pdf.fileUrl.match(/\/(api\/.+)/);
      if (match) {
        const newUrl = '/' + match[1];
        await pdfsCollection.updateOne(
          { _id: pdf._id },
          { $set: { fileUrl: newUrl } }
        );
        fixedPdfs++;
        console.log(`  ✅ Fixed: ${pdf._id} → ${newUrl}`);
      }
    }

    console.log(`✅ Fixed ${fixedPdfs} PDFs\n`);

    // ===== VERIFY =====
    const remainingDocs = await docsCollection.countDocuments({ 
      fileUrl: { $regex: /^https?:\/\// } 
    });
    const remainingPdfs = await pdfsCollection.countDocuments({ 
      fileUrl: { $regex: /^https?:\/\// } 
    });

    console.log('═══════════════════════════════════════');
    console.log(`✅ Remaining documents with full URL: ${remainingDocs}`);
    console.log(`✅ Remaining PDFs with full URL: ${remainingPdfs}`);
    console.log('═══════════════════════════════════════');
    console.log('🎉 Done!');

    process.exit(0);

  } catch (error) {
    console.error('❌ Error:', error.message);
    console.error(error);
    process.exit(1);
  }
};

run();