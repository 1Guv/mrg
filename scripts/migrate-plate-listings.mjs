/**
 * One-off migration script — uploads plate listings from GitHub JSON to Firestore.
 * Uses Firebase Admin SDK to bypass security rules.
 *
 * Usage:
 *   1. Download your service account key from Firebase Console:
 *      Project Settings → Service Accounts → Generate new private key
 *   2. Save it as scripts/service-account.json
 *   3. npm install firebase-admin --legacy-peer-deps
 *   4. node scripts/migrate-plate-listings.mjs
 */

import { initializeApp, cert } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { createRequire } from 'module';

const require = createRequire(import.meta.url);
const serviceAccount = require('./service-account.json');

const JSON_URL =
  'https://raw.githubusercontent.com/1Guv/numberplates/refs/heads/master/src/assets/data/actual_plates_from_ap.json';

const COLLECTION_NAME = 'plate-listings';

async function migrate() {
  console.log('Fetching plate listings from GitHub...');

  const response = await fetch(JSON_URL);
  if (!response.ok) {
    throw new Error(`Failed to fetch JSON: ${response.status} ${response.statusText}`);
  }

  const data = await response.json();
  const plates = data.currentAPPlateSet ?? data;

  if (!Array.isArray(plates) || plates.length === 0) {
    throw new Error('No plates found in JSON — check the data shape.');
  }

  console.log(`Found ${plates.length} plates. Connecting to Firestore...`);

  initializeApp({ credential: cert(serviceAccount) });
  const db = getFirestore();
  const col = db.collection(COLLECTION_NAME);

  let success = 0;
  let failed = 0;

  for (const plate of plates) {
    try {
      await col.add(plate);
      console.log(`✓ Uploaded plate: ${plate.plateCharacters}`);
      success++;
    } catch (err) {
      console.error(`✗ Failed to upload plate id ${plate.id}:`, err.message);
      failed++;
    }
  }

  console.log(`\nMigration complete — ${success} uploaded, ${failed} failed.`);
  process.exit(0);
}

migrate().catch((err) => {
  console.error('Migration failed:', err.message);
  process.exit(1);
});
