/**
 * Pulls keyword data from Google Search Console API.
 * Outputs a ranked list of queries with impressions, clicks, CTR, and position.
 *
 * Usage: node scripts/gsc-keywords.mjs
 */

import { google } from 'googleapis';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const CREDENTIALS_PATH = path.join(__dirname, 'gsc-credentials.json');
const TOKEN_PATH = path.join(__dirname, 'gsc-token.json');

const SITE_URL = 'https://mrvaluations.co.uk/';
const DAYS_BACK = 90;

// --- Auth setup ---

const credentials = JSON.parse(fs.readFileSync(CREDENTIALS_PATH, 'utf8'));
const { client_id, client_secret } = credentials.installed;

const oauth2Client = new google.auth.OAuth2(client_id, client_secret, 'http://localhost:3456');
const token = JSON.parse(fs.readFileSync(TOKEN_PATH, 'utf8'));
oauth2Client.setCredentials(token);

// Persist refreshed tokens automatically
oauth2Client.on('tokens', (tokens) => {
  const updated = { ...token, ...tokens };
  fs.writeFileSync(TOKEN_PATH, JSON.stringify(updated, null, 2));
});

// --- Date helpers ---

function formatDate(date) {
  return date.toISOString().split('T')[0];
}

const endDate = new Date();
const startDate = new Date();
startDate.setDate(endDate.getDate() - DAYS_BACK);

// --- Fetch data ---

const searchconsole = google.searchconsole({ version: 'v1', auth: oauth2Client });

async function fetchQueryData() {
  const res = await searchconsole.searchanalytics.query({
    siteUrl: SITE_URL,
    requestBody: {
      startDate: formatDate(startDate),
      endDate: formatDate(endDate),
      dimensions: ['query'],
      rowLimit: 500,
      dataState: 'all',
    },
  });
  return res.data.rows || [];
}

async function fetchPageData() {
  const res = await searchconsole.searchanalytics.query({
    siteUrl: SITE_URL,
    requestBody: {
      startDate: formatDate(startDate),
      endDate: formatDate(endDate),
      dimensions: ['page', 'query'],
      rowLimit: 500,
      dataState: 'all',
    },
  });
  return res.data.rows || [];
}

// --- Analysis ---

function categorise(rows) {
  const quickWins = [];       // position 5-20, impressions >= 50
  const highImpressionLowCtr = []; // impressions >= 100, CTR < 3%
  const topPerformers = [];   // clicks >= 5, position <= 5
  const untapped = [];        // impressions >= 20, clicks === 0

  for (const row of rows) {
    const query = row.keys[0];
    const clicks = row.clicks;
    const impressions = row.impressions;
    const ctr = row.ctr * 100;
    const position = row.position;

    if (position >= 5 && position <= 40 && impressions >= 2) {
      quickWins.push({ query, clicks, impressions, ctr, position });
    }
    if (impressions >= 2 && ctr < 3) {
      highImpressionLowCtr.push({ query, clicks, impressions, ctr, position });
    }
    if (clicks >= 1 && position <= 30) {
      topPerformers.push({ query, clicks, impressions, ctr, position });
    }
    if (impressions >= 2 && clicks === 0) {
      untapped.push({ query, clicks, impressions, ctr, position });
    }
  }

  return {
    quickWins: quickWins.sort((a, b) => b.impressions - a.impressions).slice(0, 15),
    highImpressionLowCtr: highImpressionLowCtr.sort((a, b) => b.impressions - a.impressions).slice(0, 15),
    topPerformers: topPerformers.sort((a, b) => b.clicks - a.clicks).slice(0, 15),
    untapped: untapped.sort((a, b) => b.impressions - a.impressions).slice(0, 15),
  };
}

function printTable(rows, columns) {
  if (rows.length === 0) {
    console.log('  (no data yet)\n');
    return;
  }
  const colWidths = columns.map(col =>
    Math.max(col.label.length, ...rows.map(r => String(r[col.key]).length))
  );
  const header = columns.map((col, i) => col.label.padEnd(colWidths[i])).join('  ');
  const divider = colWidths.map(w => '-'.repeat(w)).join('  ');
  console.log('  ' + header);
  console.log('  ' + divider);
  for (const row of rows) {
    const line = columns.map((col, i) => {
      const val = typeof row[col.key] === 'number'
        ? row[col.key].toFixed(col.decimals ?? 0)
        : row[col.key];
      return String(val).padEnd(colWidths[i]);
    }).join('  ');
    console.log('  ' + line);
  }
  console.log();
}

// --- Main ---

console.log(`\nFetching Search Console data for ${SITE_URL}`);
console.log(`Date range: ${formatDate(startDate)} → ${formatDate(endDate)}\n`);

const [queryRows, pageRows] = await Promise.all([fetchQueryData(), fetchPageData()]);

console.log(`Total queries found: ${queryRows.length}`);
console.log(`Total page+query combinations: ${pageRows.length}\n`);

const { quickWins, highImpressionLowCtr, topPerformers, untapped } = categorise(queryRows);

const cols = {
  query:       { key: 'query',       label: 'Query' },
  impressions: { key: 'impressions', label: 'Impressions' },
  clicks:      { key: 'clicks',      label: 'Clicks' },
  ctr:         { key: 'ctr',         label: 'CTR %',   decimals: 1 },
  position:    { key: 'position',    label: 'Avg Pos', decimals: 1 },
};

console.log('=== TOP PERFORMERS (ranking well + getting clicks) ===');
printTable(topPerformers, [cols.query, cols.clicks, cols.impressions, cols.ctr, cols.position]);

console.log('=== QUICK WINS (position 5-20, 50+ impressions — easy to move to page 1) ===');
printTable(quickWins, [cols.query, cols.impressions, cols.clicks, cols.ctr, cols.position]);

console.log('=== HIGH IMPRESSIONS, LOW CTR (appearing but not getting clicked) ===');
printTable(highImpressionLowCtr, [cols.query, cols.impressions, cols.clicks, cols.ctr, cols.position]);

console.log('=== UNTAPPED (impressions but zero clicks) ===');
printTable(untapped, [cols.query, cols.impressions, cols.position]);

// Save full data as JSON for use by future scripts
const outputPath = path.join(__dirname, 'gsc-data.json');
fs.writeFileSync(outputPath, JSON.stringify({
  fetchedAt: new Date().toISOString(),
  siteUrl: SITE_URL,
  dateRange: { start: formatDate(startDate), end: formatDate(endDate) },
  summary: {
    totalQueries: queryRows.length,
    quickWins: quickWins.length,
    highImpressionLowCtr: highImpressionLowCtr.length,
    topPerformers: topPerformers.length,
    untapped: untapped.length,
  },
  categories: { quickWins, highImpressionLowCtr, topPerformers, untapped },
  allQueries: queryRows.map(r => ({
    query: r.keys[0],
    clicks: r.clicks,
    impressions: r.impressions,
    ctr: +(r.ctr * 100).toFixed(2),
    position: +r.position.toFixed(1),
  })),
}, null, 2));

console.log(`Full data saved to: scripts/gsc-data.json`);
console.log('\nNext step: run node scripts/gsc-suggestions.mjs to generate content suggestions\n');
