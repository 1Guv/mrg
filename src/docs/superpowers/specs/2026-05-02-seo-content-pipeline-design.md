# SEO Content Pipeline Design

**Date:** 2026-05-02  
**Status:** Approved  

## Overview

An automated SEO content pipeline that generates keyword-targeted articles daily using Gemini 2.5 Flash, stores them in Firestore, and surfaces them in a new "Latest News" section of the Angular app. Every article links back to the core app actions (free valuation, list a plate) to drive conversions.

---

## Goals

- Increase organic search traffic by publishing daily SEO-optimised articles targeting number plate valuation keywords
- Fully automated — no manual intervention required after setup
- Zero ongoing cost (all services within free tiers)
- Each article funnels readers back to the main app via CTAs

---

## Architecture

### 1. Angular App (frontend)

**New route: `/news`** — Article listing page  
**New route: `/news/:slug`** — Individual article page  
**Nav:** Single "Latest News" item added to the sidebar (below Cars)

**Listing page (`/news`):**
- 2-column card grid
- Filter tabs at the top: All | Valuations | Plates | Cars
- Each card shows: category label, title, read time, date
- Cards link to `/news/:slug`
- Articles loaded from Firestore `articles` collection, ordered by `publishedAt` descending

**Article page (`/news/:slug`):**
- Two-column layout on desktop: article body (70%) + sidebar (30%)
- On mobile: article body stacks above sidebar (full width)
- Sidebar contains:
  - "Value your plate free" widget (reg input + "Get valuation →" button linking to `/`)
  - "List your plate free" CTA button linking to `/list-plate`
  - Related articles (3 links, same category)
- Article body renders HTML content from Firestore
- `<title>` and `<meta name="description">` set dynamically per article for SEO
- Structured data: `Article` JSON-LD schema injected per page

**New `ArticleService`:**
- `getArticles(category?: string): Observable<Article[]>` — listing page
- `getArticleBySlug(slug: string): Observable<Article>` — article page

**Article model:**
```typescript
interface Article {
  id: string;
  slug: string;
  title: string;
  metaTitle: string;
  metaDescription: string;
  category: 'valuations' | 'plates' | 'cars';
  targetKeyword: string;
  content: string; // HTML string
  readTimeMinutes: number;
  publishedAt: Timestamp;
}
```

---

### 2. Firebase Cloud Function (automation)

**Function name:** `generateDailyArticle`  
**Trigger:** Firebase scheduled function — runs daily at 08:00 UK time (Europe/London)  
**Runtime:** Node.js 20

**Flow:**

1. **Load used keywords** — read `meta/usedKeywords` document from Firestore to avoid duplicate articles
2. **Fetch GSC keyword data** — call Search Console API using stored OAuth token (saved in Firebase Secret Manager as `GSC_TOKEN`)
3. **Select target keyword** — pick the highest-opportunity unused keyword from: quick wins (position 5–40, 2+ impressions) first, then untapped (2+ impressions, 0 clicks)
4. **Generate article** — call Gemini 2.5 Flash with a structured prompt instructing it to return a JSON object (see Article Template below)
5. **Parse response** — JSON.parse the response to extract title, metaTitle, metaDescription, category, content (HTML string), slug, readTimeMinutes
6. **Write to Firestore** — save to `articles` collection with `publishedAt: now()`
7. **Update used keywords** — append target keyword to `meta/usedKeywords`
8. **Log result** — write to `meta/generationLog` for debugging

**Secrets stored in Firebase Secret Manager:**
- `GEMINI_API_KEY` — Gemini 2.5 Flash API key
- `GSC_TOKEN` — Google Search Console OAuth token JSON
- `GSC_CREDENTIALS` — Google OAuth client credentials JSON

---

### 3. Article Template (Gemini prompt structure)

Every generated article follows this structure:

```
H1: [keyword as natural title]
Meta title: [60 chars max, includes keyword]
Meta description: [155 chars max, compelling + includes keyword]
Category: [valuations | plates | cars]
Slug: [kebab-case url slug]

Intro paragraph (2–3 sentences, keyword in first sentence)

H2: [subtopic 1]
Body (150–200 words)

H2: [subtopic 2]
Body (150–200 words)

H2: [subtopic 3]
Body (150–200 words)

[Inline CTA callout: "Want to know what your plate is worth? Get a free instant valuation →"]

H2: [subtopic 4]
Body (150–200 words)

H2: Frequently Asked Questions
Q: [question targeting long-tail variant 1]
A: [2–3 sentence answer]
Q: [question targeting long-tail variant 2]
A: [2–3 sentence answer]
Q: [question targeting long-tail variant 3]
A: [2–3 sentence answer]

Conclusion (2–3 sentences + CTA to value plate or list plate)
```

Target length: 800–1,200 words. UK English. No keyword stuffing.

---

## Firestore Data Model

### Collection: `articles`

Each document:
```
{
  slug: "how-to-value-your-private-plate-2026",
  title: "How to Value Your Private Plate in 2026",
  metaTitle: "How to Value Your Private Plate in 2026 | MR Valuations",
  metaDescription: "Get an accurate private plate valuation in seconds...",
  category: "plates",
  targetKeyword: "instant number plate valuation",
  content: "<h2>...</h2><p>...</p>...",
  readTimeMinutes: 4,
  publishedAt: Timestamp
}
```

### Document: `meta/usedKeywords`

```
{
  keywords: ["instant number plate valuation", "free plate valuation", ...]
}
```

### Document: `meta/generationLog`

```
{
  entries: [
    { date: "2026-05-02", keyword: "instant number plate valuation", slug: "...", status: "success" },
    ...
  ]
}
```

---

## Firestore Security Rules

Articles are public read (no auth required — needed for SEO and anonymous visitors):
```
match /articles/{articleId} {
  allow read: if true;
  allow write: if false; // written only by Cloud Function (admin SDK)
}
match /meta/{docId} {
  allow read, write: if false; // Cloud Function only
}
```

---

## SEO Considerations

- Angular Universal / SSR is not in scope. Pages are served as a SPA (GitHub Pages). To mitigate SEO limitations, each article page sets `<title>` and `<meta>` tags dynamically via Angular's `Title` and `Meta` services — sufficient for Google's JavaScript-rendering crawler.
- Each article gets a canonical `<link rel="canonical">` tag
- JSON-LD `Article` structured data injected per page
- Article URLs follow pattern: `mrvaluations.co.uk/news/[slug]`

---

## Out of Scope

- Image generation for article cards (placeholder colour blocks used initially)
- Social media auto-posting of articles (separate pipeline, already in progress)
- Admin UI for reviewing/editing articles
- Pagination on the listing page (not needed until 20+ articles exist)
- Email notifications when a new article is published

---

## Environments & Configuration

| Secret | Stored in | Used by |
|---|---|---|
| `GEMINI_API_KEY` | Firebase Secret Manager | Cloud Function |
| `GSC_TOKEN` | Firebase Secret Manager | Cloud Function |
| `GSC_CREDENTIALS` | Firebase Secret Manager | Cloud Function |

The `scripts/gsc-token.json` and `scripts/gsc-credentials.json` local files are gitignored and used only for the one-time auth flow. The Cloud Function reads its secrets from Secret Manager at runtime.
