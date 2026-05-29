# Buyer Search Tracking — Design Spec

**Date:** 2026-05-29  
**Status:** Approved

---

## Overview

Track what users search for on the plates-for-sale page. After a 1-second debounce, any search term of 2+ characters is written to a new `buyer_searches` Firestore collection including the term and how many results it returned. This data surfaces in two places: the existing Sunday weekly email report and a new section in the admin dashboard.

---

## Data Model

### `buyer_searches` (new Firestore collection)

One document per debounced search event.

| Field | Type | Description |
|---|---|---|
| `term` | string | Search term (lowercase, trimmed, spaces removed) |
| `resultsCount` | number | Number of listings matching at time of recording |
| `searchedAt` | Timestamp | When the search was recorded |
| `userId` | string \| null | Firebase Auth UID if logged in, null for guests |

### Firestore Rules

Public write (guests can search), admin read only — same pattern as `plate_searches`.

```
match /buyer_searches/{docId} {
  allow create: if true;
  allow read: if request.auth != null
    && exists(/databases/$(database)/documents/admins/$(request.auth.uid));
  allow update, delete: if false;
}
```

---

## Angular Changes

### `PlatesForSaleComponent`

- Inject `Firestore` and `AuthService`.
- Add a `Subject<string>` wired to `(ngModelChange)` on the existing search input.
- Pipe through `debounceTime(1000)` and `distinctUntilChanged()`.
- On each emission where `term.length >= 2`: write a `buyer_searches` document via `addDoc`.
- `resultsCount` is read from `this.filteredListings.length` at the moment of recording.
- Unsubscribe in `ngOnDestroy`.

No template changes required — the existing `[(ngModel)]` binding on `searchTerm` is replaced with `[ngModel]` + `(ngModelChange)` to allow the Subject to intercept changes.

### `AdminService`

Add `getBuyerSearches()` method returning `Observable<BuyerSearch[]>`, querying `buyer_searches` ordered by `searchedAt` descending.

Add `BuyerSearch` interface:
```typescript
export interface BuyerSearch {
  id?: string;
  term: string;
  resultsCount: number;
  searchedAt: any;
  userId?: string | null;
}
```

### `AdminComponent`

Add a new **"Buyer Searches"** card alongside existing admin cards. Data passed as an `input()` from `AccountDashboardComponent`.

Table columns: `term`, `resultsCount`, `searchedAt`.  
Sorted by `searchedAt` descending (handled by Firestore query).

### `AccountDashboardComponent`

- Add `buyerSearches$` signal loaded via `adminService.getBuyerSearches()` in `ngOnInit`, admin-only (same pattern as other admin data).
- Pass to `AdminComponent` as a new input.

---

## Weekly Email Report

Add a **Buyer Searches** section to `runWeeklyReport()` in `functions/src/index.ts`, inserted between Plate Searches and Feature Requests.

**Query:** `buyer_searches` where `searchedAt >= sevenDaysAgo`.

**Display:**
- Total search count for the week.
- Top 10 most searched terms (grouped, counted, average results count).
- Count of zero-result searches — useful for spotting missing listings.

**Table structure:**

| Term | Searches | Avg Results |
|---|---|---|
| AB12 | 7 | 4 |
| GUV | 5 | 0 |

Zero-result count shown below the table as a callout:  
`⚠️ X searches returned 0 results`

---

## Firestore Index

`buyer_searches` ordered by `searchedAt` descending — uses the auto-created single-field index, no explicit composite index needed.

---

## Sequence Summary

```
User types in plates-for-sale search box
  → ngModelChange fires Subject
  → debounceTime(1000) + distinctUntilChanged()
  → term.length >= 2: write buyer_searches doc

Admin visits dashboard
  → Buyer Searches table shows recent searches

Every Sunday 08:00
  → weeklyReport Cloud Function runs
  → queries buyer_searches for past 7 days
  → adds Buyer Searches section to email
```
