/**
 * One-off migration — moves seller contact details off public listings.
 *
 * For every doc in plate-listings-new and plate-listings, copies lCEmail,
 * lCNumber, lCName, plateListingAccName and plateListingAccTelNumber into
 * <listing>/private/contact (readable only by Cloud Functions), then deletes
 * them from the listing. Safe to re-run: listings without the fields are
 * skipped.
 *
 * Usage:
 *   1. Ensure scripts/service-account.json is present
 *   2. node scripts/move-seller-contacts.mjs [--dry-run]
 */

import { initializeApp, cert } from 'firebase-admin/app';
import { getFirestore, FieldValue } from 'firebase-admin/firestore';
import { createRequire } from 'module';

const require = createRequire(import.meta.url);
const serviceAccount = require('./service-account.json');

const COLLECTIONS = ['plate-listings-new', 'plate-listings'];
const CONTACT_FIELDS = ['lCEmail', 'lCNumber', 'lCName', 'plateListingAccName', 'plateListingAccTelNumber'];
const dryRun = process.argv.includes('--dry-run');

async function migrate() {
  initializeApp({ credential: cert(serviceAccount) });
  const db = getFirestore();

  for (const name of COLLECTIONS) {
    const snapshot = await db.collection(name).get();
    let moved = 0;
    let batch = db.batch();
    let ops = 0;

    for (const docSnap of snapshot.docs) {
      const data = docSnap.data();
      const present = CONTACT_FIELDS.filter((f) => f in data);
      if (!present.length) continue;

      const contact = Object.fromEntries(present.map((f) => [f, data[f]]));
      batch.set(docSnap.ref.collection('private').doc('contact'), contact, { merge: true });
      batch.update(docSnap.ref, Object.fromEntries(present.map((f) => [f, FieldValue.delete()])));
      ops += 2;
      moved++;

      if (ops >= 400) {
        if (!dryRun) await batch.commit();
        batch = db.batch();
        ops = 0;
      }
    }
    if (ops && !dryRun) await batch.commit();
    console.log(`${name}: ${snapshot.size} listings, ${moved} ${dryRun ? 'would be' : ''} moved`);
  }
  process.exit(0);
}

migrate().catch((err) => {
  console.error('Migration failed:', err.message);
  process.exit(1);
});
