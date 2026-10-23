/**
 * Writes a real HTML page for every route of the built app, so each URL in the
 * sitemap returns 200 with its own title, description, canonical, share tags,
 * structured data and readable content.
 *
 * Every page is the built SPA shell (docs/index.html) with its <head> tags
 * replaced and static content inside <app-root>. Crawlers and link previews read
 * that HTML; for visitors Angular boots, clears <app-root> and renders the same
 * route as normal.
 *
 * GitHub Pages serves docs/news/slug/index.html at /news/slug/ (and redirects
 * /news/slug there), so canonicals and the sitemap use the trailing slash.
 *
 * Must run after `ng build` has written docs/. Data is read at build time with
 * the same service account as scripts/generate-sitemap.mjs.
 *
 * Usage: node scripts/prerender-pages.mjs
 */

import { initializeApp, cert } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { createRequire } from 'module';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const require = createRequire(import.meta.url);
const serviceAccount = require('./service-account.json');

const DOCS = path.join(__dirname, '..', 'docs');
const SITE = 'https://mrvaluations.co.uk';
const BRAND = 'Mr Valuations';

// App routes with no data behind them. privacy-policy and terms are built as
// standalone pages by build-legal-pages.mjs, so they are not repeated here.
const STATIC_PAGES = [
  { path: 'login', title: `Log In | ${BRAND}`, description: 'Log in to your Mr Valuations account to see your saved valuations, listings and buyer enquiries.' },
  { path: 'register', title: `Create an Account | ${BRAND}`, description: 'Create a free Mr Valuations account to save number plate valuations and list your plate for sale.' },
  { path: 'forgot-password', title: `Reset Password | ${BRAND}`, description: 'Reset the password for your Mr Valuations account.', noindex: true },
  { path: 'list-plate', title: `Sell Your Number Plate | ${BRAND}`, description: 'List your private number plate for sale on Mr Valuations and get enquiries straight from buyers.' },
  { path: 'about', title: `About Us | ${BRAND}`, description: 'Mr Valuations is the UK\'s first fully automated number plate valuation tool, plus a marketplace for private plates.' },
  { path: 'contact', title: `Contact Us | ${BRAND}`, description: 'Get in touch with the Mr Valuations team.' },
  { path: 'account-dashboard', title: `Your Account | ${BRAND}`, description: 'Your Mr Valuations account.', noindex: true },
  { path: 'list-plate/success', title: `Listing Confirmed | ${BRAND}`, description: 'Your plate listing is confirmed.', noindex: true },
  { path: 'unsubscribed', title: `Unsubscribed | ${BRAND}`, description: 'You have been unsubscribed.', noindex: true },
];

/** @param {string} s */
function esc(s) {
  return String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

/** @param {string} plate */
function normalisePlate(plate) {
  return plate.replace(/\s/g, '').toUpperCase();
}

/** @param {Date | undefined} d */
function ukDate(d) {
  return d && !isNaN(d.getTime()) ? d.toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' }) : '';
}

/** @param {string} s */
function titleCase(s) {
  return s ? s.charAt(0).toUpperCase() + s.slice(1) : '';
}

/** JSON for an inline <script>, with `<` escaped so content can't close the tag. */
function jsonLd(data) {
  return `<script type="application/ld+json">${JSON.stringify(data).replace(/</g, '\\u003c')}</script>`;
}

/**
 * Swap the shell's page-specific head tags and fill <app-root>.
 * @param {string} shell Built docs/index.html.
 * @param {{path: string, title: string, description: string, ogType?: string,
 *   noindex?: boolean, schema?: object[], body?: string}} page
 * @return {string}
 */
function render(shell, page) {
  const url = `${SITE}/${page.path}/`;
  const title = esc(page.title);
  const desc = esc(page.description);
  const robots = page.noindex ? '\n  <meta name="robots" content="noindex">' : '';
  const schema = (page.schema ?? []).map(jsonLd).join('\n  ');

  const replace = (html, pattern, value) => {
    if (!pattern.test(html)) throw new Error(`prerender-pages: shell is missing ${pattern}`);
    return html.replace(pattern, value);
  };

  let html = shell;
  html = replace(html, /<title>[^<]*<\/title>/, `<title>${title}</title>`);
  html = replace(html, /<meta name="description" content="[^"]*">/, `<meta name="description" content="${desc}">${robots}`);
  html = replace(html, /<link rel="canonical" href="[^"]*">/, `<link rel="canonical" href="${url}">`);
  html = replace(html, /<meta property="og:type" content="[^"]*">/, `<meta property="og:type" content="${page.ogType ?? 'website'}">`);
  html = replace(html, /<meta property="og:url" content="[^"]*">/, `<meta property="og:url" content="${url}">`);
  html = replace(html, /<meta property="og:title" content="[^"]*">/, `<meta property="og:title" content="${title}">`);
  html = replace(html, /<meta property="og:description" content="[^"]*">/, `<meta property="og:description" content="${desc}">`);
  html = replace(html, /<meta property="twitter:url" content="[^"]*">/, `<meta property="twitter:url" content="${url}">`);
  html = replace(html, /<meta property="twitter:title" content="[^"]*">/, `<meta property="twitter:title" content="${title}">`);
  html = replace(html, /<meta property="twitter:description" content="[^"]*">/, `<meta property="twitter:description" content="${desc}">`);
  // The homepage's WebApplication/WebSite schema describes "/" only.
  html = html.replace(/\s*<script type="application\/ld\+json">[\s\S]*?<\/script>/g, '');
  if (schema) html = html.replace('</head>', `  ${schema}\n</head>`);
  html = replace(html, /<app-root><\/app-root>/, `<app-root>${page.body ?? ''}</app-root>`);
  return html;
}

/** @param {string} relPath @param {string} html */
function write(relPath, html) {
  const dir = path.join(DOCS, relPath);
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, 'index.html'), html);
}

/** @param {{label: string, href: string}[]} crumbs */
function breadcrumbSchema(crumbs) {
  return {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: crumbs.map((c, i) => ({ '@type': 'ListItem', position: i + 1, name: c.label, item: `${SITE}${c.href}` })),
  };
}

const PRERENDER_STYLE = `<style>.prerender{max-width:820px;margin:0 auto;padding:32px 20px;font-family:Cabin,Arial,sans-serif;line-height:1.6;color:#1d2430}.prerender a{color:#007a7a}.prerender ul{padding-left:1.2em}</style>`;

/** Plain-HTML header and footer nav shared by every generated body, so crawlers find the main sections from any page. */
function frame(inner) {
  return `${PRERENDER_STYLE}<main class="prerender">
<nav><a href="/">Free valuation</a> · <a href="/plates-for-sale/">Plates for sale</a> · <a href="/news/">News</a> · <a href="/list-plate/">Sell your plate</a></nav>
${inner}
</main>`;
}

async function main() {
  const shellPath = path.join(DOCS, 'index.html');
  if (!fs.existsSync(shellPath)) {
    console.error('prerender-pages: docs/index.html not found — run ng build first');
    process.exit(1);
  }
  const shell = fs.readFileSync(shellPath, 'utf8');

  initializeApp({ credential: cert(serviceAccount) });
  const db = getFirestore();
  const [articleSnap, newSnap, oldSnap] = await Promise.all([
    db.collection('articles').get(),
    db.collection('plate-listings-new').where('isSold', '==', false).get(),
    db.collection('plate-listings').where('isSold', '==', false).get(),
  ]);

  // Articles: the app resolves a slug with `where slug == x, limit 1`, which
  // returns the lowest document id; snapshot order is the same, so keep the first.
  const articles = [];
  const seenSlugs = new Set();
  for (const doc of articleSnap.docs) {
    const a = doc.data();
    if (!a.slug || seenSlugs.has(a.slug)) continue;
    seenSlugs.add(a.slug);
    articles.push({ ...a, publishedDate: a.publishedAt?.toDate?.() });
  }
  articles.sort((x, y) => (y.publishedDate?.getTime() ?? 0) - (x.publishedDate?.getTime() ?? 0));

  // Listings: the app's getByPlate takes the first match from new-then-old
  // listings, newest first.
  const byNewest = (x, y) => String(y.createdDate ?? '').localeCompare(String(x.createdDate ?? ''));
  const listings = [];
  const seenPlates = new Set();
  for (const l of [...newSnap.docs.map(d => d.data()).sort(byNewest), ...oldSnap.docs.map(d => d.data()).sort(byNewest)]) {
    if (!l.plateCharacters) continue;
    const plate = normalisePlate(l.plateCharacters);
    if (seenPlates.has(plate)) continue;
    seenPlates.add(plate);
    listings.push({ ...l, plate });
  }

  for (const page of STATIC_PAGES) {
    write(page.path, render(shell, page));
  }

  // News listing
  write('news', render(shell, {
    path: 'news',
    title: `Number Plate News & Guides | ${BRAND}`,
    description: 'Private number plate news, valuation guides and celebrity plates from Mr Valuations.',
    schema: [breadcrumbSchema([{ label: 'Home', href: '/' }, { label: 'News', href: '/news/' }])],
    body: frame(`<h1>Number plate news and guides</h1>
<ul>
${articles.map(a => `<li><a href="/news/${esc(a.slug)}/">${esc(a.title)}</a> — ${esc(ukDate(a.publishedDate))}<br>${esc(a.metaDescription)}</li>`).join('\n')}
</ul>`),
  }));

  // Articles
  for (const a of articles) {
    const related = articles.filter(r => r.category === a.category && r.slug !== a.slug).slice(0, 3);
    write(`news/${a.slug}`, render(shell, {
      path: `news/${a.slug}`,
      title: a.metaTitle || `${a.title} | ${BRAND}`,
      description: a.metaDescription || a.title,
      ogType: 'article',
      schema: [
        {
          '@context': 'https://schema.org',
          '@type': 'Article',
          headline: a.title,
          description: a.metaDescription,
          datePublished: a.publishedDate?.toISOString(),
          mainEntityOfPage: `${SITE}/news/${a.slug}/`,
          image: `${SITE}/assets/og-image.png`,
          author: { '@type': 'Organization', name: BRAND, url: `${SITE}/` },
          publisher: { '@type': 'Organization', name: BRAND, url: `${SITE}/` },
        },
        breadcrumbSchema([{ label: 'Home', href: '/' }, { label: 'News', href: '/news/' }, { label: a.title, href: `/news/${a.slug}/` }]),
      ],
      body: frame(`<article>
<p><a href="/news/">Latest news</a> / ${esc(titleCase(a.category))} · ${esc(a.readTimeMinutes)} min read · ${esc(ukDate(a.publishedDate))}</p>
<h1>${esc(a.title)}</h1>
${a.content ?? ''}
</article>
<p><a href="/">What's your plate worth? Get a free instant valuation</a></p>
${related.length ? `<h2>Related articles</h2>\n<ul>\n${related.map(r => `<li><a href="/news/${esc(r.slug)}/">${esc(r.title)}</a></li>`).join('\n')}\n</ul>` : ''}`),
    }));
  }

  // Plates for sale listing
  write('plates-for-sale', render(shell, {
    path: 'plates-for-sale',
    title: `Private Number Plates For Sale | ${BRAND}`,
    description: `Browse ${listings.length} private number plates for sale from UK sellers, with asking prices and meanings.`,
    schema: [breadcrumbSchema([{ label: 'Home', href: '/' }, { label: 'Plates for sale', href: '/plates-for-sale/' }])],
    body: frame(`<h1>Private number plates for sale</h1>
<ul>
${listings.map(l => `<li><a href="/plates-for-sale/${esc(l.plate)}/">${esc(l.plateCharacters.toUpperCase())}</a> — £${esc(l.askingPrice)}${l.meanings ? ` — ${esc(l.meanings)}` : ''}</li>`).join('\n')}
</ul>`),
  }));

  // Plate detail pages
  for (const l of listings) {
    const display = l.plateCharacters.toUpperCase();
    const desc = `${l.plate} private number plate for sale at £${l.askingPrice}${l.meanings ? '. ' + l.meanings : ''}. Contact the seller directly on Mr Valuations.`;
    write(`plates-for-sale/${l.plate}`, render(shell, {
      path: `plates-for-sale/${l.plate}`,
      title: `${l.plate} Number Plate For Sale | ${BRAND}`,
      description: desc,
      ogType: 'product',
      schema: [
        {
          '@context': 'https://schema.org',
          '@type': 'Product',
          name: `${l.plate} Number Plate`,
          description: desc,
          url: `${SITE}/plates-for-sale/${l.plate}/`,
          offers: {
            '@type': 'Offer',
            price: Number(l.askingPrice) || 0,
            priceCurrency: 'GBP',
            availability: 'https://schema.org/InStock',
            url: `${SITE}/plates-for-sale/${l.plate}/`,
          },
        },
        breadcrumbSchema([{ label: 'Home', href: '/' }, { label: 'Plates for sale', href: '/plates-for-sale/' }, { label: l.plate, href: `/plates-for-sale/${l.plate}/` }]),
      ],
      body: frame(`<p><a href="/plates-for-sale/">All plates for sale</a></p>
<h1>${esc(display)} number plate for sale</h1>
<p><strong>Asking price: £${esc(l.askingPrice)}</strong></p>
${l.meanings ? `<p>Meaning: ${esc(l.meanings)}</p>` : ''}
${l.plateType ? `<p>${esc(l.plateType)}${l.plateCategory ? ` · ${esc(l.plateCategory)}` : ''}</p>` : ''}
${l.createdDate ? `<p>Listed ${esc(ukDate(new Date(l.createdDate)))}</p>` : ''}
<p><a href="/">Get a free valuation for your own plate</a></p>`),
    }));
  }

  console.log(
    `prerender-pages: wrote ${STATIC_PAGES.length + 2 + articles.length + listings.length} pages ` +
    `(${articles.length} articles, ${listings.length} plates, ${STATIC_PAGES.length + 2} app pages)`);
}

main().catch(err => {
  console.error('prerender-pages failed:', err);
  process.exit(1);
});
