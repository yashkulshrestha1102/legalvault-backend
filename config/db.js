const mongoose = require('mongoose');

// ═══════════════════════════════════════════
// ✅ MongoDB Connection Retry Configuration
// ═══════════════════════════════════════════
const MAX_RETRIES = 5;           // Total attempts
const INITIAL_DELAY_MS = 3000;   // First retry: 3 sec
const MAX_DELAY_MS = 30000;      // Cap at 30 sec

/**
 * Connect to MongoDB with retry logic
 * 
 * ✅ Retries up to 5 times with exponential backoff
 * ✅ Same mongoose connection options as before
 * ✅ Exits process if all attempts fail
 * ✅ Same function signature — no changes needed in server.js
 */
const connectDB = async () => {
  for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
    try {
      console.log(`🔄 MongoDB connection attempt ${attempt}/${MAX_RETRIES}...`);

      const conn = await mongoose.connect(process.env.MONGO_URI, {
        maxPoolSize: 10,
        minPoolSize: 2,
        socketTimeoutMS: 45000,
        connectTimeoutMS: 30000,
        serverSelectionTimeoutMS: 5000,
      });

      // ✅ Success
      console.log(`✅ MongoDB Connected: ${conn.connection.host}`);
      console.log(`📊 Connection Pool Size: ${conn.connection.maxPoolSize}`);
      return conn;   // ✅ Return connection object (same as before)

    } catch (error) {
      const isLastAttempt = attempt === MAX_RETRIES;

      console.error(
        `❌ MongoDB Connection Failed (attempt ${attempt}/${MAX_RETRIES}): ${error.message}`
      );

      // ✅ Last attempt failed → exit (same behavior as before)
      if (isLastAttempt) {
        console.error(
          `❌ All ${MAX_RETRIES} connection attempts failed. Exiting.`
        );
        process.exit(1);
      }

      // ✅ Exponential backoff: 3s → 6s → 12s → 24s (capped at 30s)
      const delay = Math.min(
        INITIAL_DELAY_MS * Math.pow(2, attempt - 1),
        MAX_DELAY_MS
      );

      console.log(`⏳ Retrying in ${delay / 1000}s...`);
      await new Promise((resolve) => setTimeout(resolve, delay));
    }
  }
};

module.exports = connectDB;