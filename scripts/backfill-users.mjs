/**
 * One-off backfill — adds every Auth account to the users customer list.
 *
 * For each Auth user, writes users/{uid} with uid, email, source: 'backfill',
 * registeredAt (from the account's creation time) and marketingConsent: false,
 * plus the firstName, lastName and city from that email's most recent
 * auto_valuations record. Only fields the document is missing are written, so
 * existing values (and consent) are never overwritten. Safe to re-run.
 * Documents not keyed by a uid (the old random-id records) are not touched.
 *
 * Usage:
 *   1. Ensure scripts/service-account.json is present
 *   2. node scripts/backfill-users.mjs [--dry-run]
 */

import { initializeApp, cert } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { getFirestore, Timestamp } from 'firebase-admin/firestore';
import { createRequire } from 'module';

const require = createRequire(import.meta.url);
const serviceAccount = require('./service-account.json');

const DETAIL_FIELDS = ['firstName', 'lastName', 'city'];
const dryRun = process.argv.includes('--dry-run');

/** Most recent auto_valuations details per lowercased email. */
async function latestDetailsByEmail(db) {
  const snapshot = await db.collection('auto_valuations')
    .select('email', 'savedAt', ...DETAIL_FIELDS).get();
  const byEmail = new Map();
  for (const docSnap of snapshot.docs) {
    const data = docSnap.data();
    const email = String(data.email ?? '').trim().toLowerCase();
    if (!email) continue;
    const savedAt = data.savedAt?.toMillis?.() ?? 0;
    const details = Object.fromEntries(DETAIL_FIELDS
      .filter((f) => typeof data[f] === 'string' && data[f].trim())
      .map((f) => [f, data[f].trim()]));
    const prev = byEmail.get(email);
    if (!prev || savedAt > prev.savedAt) byEmail.set(email, { savedAt, details });
  }
  console.log(`auto_valuations: ${snapshot.size} records, ${byEmail.size} distinct emails`);
  return byEmail;
}

async function listAllUsers(auth) {
  const users = [];
  let pageToken;
  do {
    const page = await auth.listUsers(1000, pageToken);
    users.push(...page.users);
    pageToken = page.pageToken;
  } while (pageToken);
  return users;
}

async function backfill() {
  initializeApp({ credential: cert(serviceAccount) });
  const db = getFirestore();
  const [byEmail, users] = await Promise.all([latestDetailsByEmail(db), listAllUsers(getAuth())]);

  let created = 0;
  let updated = 0;
  let unchanged = 0;
  let withDetails = 0;
  let batch = db.batch();
  let ops = 0;

  for (let i = 0; i < users.length; i += 100) {
    const chunk = users.slice(i, i + 100);
    const refs = chunk.map((u) => db.collection('users').doc(u.uid));
    const snaps = await db.getAll(...refs);

    chunk.forEach((user, j) => {
      const existing = snaps[j].data() ?? {};
      const email = String(user.email ?? '').toLowerCase();
      const details = (email && byEmail.get(email)?.details) || {};
      if (Object.keys(details).length) withDetails++;

      const wanted = {
        uid: user.uid,
        email,
        source: 'backfill',
        ...details,
        registeredAt: Timestamp.fromDate(new Date(user.metadata.creationTime)),
        marketingConsent: false,
      };
      const missing = Object.fromEntries(Object.entries(wanted)
        .filter(([k, v]) => v !== '' && existing[k] === undefined));
      if (!Object.keys(missing).length) {
        unchanged++;
        return;
      }
      if (snaps[j].exists) updated++; else created++;
      batch.set(refs[j], missing, { merge: true });
      ops++;
    });

    if (ops >= 400) {
      if (!dryRun) await batch.commit();
      batch = db.batch();
      ops = 0;
    }
  }
  if (ops && !dryRun) await batch.commit();

  const would = dryRun ? 'would be ' : '';
  console.log(`Auth users: ${users.length} (${withDetails} with auto_valuations details)`);
  console.log(`users docs: ${created} ${would}created, ${updated} ${would}updated, ${unchanged} already complete`);
  process.exit(0);
}

backfill().catch((err) => {
  console.error('Backfill failed:', err.message);
  process.exit(1);
});
