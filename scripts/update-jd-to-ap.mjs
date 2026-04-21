/**
 * One-off migration script — updates all plate listings where initials === 'JD':
 *   - initials      → 'AP'
 *   - lCNumber      → '07540840801'
 *   - lCEmail       → 'guv.mr.valuations+apnaplates@gmail.com'
 *
 * Usage:
 *   1. Ensure scripts/service-account.json is present
 *   2. node scripts/update-jd-to-ap.mjs
 */

import { initializeApp, cert } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { createRequire } from 'module';

const require = createRequire(import.meta.url);
const serviceAccount = require('./service-account.json');

const COLLECTION_NAME = 'plate-listings';

async function migrate() {
  initializeApp({ credential: cert(serviceAccount) });
  const db = getFirestore();
  const col = db.collection(COLLECTION_NAME);

  console.log('Querying for plates with initials === "JD"...');

  const snapshot = await col.where('initials', '==', 'jd').get();

  if (snapshot.empty) {
    console.log('No matching plates found.');
    process.exit(0);
  }

  console.log(`Found ${snapshot.size} plates to update.`);

  let success = 0;
  let failed = 0;

  for (const docSnap of snapshot.docs) {
    try {
      await docSnap.ref.update({
        initials: 'AP',
        lCNumber: '07540840801',
        lCEmail: 'guv.mr.valuations+apnaplates@gmail.com',
      });
      console.log(`✓ Updated plate: ${docSnap.data().plateCharacters}`);
      success++;
    } catch (err) {
      console.error(`✗ Failed to update doc ${docSnap.id}:`, err.message);
      failed++;
    }
  }

  console.log(`\nMigration complete — ${success} updated, ${failed} failed.`);
  process.exit(0);
}

migrate().catch((err) => {
  console.error('Migration failed:', err.message);
  process.exit(1);
});
