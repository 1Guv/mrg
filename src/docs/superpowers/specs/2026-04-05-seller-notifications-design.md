# Seller Notifications & Dashboard Messages — Design Spec
**Date:** 2026-04-05

## Overview
When a buyer sends an enquiry via the Message Seller dialog, three additional things happen:
1. The seller receives an email notification to their `lCEmail` address
2. The enquiry appears in a new "Messages" tab on the seller's account dashboard
3. The `viewsPlaceholder` field on the plate listing increments by 1

---

## Architecture

### Modified Files

| File | Change |
|------|--------|
| `src/app/services/seller-enquiry.service.ts` | Add `sellerEmail` to interface; extend `saveEnquiry()` to send email + increment views; add `getEnquiriesForSeller()` |
| `src/app/services/plate-listing.service.ts` | Add `incrementViews(plateId: string)` |
| `src/app/shared/message-seller-dialog/message-seller-dialog.component.ts` | Pass full listing to `saveEnquiry()` |
| `src/app/core/account-dashboard/account-dashboard.component.ts` | Inject `SellerEnquiryService`, add `sellerEnquiries$` signal, load via `switchMap` on `currentUser$` |
| `src/app/core/account-dashboard/account-dashboard.component.html` | Add "Messages" tab |
| `firestore.rules` | Allow seller to read own enquiries; allow authenticated users to update `viewsPlaceholder` only |

---

## 1. Data Model Changes

### `SellerEnquiry` interface — add `sellerEmail`

```typescript
export interface SellerEnquiry {
  plateId: number;
  plateCharacters: string;
  enquiryType: string;
  message: string;
  buyerUid: string;
  buyerEmail: string;
  sellerLCNumber: string;
  sellerEmail: string;       // NEW — from listing.lCEmail
  submittedAt?: any;         // added by serverTimestamp() on write
}
```

---

## 2. SellerEnquiryService Changes

### `saveEnquiry()` — extended signature

Accepts the full `PlateListing` and form values so it can derive `sellerEmail`, `askingPrice`, and `plateCharacters` for the email body. All three writes fire in parallel via `Promise.all`:

```typescript
async saveEnquiry(
  listing: PlateListing,
  enquiryType: string,
  message: string,
  buyerUid: string,
  buyerEmail: string
): Promise<void>
```

**Writes:**
1. `seller_enquiries` — full document including `sellerEmail: listing.lCEmail`
2. `mail` — email notification to seller
3. `plate-listings/[listing.id]` — increment `viewsPlaceholder` by 1

### Email document written to `mail` collection

```typescript
{
  to: [listing.lCEmail],
  message: {
    subject: `New enquiry for your plate ${listing.plateCharacters.toUpperCase()}`,
    html: `
      <h2>You have a new enquiry!</h2>
      <p><strong>Plate:</strong> ${listing.plateCharacters.toUpperCase()}</p>
      <p><strong>Listed at:</strong> £${listing.askingPrice}</p>
      <p><strong>Enquiry type:</strong> ${enquiryType}</p>
      <p><strong>Message:</strong> ${message}</p>
      <p><strong>From:</strong> ${buyerEmail}</p>
      <p><strong>Sent:</strong> ${new Date().toLocaleString('en-GB')}</p>
    `
  }
}
```

### `getEnquiriesForSeller(email: string): Observable<SellerEnquiry[]>`

Queries `seller_enquiries` where `sellerEmail == email`, ordered by `submittedAt desc`.

---

## 3. PlateListingService — `incrementViews(plateId: string)`

Uses Firestore `updateDoc` + `increment(1)` on the `viewsPlaceholder` field:

```typescript
incrementViews(plateId: string): Promise<void> {
  const ref = doc(this.firestore, `plate-listings/${plateId}`);
  return updateDoc(ref, { viewsPlaceholder: increment(1) }).then(() => {});
}
```

---

## 4. MessageSellerDialogComponent — updated `onSubmit()`

The call to `saveEnquiry()` passes the full listing and form values instead of a flat object:

```typescript
await this.enquiryService.saveEnquiry(
  this.listing,
  this.form.value.enquiryType,
  this.form.value.message,
  user!.uid,
  user!.email ?? ''
);
```

---

## 5. Account Dashboard — Messages Tab

### `account-dashboard.component.ts`

- Inject `SellerEnquiryService`
- Add `sellerEnquiries$ = signal<SellerEnquiry[]>([])`
- In `ngOnInit`, add subscription using `switchMap` on `authService.currentUser$`:

```typescript
this.subs.add(
  this.authService.currentUser$.pipe(
    switchMap(user => user?.email
      ? this.sellerEnquiryService.getEnquiriesForSeller(user.email)
      : of([])
    )
  ).subscribe(enquiries => this.sellerEnquiries$.set(enquiries))
);
```

### `account-dashboard.component.html`

New tab added after "Saved Valuations":

```html
<mat-tab [label]="'Messages (' + sellerEnquiries$().length + ')'">
  <div class="tab-content">
    @if (sellerEnquiries$().length === 0) {
      <p class="text-muted mt-3 text-center">
        No messages yet. When someone enquires about your plate, it will appear here.
      </p>
    } @else {
      @for (enquiry of sellerEnquiries$(); track enquiry.plateId) {
        <div class="enquiry-card">
          <div class="enquiry-plate">
            <span class="bevel-plate">{{ enquiry.plateCharacters }}</span>
          </div>
          <p class="enquiry-type">{{ enquiry.enquiryType }}</p>
          <p class="enquiry-message">{{ enquiry.message }}</p>
          <p class="enquiry-meta">From: {{ enquiry.buyerEmail }}</p>
          <p class="enquiry-meta">{{ enquiry.submittedAt?.toDate() | date:'d MMM y, HH:mm' }}</p>
        </div>
      }
    }
  </div>
</mat-tab>
```

---

## 6. Firestore Rules

### `seller_enquiries` — add read rule for seller

```
match /seller_enquiries/{docId} {
  allow create: if request.auth != null;
  allow read: if request.auth != null
    && request.auth.token.email == resource.data.sellerEmail;
  allow update, delete: if false;
}
```

### `plate-listings` — allow increment of `viewsPlaceholder` only

```
match /plate-listings/{docId} {
  allow read: if true;
  allow update: if request.auth != null
    && request.resource.data.diff(resource.data).affectedKeys().hasOnly(['viewsPlaceholder']);
  allow create, delete: if false;
}
```

---

## Data Flow

```
Buyer submits message form
  → MessageSellerDialogComponent.onSubmit()
    → SellerEnquiryService.saveEnquiry(listing, enquiryType, message, buyerUid, buyerEmail)
        → Promise.all([
            addDoc(seller_enquiries, { ...data, sellerEmail, submittedAt }),
            addDoc(mail, { to: [lCEmail], message: { subject, html } }),
            PlateListingService.incrementViews(listing.id)
          ])
        → success: dialog shows confirmation state

Seller opens Account Dashboard → Messages tab
  → getEnquiriesForSeller(currentUser.email)
    → Firestore: seller_enquiries where sellerEmail == email, orderBy submittedAt desc
    → sellerEnquiries$ signal populated → enquiry cards rendered
```
