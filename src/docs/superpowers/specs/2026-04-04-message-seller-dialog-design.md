# Message Seller Dialog — Design Spec
**Date:** 2026-04-04

## Overview
When a logged-in user clicks "Message Seller" on a plate listing card, a dialog opens allowing them to send an enquiry to the seller. The enquiry is saved to Firestore and a WhatsApp link is provided as an alternative channel. If the user is not logged in, a lightweight auth prompt dialog is shown instead, directing them to log in or register.

---

## Architecture

### New Components & Services

| File | Purpose |
|------|---------|
| `src/app/shared/auth-prompt-dialog/auth-prompt-dialog.component.ts` | Small dialog shown to unauthenticated users |
| `src/app/shared/message-seller-dialog/message-seller-dialog.component.ts` | Main enquiry form dialog for authenticated users |
| `src/app/services/seller-enquiry.service.ts` | Writes enquiry documents to Firestore `seller_enquiries` collection |

### Modified Files

| File | Change |
|------|--------|
| `src/app/core/plates-for-sale/plates-for-sale.component.ts` | Add `onMessageSeller(listing)` handler, import new dialogs |
| `src/app/core/plates-for-sale/plates-for-sale.component.html` | Wire `(click)="onMessageSeller(listing)"` to Message Seller button |

---

## Auth Prompt Dialog

**Selector:** `app-auth-prompt-dialog`
**Width:** `380px`
**disableClose:** `false`

### UI
- Short message: "You need to be logged in to message a seller."
- **Log in** button — closes dialog, navigates to `/login`
- **Register** button — closes dialog, navigates to `/register`
- No form fields, no data input required.

### Data
No `MAT_DIALOG_DATA` needed.

---

## Message Seller Dialog

**Selector:** `app-message-seller-dialog`
**Width:** `520px`
**disableClose:** `false`

### Data In (via `MAT_DIALOG_DATA`)
```typescript
listing: PlateListing  // full listing object
```

### UI Layout

**Header:** `Message Seller › [plateCharacters]`

**Plate summary (read-only):**
- Plate rendered with existing `.plate-css` / `.bevel-plate` styling
- Meaning shown below (if `listing.meanings` is present)
- Asking price shown as pink pill (existing `.listing-price` style)

**Form fields:**
- **Enquiry type** (`mat-select`, required):
  - "I love this plate, I want to buy it"
  - "I'm interested, I want to provide an offer"
  - "Other"
- **Message** (`mat-textarea`, required, min length 10 chars)

**Actions:**
- **Send Message** (primary `mat-raised-button`) — submits to Firestore, shows inline success state on completion
- **WhatsApp** (`mat-stroked-button` with WhatsApp icon) — opens `https://wa.me/[lCNumber]?text=[pre-filled]` in new tab. Pre-filled text: `"Hi, I'm enquiring about [plateCharacters] listed at £[askingPrice]. [enquiryType]. [message]"`
- **Cancel** (`mat-button`) — closes dialog

**Success state:** After successful Firestore write, the form is replaced with a confirmation message: "Your message has been sent! The seller will be in touch." with a Close button.

**Error state:** Inline error shown below the Send button if the Firestore write fails.

---

## SellerEnquiryService

**Collection:** `seller_enquiries`

### Document Schema
```typescript
{
  plateId: number,              // listing.id
  plateCharacters: string,      // listing.plateCharacters
  enquiryType: string,          // dropdown selected value
  message: string,              // textarea value
  buyerUid: string,             // currentUser.uid
  buyerEmail: string,           // currentUser.email
  sellerLCNumber: string,       // listing.lCNumber
  submittedAt: Timestamp        // serverTimestamp()
}
```

### Method
```typescript
saveEnquiry(data: SellerEnquiry): Promise<void>
```

---

## Data Flow

```
User clicks "Message Seller"
  → onMessageSeller(listing) in PlatesForSaleComponent
    → authService.currentUser$ (take(1))
      → null  → open AuthPromptDialog (380px)
                  → "Log in"     → navigate /login
                  → "Register"   → navigate /register
      → user  → open MessageSellerDialog (520px, { listing })
                  → user fills form
                  → "Send Message"
                      → SellerEnquiryService.saveEnquiry()
                          → Firestore write to seller_enquiries
                          → success: show confirmation state
                          → error: show inline error
                  → "WhatsApp" → open wa.me link in new tab
                  → "Cancel"   → close dialog
```

---

## Firestore Collection

**Collection name:** `seller_enquiries`
**Security rules:** Authenticated users can create; no public read.

---

## Dependencies

- `MatDialog`, `MatDialogRef`, `MAT_DIALOG_DATA` — already used in project
- `MatSelectModule` — for enquiry type dropdown
- `MatInputModule`, `ReactiveFormsModule` — for form fields
- `AuthService.currentUser$` — for auth check
- `Router` — for navigation in auth prompt
- `serverTimestamp` from `@angular/fire/firestore` — already used in project
