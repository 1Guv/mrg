/**
 * Generates standalone static legal pages from the Angular component templates,
 * so they are reachable at real paths with a real 200 status.
 *
 * The app is hash-routed, so `/#/privacy-policy` is invisible to crawlers and to
 * fetchers like Google's OAuth consent-screen validator — they only ever see the
 * SPA shell at `/`. These generated pages give those consumers a real URL while
 * the in-app routes stay the source of truth for the text.
 *
 * Output: src/privacy-policy/index.html, src/terms/index.html
 * (copied into the build by the `assets` entries in angular.json)
 *
 * Usage: node scripts/build-legal-pages.mjs
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, '..');
const SITE = 'https://mrvaluations.co.uk';

const PAGES = [
  {
    slug: 'privacy-policy',
    title: 'Privacy Policy | Mr Valuations',
    description:
      'How Mr Valuations collects, uses and protects your personal data, and your rights under UK GDPR.',
    fragment: 'src/app/core/privacy-policy/privacy-policy.component.html',
  },
  {
    slug: 'terms',
    title: 'Terms of Service | Mr Valuations',
    description:
      'The terms governing your use of the Mr Valuations number plate valuation and marketplace service.',
    fragment: 'src/app/core/terms/terms.component.html',
  },
];

/**
 * Wrap a component template fragment in a complete HTML document.
 * @param {{slug: string, title: string, description: string}} page Page metadata.
 * @param {string} body The component template fragment.
 * @return {string} A full HTML document.
 */
function wrap(page, body) {
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${page.title}</title>
<meta name="description" content="${page.description}">
<link rel="canonical" href="${SITE}/${page.slug}/">
<link rel="icon" href="/favicon.ico">
<style>
  body { margin: 0; background: #fff; }
  a { color: #1a73e8; }
  h1, h2 { line-height: 1.3; }
  .back { display: inline-block; margin: 24px auto 0; max-width: 800px; padding: 0 24px;
          font-family: Arial, sans-serif; font-size: 14px; }
</style>
</head>
<body>
<a class="back" href="/">&larr; Back to mrvaluations.co.uk</a>
${body}
</body>
</html>
`;
}

for (const page of PAGES) {
  const src = path.join(ROOT, page.fragment);
  if (!fs.existsSync(src)) {
    console.error(`build-legal-pages: missing fragment ${page.fragment}`);
    process.exit(1);
  }
  const body = fs.readFileSync(src, 'utf8').trim();
  const outDir = path.join(ROOT, 'src', page.slug);
  fs.mkdirSync(outDir, { recursive: true });
  fs.writeFileSync(path.join(outDir, 'index.html'), wrap(page, body));
  console.log(`build-legal-pages: wrote src/${page.slug}/index.html`);
}
