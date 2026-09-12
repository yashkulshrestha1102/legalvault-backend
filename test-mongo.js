const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '.env') });

const mongoose = require('mongoose');

// Password hide karo (log safe)
const safeUri = (process.env.MONGO_URI || '').replace(/:([^@]+)@/, ':****@');
console.log('🔍 Testing MONGO_URI:', safeUri);

if (!process.env.MONGO_URI) {
  console.error('❌ MONGO_URI not set in .env');
  process.exit(1);
}

mongoose.connect(process.env.MONGO_URI, {
  serverSelectionTimeoutMS: 15000,
  socketTimeoutMS: 45000,
  connectTimeoutMS: 15000,
  family: 4,  // IPv4 force karo
})
.then(() => {
  console.log('✅ MongoDB Connected!');
  console.log('📊 Host:', mongoose.connection.host);
  console.log('📊 DB Name:', mongoose.connection.name);
  process.exit(0);
})
.catch((err) => {
  console.error('❌ Failed:', err.message);
  console.error('❌ Code:', err.code);
  console.error('❌ CodeName:', err.codeName);
  
  if (err.reason) {
    console.error('❌ Reason type:', err.reason.type);
    if (err.reason.servers) {
      for (const [host, desc] of err.reason.servers) {
        console.error(`   ${host}:`);
        console.error(`     Type: ${desc.type}`);
        console.error(`     Error: ${desc.error?.message || 'no error'}`);
      }
    }
  }
  process.exit(1);
});