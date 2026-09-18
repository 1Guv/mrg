/**
 * Reports the state of the SEO article pipeline: the live GSC candidate pool,
 * which keywords have been burned, and what the next scheduled run will target.
 *
 * Read-only — it mirrors categoriseKeywords() in
 * functions/src/article-generator.ts against live Search Console data. Keep the
 * two in step: if the selection logic changes there, change it here too.
 *
 * Usage: node scripts/gsc-pipeline-status.mjs [--limit N]
 */

import { google } from 'googleapis';
import admin from 'firebase-admin';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const SITE_URL = 'https://mrvaluations.co.uk/';
const DAYS_BACK = 90;

const limitArg = process.argv.indexOf('--limit');
const LIMIT = limitArg !== -1 ? Number(process.argv[limitArg + 1]) : 20;

const read = (f) => JSON.parse(fs.readFileSync(path.join(__dirname, f), 'utf8'));

// --- Search Console ---------------------------------------------------------
const { client_id, client_secret } = read('gsc-credentials.json').installed;
const { refresh_token } = read('gsc-token.json');

const auth = new google.auth.OAuth2(client_id, client_secret, 'http://localhost:3456');
auth.setCredentials({ refresh_token });

const endDate = new Date();
const startDate = new Date();
startDate.setDate(startDate.getDate() - DAYS_BACK);
const ymd = (d) => d.toISOString().split('T')[0];

const res = await google.searchconsole({ version: 'v1', auth }).searchanalytics.query({
  siteUrl: SITE_URL,
  requestBody: {
    startDate: ymd(startDate),
    endDate: ymd(endDate),
    dimensions: ['query'],
    rowLimit: 500,
    dataState: 'all',
  },
});

const rows = (res.data.rows ?? [])
  .filter((r) => r.keys?.length)
  .map((r) => ({
    query: r.keys[0],
    clicks: r.clicks ?? 0,
    impressions: r.impressions ?? 0,
    position: r.position ?? 0,
  }));

// --- Mirror of categoriseKeywords() -----------------------------------------
const quickWins = rows.filter((r) => r.position >= 5 && r.position <= 40 && r.impressions >= 2);
const untapped = rows.filter((r) => r.impressions >= 2 && r.clicks === 0);
const byImpressions = (a, b) => b.impressions - a.impressions;

const seen = new Set();
const candidates = [];
for (const r of [...[...quickWins].sort(byImpressions), ...[...untapped].sort(byImpressions)]) {
  if (!seen.has(r.query)) {
    seen.add(r.query);
    candidates.push(r);
  }
}

// --- Firestore --------------------------------------------------------------
admin.initializeApp({ credential: admin.credential.cert(read('service-account.json')) });
const db = admin.firestore();

const usedDoc = await db.collection('meta').doc('usedKeywords').get();
const used = new Set(usedDoc.exists ? (usedDoc.data().keywords ?? []) : []);
const remaining = candidates.filter((r) => !used.has(r.query));

const articles = await db.collection('articles').orderBy('publishedAt', 'desc').limit(5).get();

// --- Report -----------------------------------------------------------------
console.log(`\nGSC QUERIES (last ${DAYS_BACK} days): ${rows.length}`);
console.log(`  Quick wins (pos 5-40, impr>=2): ${quickWins.length}`);
console.log(`  Untapped (impr>=2, clicks=0):   ${untapped.length}`);
console.log(`  Candidate pool after dedup:     ${candidates.length}`);
console.log(`  Burned (meta/usedKeywords):     ${used.size}`);
console.log(`  REMAINING:                      ${remaining.length}`);

if (remaining.length === 0) {
  console.log('\n  Pool exhausted — next run falls back to grounded news search.');
}

console.log(`\nNEXT ${Math.min(LIMIT, remaining.length)} IN QUEUE (">>" is the next article):`);
console.log(`   ${'impr'.padStart(5)} ${'clicks'.padStart(6)} ${'pos'.padStart(6)}  query`);
remaining.slice(0, LIMIT).forEach((r, i) => {
  const tier = r.position >= 5 && r.position <= 40 ? 'QW' : '  ';
  console.log(
    `  ${String(r.impressions).padStart(5)} ${String(r.clicks).padStart(6)} ` +
    `${r.position.toFixed(1).padStart(6)}  ${i === 0 ? '>>' : '  '} ${tier} ${r.query}`
  );
});

console.log('\nMOST RECENT ARTICLES:');
for (const d of articles.docs) {
  const a = d.data();
  const when = a.publishedAt?.toDate?.()?.toISOString().slice(0, 16).replace('T', ' ') ?? '?';
  console.log(`  ${when}  [${a.targetKeyword ?? '(none)'}]  ${(a.title ?? '').slice(0, 50)}`);
}
console.log();
process.exit(0);
