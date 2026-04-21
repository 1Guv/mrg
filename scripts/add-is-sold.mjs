/**
 * One-off migration script — adds isSold and soldPrice to all plate listings.
 *   - All plates: isSold = false, soldPrice = null
 *   - plateCharacters === 'f1jcku': isSold = true, soldPrice = 2000
 *
 * Usage:
 *   node scripts/add-is-sold.mjs
 */

import { initializeApp, cert } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { createRequire } from 'module';

const require = createRequire(import.meta.url);
const serviceAccount = require('./service-account.json');

const COLLECTION_NAME = 'plate-listings';
const SOLD_PLATE = 'f1jcku';
const SOLD_PRICE = 2000;

async function migrate() {
  initializeApp({ credential: cert(serviceAccount) });
  const db = getFirestore();
  const col = db.collection(COLLECTION_NAME);

  console.log('Fetching all plate listings...');
  const snapshot = await col.get();
  console.log(`Found ${snapshot.size} plates to update.`);

  let success = 0;
  let failed = 0;

  for (const docSnap of snapshot.docs) {
    const { plateCharacters } = docSnap.data();
    const isSold = plateCharacters?.toLowerCase().replace(/\s/g, '') === SOLD_PLATE;

    try {
      await docSnap.ref.update({
        isSold,
        soldPrice: isSold ? SOLD_PRICE : null,
      });
      if (isSold) console.log(`✓ Marked as SOLD: ${plateCharacters} (£${SOLD_PRICE})`);
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
