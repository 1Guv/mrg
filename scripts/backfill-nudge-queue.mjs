/**
 * One-off backfill script — seeds listing_nudge_queue from existing auto_valuations.
 *
 * For each unique email+plate combo in auto_valuations (earliest valuation wins),
 * creates a nudge queue entry if one doesn't already exist and the plate isn't
 * already listed in plate-listings-new.
 *
 * First emails will go out ~30 minutes after this script runs.
 *
 * Usage:
 *   node scripts/backfill-nudge-queue.mjs
 *
 * Dry-run (no writes):
 *   DRY_RUN=true node scripts/backfill-nudge-queue.mjs
 */

import { initializeApp, cert } from 'firebase-admin/app';
import { getFirestore, Timestamp } from 'firebase-admin/firestore';
import { createRequire } from 'module';

const require = createRequire(import.meta.url);
const serviceAccount = require('./service-account.json');

const DRY_RUN = process.env.DRY_RUN === 'true';
const MINUTES_30 = 30 * 60 * 1000;

async function backfill() {
  initializeApp({ credential: cert(serviceAccount) });
  const db = getFirestore();

  if (DRY_RUN) console.log('🔍 DRY RUN — no writes will be made.\n');

  // ── 1. Load all auto_valuations ──────────────────────────────────────────
  console.log('Fetching auto_valuations...');
  const valuationsSnap = await db.collection('auto_valuations').get();
  console.log(`Found ${valuationsSnap.size} auto_valuations.\n`);

  // ── 2. Deduplicate: one entry per email+plate, earliest savedAt wins ─────
  const earliest = new Map(); // key: "email::PLATE" → doc data

  for (const doc of valuationsSnap.docs) {
    const data = doc.data();
    const rawEmail = data.email;
    const rawReg = data.registration;
    if (!rawEmail || !rawReg) continue;

    const email = String(rawEmail).trim().toLowerCase();
    const registration = String(rawReg).replace(/\s/g, '').toUpperCase();
    const key = `${email}::${registration}`;

    const savedAt = data.savedAt?.toMillis() ?? 0;
    const existing = earliest.get(key);

    if (!existing || savedAt < existing.savedAtMillis) {
      earliest.set(key, {
        email,
        registration,
        firstName: data.firstName ?? '',
        valuationMin: data.minPrice ?? 0,
        valuationMax: data.maxPrice ?? 0,
        savedAt: data.savedAt ?? Timestamp.now(),
        savedAtMillis: savedAt,
      });
    }
  }

  console.log(`Unique email+plate combos: ${earliest.size}`);

  // ── 3. Load already-listed plates ────────────────────────────────────────
  console.log('Fetching plate-listings-new...');
  const listingsSnap = await db.collection('plate-listings-new').get();
  const listedPlates = new Set(
    listingsSnap.docs.map((d) => String(d.data().plateCharacters ?? '').toUpperCase())
  );
  console.log(`Found ${listedPlates.size} listed plates.\n`);

  // ── 4. Load existing nudge queue entries (avoid duplicates) ──────────────
  console.log('Fetching existing listing_nudge_queue...');
  const queueSnap = await db.collection('listing_nudge_queue').get();
  const alreadyQueued = new Set(
    queueSnap.docs.map((d) => `${d.data().email}::${d.data().registration}`)
  );
  console.log(`Already in queue: ${alreadyQueued.size}\n`);

  // ── 5. Seed queue entries ─────────────────────────────────────────────────
  const nextSendAt = Timestamp.fromMillis(Date.now() + MINUTES_30);
  let created = 0;
  let skippedListed = 0;
  let skippedQueued = 0;

  for (const [key, entry] of earliest) {
    if (alreadyQueued.has(key)) {
      skippedQueued++;
      continue;
    }

    if (listedPlates.has(entry.registration)) {
      console.log(`  skip (already listed): ${entry.registration} — ${entry.email}`);
      skippedListed++;
      continue;
    }

    console.log(`  queue: ${entry.registration} — ${entry.email}`);

    if (!DRY_RUN) {
      await db.collection('listing_nudge_queue').add({
        email: entry.email,
        registration: entry.registration,
        firstName: entry.firstName,
        valuationMin: entry.valuationMin,
        valuationMax: entry.valuationMax,
        firstValuationAt: entry.savedAt,
        nextSendAt,
        lastSentAt: null,
        sendCount: 0,
        unsubscribed: false,
        unsubscribedAt: null,
        listed: false,
      });
    }

    created++;
  }

  console.log(`
Backfill complete.
  Created:          ${created}
  Skipped (listed): ${skippedListed}
  Skipped (queued): ${skippedQueued}
  ${DRY_RUN ? '(DRY RUN — nothing was written)' : ''}
  `);

  process.exit(0);
}

backfill().catch((err) => {
  console.error('Backfill failed:', err.message);
  process.exit(1);
});
