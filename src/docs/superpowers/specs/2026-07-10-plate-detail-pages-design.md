# Plate Detail Pages & SEO Design

**Date:** 2026-07-10
**Status:** Approved

## Overview

Individual, Google-indexable pages for each plate listing, reachable via a clean URL containing the plate characters. Each listing card on `/plates-for-sale` gets an `open_in_new` icon button linking to the detail page. The existing "Message Seller" modal is unchanged.

---

## Goals

- Give every plate listing a dedicated, shareable URL
- Allow Google to index individual listings so searches like "AB12 XYZ plate for sale" can surface the page
- Follow existing project SEO patterns (dynamic Title/Meta, canonical, JSON-LD) used by the news article pages
- Zero breaking changes to the existing listing cards and modal flow

---

## Architecture

### 1. Routing

New route added to `app.routes.ts`:

```
/plates-for-sale/:plate
```

The `:plate` param is the plate characters with spaces stripped and uppercased — e.g. "AB12 XYZ" → `AB12XYZ`. This normalisation is applied consistently when generating links and when reading the route param.

---

### 2. New `PlateDetailComponent`

**Route:** `/plates-for-sale/:plate`

**Page content:**
- "← Back to all plates" link (navigates to `/plates-for-sale`)
- Yellow plate display (`.plate-css` / `.bevel-plate` — same styling as listing cards)
- Asking price
- Meanings (if present)
- Plate type and category
- Listed date
- "Message Seller" button — opens existing `MessageSellerDialogComponent` (identical behaviour to the listing cards)
- "Copy link" button — copies the current page URL to clipboard

**Not found state:** If the plate param doesn't match any listing (bad URL, plate delisted), shows a simple "Listing not found" message with a link back to `/plates-for-sale`.

---

### 3. `PlateListingService` changes

One new method:

```ts
getByPlate(plateChars: string): Observable<PlateListing | null>
```

- Normalises the input (strips spaces, uppercases)
- Queries both `plate-listings` and `plate-listings-new` collections by the `plateCharacters` field
- Returns the first match, or `null` if none found
- No changes to any existing methods

---

### 4. SEO

`PlateDetailComponent` uses Angular's `Title`, `Meta`, and `DOCUMENT` services — same pattern as `NewsArticleComponent`.

| Tag | Value |
|-----|-------|
| `<title>` | `{PLATE} Number Plate For Sale \| MR Valuations` |
| `<meta name="description">` | `{PLATE} private number plate for sale at £{price}. {meanings if present}. Contact the seller directly on MR Valuations.` |
| `<link rel="canonical">` | `https://mrvaluations.co.uk/plates-for-sale/{PLATE}` |
| JSON-LD | `Product` schema with `name`, `description`, and `offers.price` |

On component destroy, title and meta revert to site defaults.

---

### 5. Changes to `/plates-for-sale` listing cards

Each listing card in `PlatesForSaleComponent` gets an `open_in_new` Material icon button added alongside the existing "Message Seller" button. It is a `routerLink` to `/plates-for-sale/{PLATE}` (plate characters normalised). The modal and all existing card behaviour is unchanged.

---

### 6. Sitemap build script

**File:** `scripts/generate-sitemap.ts`

Runs automatically as the first step of `npm run build:gh-pages` (prepended to the existing build command in `package.json`).

**Steps:**
1. Connects to Firestore using service account credentials
2. Fetches all active (non-sold) listings from both `plate-listings` and `plate-listings-new`
3. Generates a URL per listing: `https://mrvaluations.co.uk/plates-for-sale/{PLATE}`
4. Merges with the existing static URLs (home, `/plates-for-sale`, `/news`, etc.)
5. Writes the updated `sitemap.xml` to `src/sitemap.xml`

Runs on every deploy so the sitemap always reflects the current listings at publish time. Adds ~2–3 seconds to the build.

---

## Out of Scope

- SSR / Angular Universal (not viable on GitHub Pages)
- Real-time sitemap updates via Cloud Function (overkill at current scale)
- Replacing the "Message Seller" modal with navigation to the detail page
- Pagination or filtering on the detail page
