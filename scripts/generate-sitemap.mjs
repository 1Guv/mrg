import { initializeApp, cert } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { writeFileSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';
import { createRequire } from 'module';

const __dirname = dirname(fileURLToPath(import.meta.url));
const require = createRequire(import.meta.url);
const serviceAccount = require('./service-account.json');

const BASE_URL = 'https://mrvaluations.co.uk';

const STATIC_URLS = [
  { loc: `${BASE_URL}/`,                  changefreq: 'weekly',  priority: '1.0' },
  { loc: `${BASE_URL}/plates-for-sale`,   changefreq: 'daily',   priority: '0.9' },
  { loc: `${BASE_URL}/list-plate`,        changefreq: 'monthly', priority: '0.8' },
  { loc: `${BASE_URL}/register`,          changefreq: 'monthly', priority: '0.5' },
  { loc: `${BASE_URL}/login`,             changefreq: 'monthly', priority: '0.4' },
];

function normalisePlate(plate) {
  return plate.replace(/\s/g, '').toUpperCase();
}

function buildXml(urls) {
  const entries = urls.map(u =>
    `  <url>\n    <loc>${u.loc}</loc>\n    <changefreq>${u.changefreq}</changefreq>\n    <priority>${u.priority}</priority>\n  </url>`
  ).join('\n');
  return `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${entries}\n</urlset>`;
}

async function generate() {
  initializeApp({ credential: cert(serviceAccount) });
  const db = getFirestore();

  const [oldSnap, newSnap] = await Promise.all([
    db.collection('plate-listings').where('isSold', '==', false).get(),
    db.collection('plate-listings-new').where('isSold', '==', false).get(),
  ]);

  const allPlateChars = [
    ...oldSnap.docs.map(d => d.data().plateCharacters),
    ...newSnap.docs.map(d => d.data().plateCharacters),
  ].filter(Boolean);

  const plates = [...new Set(allPlateChars)];

  const plateUrls = plates.map(plate => ({
    loc: `${BASE_URL}/plates-for-sale/${normalisePlate(plate)}`,
    changefreq: 'weekly',
    priority: '0.8',
  }));

  const allUrls = [...STATIC_URLS, ...plateUrls];
  const xml = buildXml(allUrls);

  const outPath = resolve(__dirname, '../src/sitemap.xml');
  writeFileSync(outPath, xml, 'utf8');
  console.log(`Sitemap written: ${allUrls.length} URLs (${plateUrls.length} plate listings)`);
}

generate().catch(err => {
  console.error('Sitemap generation failed:', err);
  process.exit(1);
});
