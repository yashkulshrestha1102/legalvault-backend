require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });
const mongoose = require('mongoose');

const DRY_RUN = process.env.DRY_RUN !== 'false';

const SINGLE_FIELD_COLLECTIONS = [
  { name: 'pdfs', field: 'fileUrl' },
  { name: 'documents', field: 'fileUrl' },
  { name: 'customfiles', field: 'fileUrl' },
];

const ARRAY_FIELD_COLLECTIONS = [
  { name: 'registrations', field: 'pdfs' },
  { name: 'contracts', field: 'pdfs' },
  { name: 'policies', field: 'pdfs' },
  { name: 'corporatesecretariats', field: 'pdfs' },
  { name: 'gsts', field: 'pdfs' },
  { name: 'incometaxes', field: 'pdfs' },
  { name: 'hrs', field: 'pdfs' },
  { name: 'financials', field: 'pdfs' },
];

const extractRelativeUrl = (url) => {
  if (typeof url !== 'string') return null;
  const match = url.match(/^https?:\/\/[^/]+(\/api\/.+)$/);
  return match ? match[1] : null;
};

(async () => {
  try {
    console.log('===========================================');
    console.log('FIX FULL URLS IN DATABASE');
    console.log('DRY RUN:', DRY_RUN);
    console.log('===========================================');

    await mongoose.connect(process.env.MONGO_URI);
    console.log('Connected to MongoDB\n');

    let totalFixed = 0;

    console.log('--- PART 1: Single field collections ---\n');
    for (const { name, field } of SINGLE_FIELD_COLLECTIONS) {
      try {
        const collection = mongoose.connection.db.collection(name);
        const docs = await collection.find({ [field]: { $regex: /^https?:\/\// } }).toArray();
        console.log(`[${name}.${field}] Found ${docs.length} docs`);

        for (const doc of docs) {
          const newUrl = extractRelativeUrl(doc[field]);
          if (newUrl) {
            if (!DRY_RUN) {
              await collection.updateOne({ _id: doc._id }, { $set: { [field]: newUrl } });
            }
            console.log(`  ${DRY_RUN ? '[DRY]' : '[FIXED]'} ${doc._id}`);
            totalFixed++;
          }
        }
      } catch (err) {
        console.error(`  Error in ${name}:`, err.message);
      }
    }

    console.log('\n--- PART 2: Array field collections ---\n');
    for (const { name, field } of ARRAY_FIELD_COLLECTIONS) {
      try {
        const collection = mongoose.connection.db.collection(name);
        const docs = await collection.find({}).toArray();
        let fixedInCollection = 0;

        for (const doc of docs) {
          const arr = doc[field];
          if (!Array.isArray(arr) || arr.length === 0) continue;

          let hasFullUrl = false;
          const newArr = arr.map((url) => {
            const fixed = extractRelativeUrl(url);
            if (fixed) { hasFullUrl = true; return fixed; }
            return url;
          });

          if (hasFullUrl) {
            if (!DRY_RUN) {
              await collection.updateOne({ _id: doc._id }, { $set: { [field]: newArr } });
            }
            console.log(`  ${DRY_RUN ? '[DRY]' : '[FIXED]'} ${name}/${doc._id}: ${arr.length} URLs`);
            fixedInCollection++;
            totalFixed++;
          }
        }
        console.log(`[${name}.${field}] Fixed ${fixedInCollection} docs`);
      } catch (err) {
        console.error(`  Error in ${name}:`, err.message);
      }
    }

    console.log('\n===========================================');
    console.log('SUMMARY');
    console.log('===========================================');
    console.log('Total fixed:', totalFixed);
    console.log('DRY RUN:', DRY_RUN);

    if (DRY_RUN) {
      console.log('\nTo actually fix:');
      console.log('  $env:DRY_RUN="false"');
      console.log('  node scripts\\fix-full-urls.js');
    }

    process.exit(0);
  } catch (err) {
    console.error('Fatal error:', err);
    process.exit(1);
  }
})();