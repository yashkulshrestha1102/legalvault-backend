// scripts/fixUserEmailIndex.js
// One-time script: Fix User email index for soft-deleted users
require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });
const mongoose = require('mongoose');

(async () => {
  try {
    console.log('===========================================');
    console.log('FIX USER EMAIL INDEX');
    console.log('===========================================');

    await mongoose.connect(process.env.MONGO_URI);
    console.log('✅ Connected to MongoDB\n');

    const db = mongoose.connection.db;
    const collection = db.collection('users');

    // 1. List existing indexes
    const indexes = await collection.indexes();
    console.log('📋 Existing indexes:');
    indexes.forEach(idx => {
      console.log(`   - ${idx.name}: ${JSON.stringify(idx.key)} ${idx.unique ? '[UNIQUE]' : ''}`);
    });

    // 2. Drop old unique email index (without isDeleted filter)
    for (const idx of indexes) {
      if (
        idx.unique && 
        idx.key && 
        idx.key.email === 1 && 
        Object.keys(idx.key).length === 1 &&
        idx.name !== 'email_active_unique'
      ) {
        console.log(`\n🗑️  Dropping old unique index: ${idx.name}`);
        await collection.dropIndex(idx.name);
        console.log('✅ Dropped');
      }
    }

    // 3. Create new partial unique index
    console.log('\n🔄 Creating new partial unique index...');
    await collection.createIndex(
      { email: 1 },
      { 
        unique: true, 
        partialFilterExpression: { isDeleted: false },
        name: 'email_active_unique'
      }
    );
    console.log('✅ Created: email_active_unique\n');

    // 4. Check for duplicate emails among active users
    const duplicates = await collection.aggregate([
      { $match: { isDeleted: false } },
      { $group: { _id: '$email', count: { $sum: 1 } } },
      { $match: { count: { $gt: 1 } } }
    ]).toArray();

    if (duplicates.length > 0) {
      console.log('⚠️  WARNING: Duplicate emails among active users:');
      duplicates.forEach(d => console.log(`   - ${d._id}: ${d.count} users`));
      console.log('   Please clean these manually before using the system!');
    } else {
      console.log('✅ No duplicate emails among active users');
    }

    // 5. Summary
    const totalUsers = await collection.countDocuments();
    const activeUsers = await collection.countDocuments({ isDeleted: false });
    const deletedUsers = await collection.countDocuments({ isDeleted: true });

    console.log('\n===========================================');
    console.log('SUMMARY');
    console.log('===========================================');
    console.log(`Total users: ${totalUsers}`);
    console.log(`Active: ${activeUsers}`);
    console.log(`Deleted (soft): ${deletedUsers}`);
    console.log('\n✅ Index fix complete!');
    console.log('===========================================');

    process.exit(0);
  } catch (err) {
    console.error('❌ Error:', err);
    process.exit(1);
  }
})();