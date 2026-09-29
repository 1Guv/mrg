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
  { loc: `${BASE_URL}/news`,              changefreq: 'daily',   priority: '0.8' },
  { loc: `${BASE_URL}/list-plate`,        changefreq: 'monthly', priority: '0.8' },
  { loc: `${BASE_URL}/register`,          changefreq: 'monthly', priority: '0.5' },
  { loc: `${BASE_URL}/login`,             changefreq: 'monthly', priority: '0.4' },
];

function normalisePlate(plate) {
  return plate.replace(/\s/g, '').toUpperCase();
}

function escapeXml(str) {
  return str.replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&apos;' }[c]));
}

// Articles carry a lastmod; nothing else does, so the element is optional.
function buildXml(urls) {
  const entries = urls.map(u => {
    const lastmod = u.lastmod ? `\n    <lastmod>${u.lastmod}</lastmod>` : '';
    return `  <url>\n    <loc>${escapeXml(u.loc)}</loc>${lastmod}\n    <changefreq>${u.changefreq}</changefreq>\n    <priority>${u.priority}</priority>\n  </url>`;
  }).join('\n');
  return `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${entries}\n</urlset>`;
}

async function generate() {
  initializeApp({ credential: cert(serviceAccount) });
  const db = getFirestore();

  const [oldSnap, newSnap, articleSnap] = await Promise.all([
    db.collection('plate-listings').where('isSold', '==', false).get(),
    db.collection('plate-listings-new').where('isSold', '==', false).get(),
    db.collection('articles').get(),
  ]);

  const allPlateChars = [
    ...oldSnap.docs.map(d => d.data().plateCharacters),
    ...newSnap.docs.map(d => d.data().plateCharacters),
  ].filter(Boolean);

  const plates = [...new Set(allPlateChars.map(normalisePlate))];

  const plateUrls = plates.map(plate => ({
    loc: `${BASE_URL}/plates-for-sale/${plate}`,
    changefreq: 'weekly',
    priority: '0.8',
  }));

  // Every doc in `articles` is live — the generator writes only on publish,
  // so there is no draft state to filter out.
  const articleUrls = articleSnap.docs
    .map(d => d.data())
    .filter(a => a.slug)
    .map(a => ({
      loc: `${BASE_URL}/news/${a.slug}`,
      lastmod: a.publishedAt?.toDate?.().toISOString().slice(0, 10),
      changefreq: 'monthly',
      priority: '0.7',
    }));

  const allUrls = [...STATIC_URLS, ...articleUrls, ...plateUrls];
  const xml = buildXml(allUrls);

  const outPath = resolve(__dirname, '../src/sitemap.xml');
  writeFileSync(outPath, xml, 'utf8');
  console.log(
    `Sitemap written: ${allUrls.length} URLs ` +
    `(${articleUrls.length} articles, ${plateUrls.length} plate listings)`);
}

generate().catch(err => {
  console.error('Sitemap generation failed:', err);
  process.exit(1);
});
