# Design: "Me" Admin Tab & Firestore-Based Admin Identity

**Date:** 2026-03-29
**Status:** Approved

---

## Overview

Add a new "Me" tab to the account dashboard, visible only to admins. This tab consolidates the admin's own activity (searches, valuation feedback, plate valuation messages) in one place, separating it from real user activity. Simultaneously, migrate admin identity from a hardcoded email check to a Firestore `admins` collection.

---

## 1. Data & Admin Identity

### Firestore Collection: `admins`

Each document uses the admin's `uid` as the document ID:

```
admins/{uid} → { email: string, addedAt: Timestamp }
```

- Seeded manually via Firebase Console (initial record for `gurvinder.singh.sandhu@gmail.com`)
- Security rule: `read` for authenticated users, `write: false` (console-managed only)

### New `AdminsService`

**Path:** `src/app/services/admins.service.ts`

Responsibilities:
- Fetch the `admins` collection from Firestore once on load
- Expose `adminUids` as a signal (`string[]`)
- Expose `isAdmin(uid: string): boolean` helper

---

## 2. Component Structure

### New `MeComponent`

**Path:** `src/app/core/me/me.component.ts`

Rendered in the new "Me" tab. Contains three Material expansion panels (matching existing `AdminComponent` style):

1. **My Searches**
   - Moved verbatim from `AdminComponent`'s "My Searches" accordion panel
   - Filters `searches` input where `userId === currentUser().uid`
   - Shows: registration, type, badge, searchedAt, price columns

2. **My Valuation Feedback**
   - Filters `feedback` input where `userId` is in `adminsService.adminUids()`
   - Shows existing feedback table (registration, agreed, valuation, submittedAt)

3. **My Plate Valuation Messages**
   - Filters `plateMessages` input where `userId` is in `adminsService.adminUids()`
   - Shows existing messages table (registration, plateMeaning, valuation, message, submittedAt)

**Inputs received from `AccountDashboardComponent`:**
- `searches: PlateSearch[]`
- `feedback: ValuationFeedback[]`
- `plateMessages: PlateValuationMessage[]`
- `currentUser: UserProfile`

No new Firestore reads — data already loaded in `AccountDashboardComponent`.

### Changes to `AdminComponent`

- Remove the "My Searches" expansion panel entirely
- Replace inline hardcoded email check (`email === 'gurvinder.singh.sandhu@gmail.com'`) with `adminsService.isAdmin(currentUser()?.uid)`

---

## 3. Tab Layout

Tabs in `AccountDashboardComponent` after change (in order):

| # | Tab Label | Visibility |
|---|-----------|------------|
| 1 | Me | Admin only |
| 2 | Plate Searches | Admin only |
| 3 | User Details | All users |
| 4 | Saved Valuations | All users |

### Admin Check Migration

**Before:**
```typescript
get isAdmin(): boolean {
  return user?.email === 'gurvinder.singh.sandhu@gmail.com' && user?.emailVerified;
}
```

**After:**
```typescript
// Inject AdminsService
get isAdmin(): boolean {
  return this.adminsService.isAdmin(this.currentUser$()?.uid);
}
```

Applied in both `AccountDashboardComponent` and `AdminComponent`.

---

## 4. Out of Scope

- "Saved Valuations" tab — unchanged
- Adding/removing admins via UI — console-managed only for now
- Role levels (all admins are equal)
