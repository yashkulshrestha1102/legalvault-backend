const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });

const mongoose = require('mongoose');
const Client = require('../models/Client');
const CustomFolder = require('../models/CustomFolder');

const run = async () => {
  try {
    console.log('🔌 Connecting to MongoDB...');
    await mongoose.connect(process.env.MONGO_URI);
    console.log('✅ Connected\n');

    const clients = await Client.find({ isDeleted: false });
    console.log(`📊 Found ${clients.length} clients\n`);

    let created = 0;
    let skipped = 0;

    for (const client of clients) {
      const existing = await CustomFolder.findOne({
        clientId: client._id,
        isRoot: true,
        isDeleted: false
      });

      if (existing) {
        console.log(`⏭️  Skipped (already has root): ${client.name}`);
        skipped++;
        continue;
      }

      await CustomFolder.create({
        name: client.name,
        clientId: client._id,
        parentFolderId: null,
        path: '/',
        isRoot: true,
        createdBy: client.createdBy || null
      });

      console.log(`✅ Created root folder: ${client.name}`);
      created++;
    }

    console.log('\n═══════════════════════════════════════');
    console.log(`✅ Created: ${created}`);
    console.log(`⏭️  Skipped: ${skipped}`);
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