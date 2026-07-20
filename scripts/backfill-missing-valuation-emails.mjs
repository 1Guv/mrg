/**
 * One-off backfill script — fills in the missing `email` field on `auto_valuations`
 * docs that belong to a logged-in user but were saved before `details.email` was set
 * (see valuation.service.ts autoSaveValuation — fixed 2026-07-20 to backfill from
 * user.email going forward, but existing docs are still missing it).
 *
 * For each auto_valuations doc with a `userId` but no `email`, looks up the Firebase
 * Auth user and writes their email onto the doc.
 *
 * Run scripts/backfill-nudge-queue.mjs afterwards (it's idempotent) to seed
 * listing_nudge_queue entries for any docs that just gained an email.
 *
 * Usage:
 *   node scripts/backfill-missing-valuation-emails.mjs
 *
 * Dry-run (no writes):
 *   DRY_RUN=true node scripts/backfill-missing-valuation-emails.mjs
 */

import { initializeApp, cert } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { getAuth } from 'firebase-admin/auth';
import { createRequire } from 'module';

const require = createRequire(import.meta.url);
const serviceAccount = require('./service-account.json');

const DRY_RUN = process.env.DRY_RUN === 'true';

async function backfill() {
  initializeApp({ credential: cert(serviceAccount) });
  const db = getFirestore();
  const auth = getAuth();

  if (DRY_RUN) console.log('🔍 DRY RUN — no writes will be made.\n');

  console.log('Fetching auto_valuations...');
  const valuationsSnap = await db.collection('auto_valuations').get();
  console.log(`Found ${valuationsSnap.size} auto_valuations.\n`);

  const candidates = valuationsSnap.docs.filter((doc) => {
    const data = doc.data();
    return !data.email && !!data.userId;
  });

  console.log(`Docs missing email but with a userId: ${candidates.length}\n`);

  let updated = 0;
  let skippedNoAuthUser = 0;
  let skippedNoAuthEmail = 0;

  for (const doc of candidates) {
    const { userId, registration } = doc.data();

    let authUser;
    try {
      authUser = await auth.getUser(userId);
    } catch (err) {
      console.log(`  skip (auth user not found): ${registration} — userId ${userId}`);
      skippedNoAuthUser++;
      continue;
    }

    if (!authUser.email) {
      console.log(`  skip (auth user has no email): ${registration} — userId ${userId}`);
      skippedNoAuthEmail++;
      continue;
    }

    console.log(`  backfill: ${registration} — ${authUser.email}`);

    if (!DRY_RUN) {
      await doc.ref.update({ email: authUser.email });
    }

    updated++;
  }

  console.log(`
Backfill complete.
  Updated:                 ${updated}
  Skipped (no auth user):  ${skippedNoAuthUser}
  Skipped (no auth email): ${skippedNoAuthEmail}
  ${DRY_RUN ? '(DRY RUN — nothing was written)' : ''}

Next step: run scripts/backfill-nudge-queue.mjs to seed listing_nudge_queue
entries for any docs that just gained an email (it's idempotent and will
skip docs already queued or already listed).
  `);

  process.exit(0);
}

backfill().catch((err) => {
  console.error('Backfill failed:', err.message);
  process.exit(1);
});
