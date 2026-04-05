# List Plate + Stripe Payment — Design Spec
**Date:** 2026-04-05

## Overview
A seller visits `/list-plate`, fills in their plate details, and pays a one-off £6 listing fee via Stripe Checkout. On successful payment, a Cloud Function webhook creates the plate listing in Firestore. If the user is not logged in, the existing `AuthPromptDialogComponent` is shown immediately.

---

## Architecture

### Data Flow

```
User visits /list-plate
  → Not logged in → AuthPromptDialog (existing component)
  → Logged in → ListPlateComponent
      Fields: plate characters, asking price, phone, email (pre-filled), meanings, negotiable
      → Clicks "Pay £6 & List"
          → StripeService.createCheckoutSession(formData)
              → calls Cloud Function: createCheckoutSession
              → CF creates Stripe Checkout Session (£6 GBP)
              → CF returns { url }
          → window.location.href = url  (redirect to Stripe hosted page)
              → User pays
              → Stripe redirects → /list-plate/success?session_id=xxx
              → Stripe sends webhook → Cloud Function: stripeWebhook
                  → Verifies signature
                  → Extracts metadata
                  → Creates plate-listings document (Admin SDK)
```

### Files

| Action | File | Responsibility |
|--------|------|----------------|
| Create | `src/app/core/list-plate/list-plate.component.ts` | Listing form, auth check, Stripe redirect |
| Create | `src/app/core/list-plate/list-plate.component.html` | Form template |
| Create | `src/app/core/list-plate/list-plate.component.scss` | Form styles |
| Create | `src/app/core/list-plate-success/list-plate-success.component.ts` | Success page |
| Create | `src/app/core/list-plate-success/list-plate-success.component.html` | Success template |
| Create | `src/app/core/list-plate-success/list-plate-success.component.scss` | Success styles |
| Create | `src/app/services/stripe.service.ts` | Calls createCheckoutSession Cloud Function |
| Modify | `src/app/models/plate-listing.model.ts` | Add `sellerUid?: string` field |
| Modify | `src/app/services/plate-listing.service.ts` | Add `getMyListings()` and `updateListing()` |
| Modify | `src/app/core/account-dashboard/account-dashboard.component.ts` | Add My Listings tab data |
| Modify | `src/app/core/account-dashboard/account-dashboard.component.html` | Add My Listings tab with inline editing |
| Modify | `src/app/app.routes.ts` | Add list-plate and list-plate/success routes |
| Modify | `src/environments/environment.ts` | Add appBaseUrl, remove secretKey |
| Modify | `src/environments/environment.prod.ts` | Add appBaseUrl, remove secretKey |
| Modify | `functions/src/index.ts` | Add createCheckoutSession + stripeWebhook (stores sellerUid) |
| Modify | `functions/package.json` | Add stripe dependency |
| Modify | `firestore.rules` | Allow seller to update askingPrice and meanings only |

---

## Security Fix — Remove Secret Key from Client

`environment.ts` currently contains `stripe.secretKey`. **This must be removed** — the secret key must never be in client-side code. It will be stored as a Firebase secret and accessed only from Cloud Functions.

`environment.ts` should only contain:
```typescript
stripe: {
  publishableKey: 'pk_test_...'
}
```

And add:
```typescript
appBaseUrl: 'http://localhost:4200'
```

`environment.prod.ts` should have:
```typescript
appBaseUrl: 'https://<your-production-domain>'
stripe: {
  publishableKey: 'pk_live_...'  // switch to live key when ready
}
```

---

## 1. Cloud Functions

### Prerequisites (one-time manual setup)

```bash
# In functions/ directory
npm install stripe

# Store secrets in Firebase Secret Manager
firebase functions:secrets:set STRIPE_SECRET_KEY
# Paste: sk_test_51OuG6T... (your Stripe secret key)

firebase functions:secrets:set STRIPE_WEBHOOK_SECRET
# Paste: whsec_... (from Stripe Dashboard → Developers → Webhooks → your endpoint → Signing secret)

# Deploy
firebase deploy --only functions
```

After deploying, get the webhook URL from Firebase Console → Functions. It will be:
`https://stripwebhook-<hash>-<region>.a.run.app`
or for us-central1: `https://us-central1-code-g-b8b6f.cloudfunctions.net/stripeWebhook`

Go back to Stripe Dashboard → Developers → Webhooks → your destination → update the URL.

---

### `createCheckoutSession` (onCall v2, requires auth)

```typescript
import Stripe from 'stripe';
import { onCall, onRequest, HttpsError } from 'firebase-functions/v2/https';
import { defineSecret } from 'firebase-functions/params';

const stripeSecretKey = defineSecret('STRIPE_SECRET_KEY');
const stripeWebhookSecret = defineSecret('STRIPE_WEBHOOK_SECRET');

export const createCheckoutSession = onCall(
  { maxInstances: 10, secrets: [stripeSecretKey] },
  async (request) => {
    if (!request.auth) {
      throw new HttpsError('unauthenticated', 'Must be logged in');
    }

    const { plateCharacters, askingPrice, phone, email, meanings, negotiable, appBaseUrl } = request.data;
    const sellerUid = request.auth.uid;

    const stripe = new Stripe(stripeSecretKey.value());

    const session = await stripe.checkout.sessions.create({
      mode: 'payment',
      customer_email: email,
      line_items: [{
        price_data: {
          currency: 'gbp',
          unit_amount: 600,
          product_data: {
            name: `Plate listing: ${String(plateCharacters).toUpperCase()}`,
            description: 'One-off listing fee — listed until sold',
          },
        },
        quantity: 1,
      }],
      success_url: `${appBaseUrl}/list-plate/success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${appBaseUrl}/list-plate`,
      metadata: {
        plateCharacters: String(plateCharacters).toUpperCase(),
        askingPrice: String(askingPrice),
        phone: String(phone),
        email: String(email),
        meanings: String(meanings ?? ''),
        negotiable: negotiable ? 'true' : 'false',
        sellerUid,
      },
    });

    return { url: session.url };
  }
);
```

---

### `stripeWebhook` (onRequest v2 — called by Stripe)

```typescript
export const stripeWebhook = onRequest(
  { maxInstances: 10, secrets: [stripeWebhookSecret, stripeSecretKey] },
  async (request, response) => {
    const stripe = new Stripe(stripeSecretKey.value());
    const sig = request.headers['stripe-signature'] as string;

    let event: Stripe.Event;
    try {
      event = stripe.webhooks.constructEvent(
        request.rawBody,
        sig,
        stripeWebhookSecret.value()
      );
    } catch (err) {
      response.status(400).send(`Webhook error: ${err}`);
      return;
    }

    if (event.type === 'checkout.session.completed') {
      const session = event.data.object as Stripe.Checkout.Session;
      const meta = session.metadata!;

      const initials = (meta.email ?? 'XX').substring(0, 2).toUpperCase();

      await db.collection('plate-listings').add({
        plateCharacters: meta.plateCharacters,
        askingPrice: meta.askingPrice,
        lCEmail: meta.email,
        lCNumber: meta.phone,
        lCName: meta.email,
        plateListingAccName: meta.email,
        plateListingAccTelNumber: meta.phone,
        meanings: meta.meanings,
        plateNegotiable: meta.negotiable === 'true',
        sellerUid: meta.sellerUid,
        initials,
        createdDate: new Date().toISOString(),
        isSold: false,
        soldPrice: null,
        viewsPlaceholder: 0,
        plateBestOffer: false,
        offersOver: false,
        orNearestOffer: false,
        plateType: '',
        plateCategory: '',
        profiletPicUrl: '',
        profiletPicInitials: true,
        messageSeller: '',
      });
    }

    response.status(200).send('ok');
  }
);
```

---

## 2. StripeService

```typescript
import { inject, Injectable } from '@angular/core';
import { Functions, httpsCallable } from '@angular/fire/functions';
import { environment } from '../../environments/environment';

@Injectable({ providedIn: 'root' })
export class StripeService {
  private functions = inject(Functions);

  async createCheckoutSession(data: {
    plateCharacters: string;
    askingPrice: string;
    phone: string;
    email: string;
    meanings: string;
    negotiable: boolean;
  }): Promise<string> {
    const fn = httpsCallable<any, { url: string }>(this.functions, 'createCheckoutSession');
    const result = await fn({ ...data, appBaseUrl: environment.appBaseUrl });
    return result.data.url;
  }
}
```

---

## 3. ListPlateComponent

**Auth check on init:** injects `AuthService` and `MatDialog`. In `ngOnInit`, subscribes to `currentUser$` with `take(1)`. If user is null → opens `AuthPromptDialogComponent`. If logged in → pre-fills email field.

**Form fields (all Reactive Forms):**
| Control | Validators |
|---------|-----------|
| `plateCharacters` | required, minLength(2), maxLength(8) |
| `askingPrice` | required, min(1) |
| `phone` | required |
| `email` | required, email |
| `meanings` | — |
| `negotiable` | — (checkbox, default false) |

**`onSubmit()`:**
```typescript
async onSubmit(): Promise<void> {
  if (this.form.invalid) return;
  this.loading = true;
  this.errorMessage = '';
  try {
    const url = await this.stripeService.createCheckoutSession(this.form.value);
    window.location.href = url;
  } catch {
    this.errorMessage = 'Something went wrong. Please try again.';
    this.loading = false;
  }
}
```

Note: `loading` is not reset on success because the page navigates away to Stripe.

---

## 4. ListPlateSuccessComponent

Simple static page shown at `/list-plate/success`. Displays a confirmation message and a link back to `/plates-for-sale`. No Firestore reads needed — the listing was already created by the webhook.

---

## 5. Routes

```typescript
{ path: 'list-plate', component: ListPlateComponent },
{ path: 'list-plate/success', component: ListPlateSuccessComponent },
```

No `canActivate` guard — the component handles the auth check and shows the dialog internally (consistent with MessageSeller pattern).

---

## 6. PlateListing Model

Add `sellerUid?: string` to the existing `PlateListing` interface in `src/app/models/plate-listing.model.ts`.

---

## 7. PlateListingService — New Methods

```typescript
getMyListings(uid: string): Observable<PlateListing[]> {
  const ref = collection(this.firestore, this.COLLECTION);
  const q = query(ref, where('sellerUid', '==', uid));
  return collectionData(q, { idField: 'id' }) as Observable<PlateListing[]>;
}

updateListing(id: string, data: { askingPrice: string; meanings: string }): Promise<void> {
  const ref = doc(this.firestore, `${this.COLLECTION}/${id}`);
  return updateDoc(ref, data);
}
```

Requires adding `where`, `doc`, `updateDoc` to the Angular Fire imports.

---

## 8. Account Dashboard — My Listings Tab

### Data

In `AccountDashboardComponent`:
- Add `myListings$ = signal<PlateListing[]>([])`
- In `ngOnInit`, subscribe to `plateListingService.getMyListings(uid)` when `currentUser$` emits a logged-in user
- Only load when UID is available (not admin-gated — any logged-in user can see their own listings)

### Tab

Add a new tab `"My Listings"` to the dashboard tab group, showing a card for each listing in `myListings$()`.

Each listing card displays:
- `plateCharacters` — read-only, styled as a plate (`.bevel-plate`)
- `askingPrice` — inline editable `<input>` (number, min 1)
- `meanings` — inline editable `<input>` (text, optional)
- A **Save** button that appears only when the value differs from the original
- Saving calls `plateListingService.updateListing(listing.id, { askingPrice, meanings })`

### Inline Editing Pattern

Each card uses a local reactive form initialised from the listing's current values. The Save button is enabled only when `form.dirty && form.valid`. After a successful save, the form is marked as pristine.

```typescript
// Per-card form — created in the template using a helper
buildListingForm(listing: PlateListing): FormGroup {
  return this.fb.group({
    askingPrice: [listing.askingPrice, [Validators.required, Validators.min(1)]],
    meanings: [listing.meanings ?? '']
  });
}
```

Since there can be multiple listings, forms are managed in a `Map<string, FormGroup>` keyed by listing ID, initialised when `myListings$` emits.

```typescript
listingForms = new Map<string, FormGroup>();

// Called whenever myListings$ updates:
private initForms(listings: PlateListing[]): void {
  listings.forEach(l => {
    if (!this.listingForms.has(l.id!)) {
      this.listingForms.set(l.id!, this.buildListingForm(l));
    }
  });
}
```

`plateCharacters` is displayed as text only — no form control, no input.

---

## Firestore Rules

### plate-listings — updated

Allow the listing owner to update `askingPrice` and `meanings` only. The existing `viewsPlaceholder` update rule is preserved.

```
match /plate-listings/{docId} {
  allow read: if true;
  allow update: if request.auth != null && (
    request.resource.data.diff(resource.data).affectedKeys().hasOnly(['viewsPlaceholder']) ||
    (
      request.auth.uid == resource.data.sellerUid &&
      request.resource.data.diff(resource.data).affectedKeys().hasOnly(['askingPrice', 'meanings'])
    )
  );
  allow create, delete: if false;
}
```

---

## Stripe Setup Checklist

- [ ] Remove `secretKey` from `environment.ts` and `environment.prod.ts`
- [ ] Add `appBaseUrl` to both environment files
- [ ] `cd functions && npm install stripe`
- [ ] `firebase functions:secrets:set STRIPE_SECRET_KEY`
- [ ] `firebase functions:secrets:set STRIPE_WEBHOOK_SECRET`
- [ ] `firebase deploy --only functions`
- [ ] Copy deployed webhook URL from Firebase Console
- [ ] In Stripe Dashboard → Developers → Webhooks → update destination URL
- [ ] Switch to live Stripe keys when going to production
