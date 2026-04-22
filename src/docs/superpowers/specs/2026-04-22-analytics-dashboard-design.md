# Site Analytics Dashboard — Design Spec

**Goal:** Display GA4 sessions and page views in the Me tab — per-day for the last 14 days, plus current week, last week, and all-time totals.

**Property ID:** `494849507`
**Measurement ID:** `G-XRSRVZ3GTC`
**Service account:** `firebase-adminsdk-fbsvc@code-g-b8b6f.iam.gserviceaccount.com`

---

## Architecture

A new `getAnalytics` Firebase Cloud Function (`onCall`, admin-only) queries the GA4 Data API using the existing service account credentials stored in Firebase Secrets. A new `AnalyticsService` in Angular calls the function. The Me tab gains a `📈 Site Analytics` card with a manual Refresh button.

---

## Cloud Function: `getAnalytics`

**File:** `functions/src/index.ts` (exported alongside existing functions)

**Type:** `onCall` — admin-only (same email check as `getUsers`)

**Secrets used:** `SHEETS_CLIENT_EMAIL`, `SHEETS_PRIVATE_KEY` (existing — same service account)

**GA4 package:** `@google-analytics/data` (add to `functions/package.json`)

### Logic

Two GA4 `runReport` calls:

1. **Daily report** — last 14 days, dimensions: `date`, metrics: `sessions`, `screenPageViews`
2. **All-time report** — `startDate: 2020-01-01`, `endDate: today`, metrics: `sessions`, `screenPageViews` (single row, no dimension)

Week boundaries computed in the function:
- **Current week:** Monday of the current ISO week → today
- **Last week:** Monday → Sunday of the previous ISO week

Totals for current/last week are derived from the daily rows (no extra API call needed).

### Return shape

```ts
interface AnalyticsData {
  daily: Array<{ date: string; sessions: number; pageViews: number }>; // YYYY-MM-DD, last 14 days, newest first
  currentWeek:  { sessions: number; pageViews: number };
  lastWeek:     { sessions: number; pageViews: number };
  allTime:      { sessions: number; pageViews: number };
}
```

### Error handling

- Non-admin caller → `HttpsError('permission-denied')`
- GA4 API failure → `HttpsError('internal', <message>)`

---

## Angular: `AnalyticsService`

**File:** `src/app/services/analytics.service.ts`

Thin wrapper around the `getAnalytics` callable function, identical pattern to `SocialPostService`.

```ts
getAnalytics(): Promise<AnalyticsData>
```

---

## Me Tab Card

**Location:** Top of the Me tab, above Content Queue (most useful data first)

```
📈 Site Analytics                         [Refresh]

              Sessions    Page views
This week        42          118
Last week        67          201
All time      1,204        3,891

──────────────────────────────────────────
Date          Sessions    Page views
21 Apr 2026       8           23
20 Apr 2026      11           31
...
```

**States:**
- **Initial:** shows "Load analytics" prompt — data is not fetched on component init, only on button press
- **Loading:** button shows "Loading..." and is disabled
- **Loaded:** summary rows + daily table rendered
- **Error:** inline error message below the button

---

## Manual prerequisite

The service account `firebase-adminsdk-fbsvc@code-g-b8b6f.iam.gserviceaccount.com` must be granted **Viewer** access on GA4 property `494849507`:

> GA4 → Admin → Property Access Management → Add user → paste email → Viewer → Add

---

## Out of scope

- Caching / Firestore persistence
- Charts or graphs
- Non-admin access
- Metrics beyond sessions and page views
