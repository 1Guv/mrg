# Plate Listing Nudge Email System — Design Spec

**Date:** 2026-05-29  
**Status:** Approved

---

## Overview

When a user values a plate on MR Valuations, we send them a follow-up email sequence encouraging them to list it for sale at £6. The first email fires 24 hours after their valuation; if they don't list, subsequent emails fire every 48 hours indefinitely. Emails stop when the user lists their plate, unsubscribes via a one-click link in the email, or toggles off the preference in their account dashboard.

Both authenticated users and users who came through the user-details dialog (who have Firebase Auth accounts auto-created) are included. All valuations are sourced from the `auto_valuations` collection, which always stores the user's email directly. The first-valuation-wins rule applies: if the same email+plate combo is valued more than once, only the first valuation starts the campaign.

---

## Data Model

### `listing_nudge_queue` (new Firestore collection)

One document per unique `email + registration` combo.

| Field | Type | Description |
|---|---|---|
| `email` | string | User's email address |
| `registration` | string | Plate in uppercase, no spaces (e.g. `AB12CDE`) |
| `firstValuationAt` | Timestamp | When the first valuation for this combo occurred |
| `nextSendAt` | Timestamp | When the next email should fire |
| `lastSentAt` | Timestamp \| null | When the last email was sent (`null` if none sent yet) |
| `sendCount` | number | Number of emails sent so far |
| `unsubscribed` | boolean | Whether the user has opted out |
| `unsubscribedAt` | Timestamp \| null | When they opted out (`null` if still subscribed) |
| `listed` | boolean | `true` once the plate appears in `plate-listings-new` |
| `firstName` | string | User's first name (for email personalisation) |
| `valuationMin` | number | Min price from the valuation (for email content) |
| `valuationMax` | number | Max price from the valuation (for email content) |

### Firestore Rules

`listing_nudge_queue` is written exclusively by Cloud Functions (admin SDK bypasses rules). Admin users can read all docs. Authenticated users cannot read or write directly — all mutations go through callable Cloud Functions.

```
match /listing_nudge_queue/{docId} {
  allow read: if request.auth != null
    && exists(/databases/$(database)/documents/admins/$(request.auth.uid));
  allow write: if false;
}
```

---

## Cloud Functions

### 1. `onAutoValuationCreated` — Firestore `onCreate` trigger

**Trigger:** `auto_valuations/{docId}` on create  
**Purpose:** Seed the nudge queue for new valuations.

Logic:
1. Extract `email`, `registration`, `firstName`, `minPrice`, `maxPrice`, `savedAt` from the new document.
2. Query `listing_nudge_queue` where `email == doc.email` AND `registration == doc.registration`.
3. If a document already exists: do nothing (first-valuation-wins).
4. If no document exists: create a new queue entry with:
   - `nextSendAt = savedAt + 24 hours`
   - `sendCount = 0`
   - `unsubscribed = false`
   - `listed = false`
   - `lastSentAt = null`

### 2. `scheduledNudgeEmails` — scheduled, every 6 hours

**Schedule:** `every 6 hours`  
**Purpose:** Process the queue and send due emails.

Logic:
1. Query `listing_nudge_queue` where `nextSendAt <= now`, `unsubscribed == false`, `listed == false`.
2. For each document:
   a. Query `plate-listings-new` where `plateCharacters == doc.registration`. If found, update `listed = true` and skip.
   b. Generate a signed unsubscribe token: `HMAC-SHA256(email, NUDGE_UNSUBSCRIBE_SECRET)`.
   c. Write to `mail` collection to trigger the Firebase Trigger Email extension.
   d. Update the queue doc: `sendCount += 1`, `lastSentAt = now`, `nextSendAt = now + 48 hours`.

The `NUDGE_UNSUBSCRIBE_SECRET` is stored as a Firebase Secret (`defineSecret`).

### 3. `unsubscribeNudge` — HTTP GET endpoint (unauthenticated)

**URL:** `GET /unsubscribeNudge?token=<hmac>&email=<email>`  
**Purpose:** One-click unsubscribe from email link.

Logic:
1. Read `email` and `token` from query params.
2. Recompute `HMAC-SHA256(email, NUDGE_UNSUBSCRIBE_SECRET)` and compare to `token`. If mismatch: return 400.
3. Query all `listing_nudge_queue` docs where `email == email`.
4. Batch update all to `unsubscribed = true`, `unsubscribedAt = now`.
5. Redirect to `https://mrvaluations.co.uk/unsubscribed`.

### 4. `toggleNudgeEmails` — callable Cloud Function (authenticated)

**Purpose:** Account dashboard toggle — subscribe/unsubscribe the current user globally.

Input: `{ optOut: boolean }`

Logic:
1. Verify `request.auth` is present; throw `unauthenticated` if not.
2. Get user email from `admin.auth().getUser(request.auth.uid)`.
3. Query all `listing_nudge_queue` docs where `email == userEmail`.
4. Batch update all docs:
   - If `optOut = true`: set `unsubscribed = true`, `unsubscribedAt = now`
   - If `optOut = false` (re-subscribing): set `unsubscribed = false`, `unsubscribedAt = null`, `nextSendAt = now + 48h` (prevents immediate fire from a stale `nextSendAt`)
5. Return `{ success: true }`.

---

## Email Content

**Subject:** `Your plate [XX12ABC] could be worth £X,XXX — have you thought about listing it?`

**HTML body:**

```
Hi [First Name],

You recently valued your number plate [XX12ABC] on MR Valuations — 
and the good news is it's estimated to be worth between £[min] and £[max].

If you've ever thought about selling it, now could be the perfect time. 
Thousands of buyers visit MR Valuations every month specifically looking 
for plates like yours.

Listing your plate is just £6 — a one-off fee, and it stays listed 
until it sells. No commission, no monthly charges, no hassle.

Why list with us?
• Reach genuine buyers actively searching for private plates
• Keep 100% of your sale price — we never take commission
• Your listing stays live until you sell
• Takes less than 2 minutes to set up

[List My Plate for £6 →]  →  https://mrvaluations.co.uk/list-plate

If you'd rather not hear from us about this, no problem at all.
Unsubscribe from these emails  →  https://<fn-url>/unsubscribeNudge?email=...&token=...

The MR Valuations Team
```

---

## Angular Changes

### 1. Account dashboard — user opt-out toggle

**Location:** existing `UserAccountDetailsComponent` or the User Details tab in `AccountDashboardComponent`

Add a `mat-slide-toggle` labelled **"Plate listing suggestions"** with helper text:
> "Receive occasional emails about listing your valued plates for sale."

On toggle change: call `toggleNudgeEmails` callable function with `{ optOut: !newValue }`.

On load: call a new lightweight callable function `getNudgeStatus` that returns `{ optedOut: boolean }` for the current user. This queries `listing_nudge_queue` where `email == userEmail` and returns `true` if any doc has `unsubscribed = true`. The toggle initialises to `!optedOut`.

### 2. Admin tab — Nudge Queue section

**Location:** existing admin section in `AccountDashboardComponent` (alongside plate searches, feedback, etc.)

New admin-only section displaying all `listing_nudge_queue` documents, sorted by `nextSendAt` ascending. Exclude documents where `listed = true`.

Columns:
| Email | Plate | Next Send | Last Sent | Emails Sent | Unsubscribed |
|---|---|---|---|---|---|

- Unsubscribed rows rendered with reduced opacity (greyed out).
- Dates formatted as `dd/MM/yyyy HH:mm` using Angular's `DatePipe`.
- "Next Send" shows `—` if `unsubscribed = true`.
- Data fetched via a new `AdminService` method `getNudgeQueue()` that reads the collection using the admin SDK pattern (Firestore rules allow admin reads).

### 3. New route: `/unsubscribed`

A simple standalone Angular component at `/unsubscribed`:

> **You've been unsubscribed.**  
> You won't receive any more listing suggestion emails from us.  
> [Back to homepage →]

No auth required. Registered in `app.routes.ts`.

---

## Secrets

One new Firebase Secret required:

| Secret name | Description |
|---|---|
| `NUDGE_UNSUBSCRIBE_SECRET` | Random string (32+ chars) used to sign/verify unsubscribe tokens |

Add to `defineSecret(...)` in `functions/src/index.ts` and include in the relevant function secrets arrays.

---

## Firestore Indexes

The scheduled function queries `listing_nudge_queue` with a composite filter:
- `nextSendAt <= now` + `unsubscribed == false` + `listed == false`

This requires a composite index on `listing_nudge_queue`:  
`(unsubscribed ASC, listed ASC, nextSendAt ASC)`

Add to `firestore.indexes.json`.

---

## Sequence Summary

```
User values plate
  → auto_valuations doc created
  → onAutoValuationCreated trigger fires
  → listing_nudge_queue entry created (nextSendAt = +24h)

scheduledNudgeEmails runs every 6h
  → finds due entries (nextSendAt <= now, not unsubscribed, not listed)
  → checks plate-listings-new
  → sends email via mail collection
  → updates nextSendAt = now + 48h

User clicks unsubscribe link in email
  → unsubscribeNudge HTTP endpoint
  → all queue entries for email marked unsubscribed
  → redirect to /unsubscribed

User toggles off in account dashboard
  → toggleNudgeEmails callable
  → all queue entries for email marked unsubscribed
```
