# List Plate + Stripe Payment Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a `/list-plate` page where sellers fill in plate details, pay £6 via Stripe Checkout, and have their listing automatically created in Firestore; with a My Listings tab in the Account Dashboard for inline editing of price and meanings.

**Architecture:** A `createCheckoutSession` Cloud Function (onCall) creates a Stripe Checkout Session containing form data as metadata and returns the hosted URL. Angular redirects the user to Stripe, which on success redirects back to `/list-plate/success` and fires a `stripeWebhook` Cloud Function (onRequest) that creates the `plate-listings` Firestore document using the Admin SDK. The seller's UID is stored on the listing, enabling the Account Dashboard to query and inline-edit their own listings.

**Tech Stack:** Angular 19+ standalone components, Angular Material, Angular Fire (Firestore, Functions), Firebase Cloud Functions v2, Stripe Node.js SDK, Firebase Secret Manager.

---

## File Map

| Action | File |
|--------|------|
| Modify | `functions/package.json` |
| Modify | `functions/src/index.ts` |
| Modify | `src/app/models/plate-listing.model.ts` |
| Modify | `src/app/services/plate-listing.service.ts` |
| Create | `src/app/services/stripe.service.ts` |
| Create | `src/app/core/list-plate/list-plate.component.ts` |
| Create | `src/app/core/list-plate/list-plate.component.html` |
| Create | `src/app/core/list-plate/list-plate.component.scss` |
| Create | `src/app/core/list-plate-success/list-plate-success.component.ts` |
| Create | `src/app/core/list-plate-success/list-plate-success.component.html` |
| Create | `src/app/core/list-plate-success/list-plate-success.component.scss` |
| Modify | `src/app/app.routes.ts` |
| Modify | `src/app/core/account-dashboard/account-dashboard.component.ts` |
| Modify | `src/app/core/account-dashboard/account-dashboard.component.html` |
| Modify | `src/app/core/account-dashboard/account-dashboard.component.scss` |
| Modify | `firestore.rules` |

---

### Task 1: Cloud Functions — install Stripe, add `createCheckoutSession` and `stripeWebhook`

**Files:**
- Modify: `functions/package.json`
- Modify: `functions/src/index.ts`

> ⚠️ **One-time manual prerequisite** (do this before running the steps below):
> ```bash
> # From the project root
> firebase functions:secrets:set STRIPE_SECRET_KEY
> # When prompted, paste: sk_test_51OuG6T...
>
> firebase functions:secrets:set STRIPE_WEBHOOK_SECRET
> # When prompted, paste: whsec_... (from Stripe Dashboard webhook destination)
> ```

- [ ] **Step 1: Install the stripe package in functions**

```bash
cd /Users/gurvindersinghsandhu/Documents/development/guv/projects/mrg-app-v1/functions
npm install stripe
```

Expected: `stripe` appears in `functions/package.json` dependencies.

- [ ] **Step 2: Add imports and secrets to `functions/src/index.ts`**

Read the file first. Then replace the existing imports block at the top:

```typescript
import {setGlobalOptions} from "firebase-functions";
import {onSchedule} from "firebase-functions/v2/scheduler";
import {onCall, onRequest, HttpsError} from "firebase-functions/v2/https";
import {defineSecret} from "firebase-functions/params";
import * as admin from "firebase-admin";
import Stripe from "stripe";

setGlobalOptions({maxInstances: 10});

admin.initializeApp();
const db = admin.firestore();

const stripeSecretKey = defineSecret("STRIPE_SECRET_KEY");
const stripeWebhookSecret = defineSecret("STRIPE_WEBHOOK_SECRET");
```

- [ ] **Step 3: Add `createCheckoutSession` to `functions/src/index.ts`**

Append after the `weeklyReport` export:

```typescript
export const createCheckoutSession = onCall(
  {maxInstances: 10, secrets: [stripeSecretKey]},
  async (request) => {
    if (!request.auth) {
      throw new HttpsError("unauthenticated", "Must be logged in");
    }

    const {
      plateCharacters,
      askingPrice,
      phone,
      email,
      meanings,
      negotiable,
      appBaseUrl,
    } = request.data;

    const sellerUid = request.auth.uid;
    const stripe = new Stripe(stripeSecretKey.value());

    const session = await stripe.checkout.sessions.create({
      mode: "payment",
      customer_email: email,
      line_items: [
        {
          price_data: {
            currency: "gbp",
            unit_amount: 600,
            product_data: {
              name: `Plate listing: ${String(plateCharacters).toUpperCase()}`,
              description: "One-off listing fee — listed until sold",
            },
          },
          quantity: 1,
        },
      ],
      success_url: `${appBaseUrl}/list-plate/success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${appBaseUrl}/list-plate`,
      metadata: {
        plateCharacters: String(plateCharacters).toUpperCase(),
        askingPrice: String(askingPrice),
        phone: String(phone),
        email: String(email),
        meanings: String(meanings ?? ""),
        negotiable: negotiable ? "true" : "false",
        sellerUid,
      },
    });

    return {url: session.url};
  }
);
```

- [ ] **Step 4: Add `stripeWebhook` to `functions/src/index.ts`**

Append after `createCheckoutSession`:

```typescript
export const stripeWebhook = onRequest(
  {maxInstances: 10, secrets: [stripeSecretKey, stripeWebhookSecret]},
  async (request, response) => {
    const stripe = new Stripe(stripeSecretKey.value());
    const sig = request.headers["stripe-signature"] as string;

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

    if (event.type === "checkout.session.completed") {
      const session = event.data.object as Stripe.Checkout.Session;
      const meta = session.metadata!;
      const initials = (meta.email ?? "XX").substring(0, 2).toUpperCase();

      await db.collection("plate-listings").add({
        plateCharacters: meta.plateCharacters,
        askingPrice: meta.askingPrice,
        lCEmail: meta.email,
        lCNumber: meta.phone,
        lCName: meta.email,
        plateListingAccName: meta.email,
        plateListingAccTelNumber: meta.phone,
        meanings: meta.meanings,
        plateNegotiable: meta.negotiable === "true",
        sellerUid: meta.sellerUid,
        initials,
        createdDate: new Date().toISOString(),
        isSold: false,
        soldPrice: null,
        viewsPlaceholder: 0,
        plateBestOffer: false,
        offersOver: false,
        orNearestOffer: false,
        plateType: "",
        plateCategory: "",
        profiletPicUrl: "",
        profiletPicInitials: true,
        messageSeller: "",
      });
    }

    response.status(200).send("ok");
  }
);
```

- [ ] **Step 5: Build and verify**

```bash
cd /Users/gurvindersinghsandhu/Documents/development/guv/projects/mrg-app-v1/functions
npm run build 2>&1 | tail -20
```

Expected: build succeeds with no TypeScript errors.

- [ ] **Step 6: Deploy functions**

```bash
cd /Users/gurvindersinghsandhu/Documents/development/guv/projects/mrg-app-v1
firebase deploy --only functions
```

Expected: both `createCheckoutSession` and `stripeWebhook` appear in the output as deployed.

After deploy: go to Firebase Console → Functions, copy the `stripeWebhook` URL, then go to Stripe Dashboard → Developers → Webhooks → your destination → update the URL.

- [ ] **Step 7: Commit**

```bash
cd /Users/gurvindersinghsandhu/Documents/development/guv/projects/mrg-app-v1
git add functions/package.json functions/package-lock.json functions/src/index.ts
git commit -m "feat: add createCheckoutSession and stripeWebhook Cloud Functions"
```

---

### Task 2: Update `PlateListing` model and `PlateListingService`

**Files:**
- Modify: `src/app/models/plate-listing.model.ts`
- Modify: `src/app/services/plate-listing.service.ts`

- [ ] **Step 1: Add `sellerUid` to the model**

Read `src/app/models/plate-listing.model.ts`. Add `sellerUid?: string;` after `soldPrice`:

```typescript
export interface PlateListing {
  id: number;
  lCName: string;
  lCNumber: string;
  lCEmail: string;
  initials: string;
  profiletPicUrl: string;
  profiletPicInitials: boolean;
  createdDate: string;
  plateCharacters: string;
  askingPrice: string;
  plateNegotiable: boolean;
  plateBestOffer: boolean;
  offersOver: boolean;
  orNearestOffer: boolean;
  meanings: string;
  viewsPlaceholder: number | string;
  messageSeller: string;
  plateListingAccName: string;
  plateListingAccTelNumber: string;
  plateType: string;
  plateCategory: string;
  isSold: boolean;
  soldPrice: number | null;
  sellerUid?: string;
}
```

- [ ] **Step 2: Add `updateDoc` import and new methods to `PlateListingService`**

Read `src/app/services/plate-listing.service.ts`. Add `updateDoc` to the Angular Fire import block (it currently imports `collection, collectionData, query, orderBy, where, doc, getDoc, runTransaction`):

```typescript
import {
  Firestore,
  collection,
  collectionData,
  query,
  orderBy,
  where,
  doc,
  getDoc,
  updateDoc,
  runTransaction
} from '@angular/fire/firestore';
```

Then add these two methods to the class body after `incrementViews`:

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

- [ ] **Step 3: Verify compilation**

```bash
cd /Users/gurvindersinghsandhu/Documents/development/guv/projects/mrg-app-v1
npx tsc --noEmit 2>&1 | head -20
```

Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add src/app/models/plate-listing.model.ts src/app/services/plate-listing.service.ts
git commit -m "feat: add sellerUid to PlateListing model and getMyListings/updateListing to service"
```

---

### Task 3: Create `StripeService`

**Files:**
- Create: `src/app/services/stripe.service.ts`

- [ ] **Step 1: Create the service**

Create `src/app/services/stripe.service.ts`:

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
    const fn = httpsCallable<any, { url: string }>(
      this.functions,
      'createCheckoutSession'
    );
    const result = await fn({ ...data, appBaseUrl: environment.appBaseUrl });
    return result.data.url;
  }
}
```

- [ ] **Step 2: Verify compilation**

```bash
npx tsc --noEmit 2>&1 | head -20
```

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add src/app/services/stripe.service.ts
git commit -m "feat: create StripeService"
```

---

### Task 4: Create `ListPlateComponent`

**Files:**
- Create: `src/app/core/list-plate/list-plate.component.ts`
- Create: `src/app/core/list-plate/list-plate.component.html`
- Create: `src/app/core/list-plate/list-plate.component.scss`

- [ ] **Step 1: Create the TypeScript component**

Create `src/app/core/list-plate/list-plate.component.ts`:

```typescript
import { Component, inject, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatButtonModule } from '@angular/material/button';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatDialogModule, MatDialog } from '@angular/material/dialog';
import { RouterModule } from '@angular/router';
import { take } from 'rxjs';
import { AuthService } from '../../services/auth.service';
import { StripeService } from '../../services/stripe.service';
import { AuthPromptDialogComponent } from '../../shared/auth-prompt-dialog/auth-prompt-dialog.component';

@Component({
  selector: 'app-list-plate',
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    MatFormFieldModule,
    MatInputModule,
    MatButtonModule,
    MatCheckboxModule,
    MatProgressSpinnerModule,
    MatDialogModule,
    RouterModule,
  ],
  templateUrl: './list-plate.component.html',
  styleUrl: './list-plate.component.scss'
})
export class ListPlateComponent implements OnInit {
  private fb = inject(FormBuilder);
  private authService = inject(AuthService);
  private stripeService = inject(StripeService);
  private dialog = inject(MatDialog);

  form: FormGroup = this.fb.group({
    plateCharacters: ['', [Validators.required, Validators.minLength(2), Validators.maxLength(8)]],
    askingPrice: ['', [Validators.required, Validators.min(1)]],
    phone: ['', Validators.required],
    email: ['', [Validators.required, Validators.email]],
    meanings: [''],
    negotiable: [false],
  });

  loading = false;
  errorMessage = '';

  ngOnInit(): void {
    this.authService.currentUser$.pipe(take(1)).subscribe(user => {
      if (!user) {
        this.dialog.open(AuthPromptDialogComponent, { width: '380px' });
      } else {
        this.form.patchValue({ email: user.email ?? '' });
      }
    });
  }

  async onSubmit(): Promise<void> {
    if (this.form.invalid) return;
    this.loading = true;
    this.errorMessage = '';
    try {
      const url = await this.stripeService.createCheckoutSession({
        plateCharacters: this.form.value.plateCharacters.toUpperCase(),
        askingPrice: String(this.form.value.askingPrice),
        phone: this.form.value.phone,
        email: this.form.value.email,
        meanings: this.form.value.meanings ?? '',
        negotiable: this.form.value.negotiable ?? false,
      });
      window.location.href = url;
    } catch {
      this.errorMessage = 'Something went wrong. Please try again.';
      this.loading = false;
    }
  }
}
```

- [ ] **Step 2: Create the HTML template**

Create `src/app/core/list-plate/list-plate.component.html`:

```html
<div class="container-fluid main-bg-c">
  <div class="list-plate-container">
    <h1 class="cabin-font-sketch text-center">List Your Plate</h1>
    <p class="text-center text-muted mb-4">One-off £6 listing fee — listed until sold.</p>

    <form [formGroup]="form" (ngSubmit)="onSubmit()" class="list-plate-form">

      <mat-form-field appearance="outline" class="full-field">
        <mat-label>Plate characters</mat-label>
        <input matInput formControlName="plateCharacters" placeholder="e.g. AB12 CDE"
          style="text-transform: uppercase">
        @if (form.get('plateCharacters')?.hasError('required')) {
          <mat-error>Plate characters are required</mat-error>
        }
        @if (form.get('plateCharacters')?.hasError('minlength') || form.get('plateCharacters')?.hasError('maxlength')) {
          <mat-error>Must be between 2 and 8 characters</mat-error>
        }
      </mat-form-field>

      <mat-form-field appearance="outline" class="full-field">
        <mat-label>Asking price (£)</mat-label>
        <input matInput type="number" formControlName="askingPrice" placeholder="e.g. 5000" min="1">
        <mat-error>A valid asking price is required</mat-error>
      </mat-form-field>

      <mat-form-field appearance="outline" class="full-field">
        <mat-label>Phone number</mat-label>
        <input matInput type="tel" formControlName="phone" placeholder="e.g. 07700 900000">
        <mat-error>Phone number is required</mat-error>
      </mat-form-field>

      <mat-form-field appearance="outline" class="full-field">
        <mat-label>Email address</mat-label>
        <input matInput type="email" formControlName="email">
        <mat-error>A valid email address is required</mat-error>
      </mat-form-field>

      <mat-form-field appearance="outline" class="full-field">
        <mat-label>Meanings (optional)</mat-label>
        <input matInput formControlName="meanings" placeholder="e.g. ABC = my initials">
      </mat-form-field>

      <mat-checkbox formControlName="negotiable" class="negotiable-check">
        Price is negotiable
      </mat-checkbox>

      @if (errorMessage) {
        <p class="error-message">{{ errorMessage }}</p>
      }

      <button type="submit" mat-raised-button color="primary" class="submit-btn"
        [disabled]="form.invalid || loading">
        @if (loading) { Processing... } @else { Pay £6 &amp; List }
      </button>

    </form>
  </div>
</div>
```

- [ ] **Step 3: Create the SCSS**

Create `src/app/core/list-plate/list-plate.component.scss`:

```scss
.list-plate-container {
  max-width: 520px;
  margin: 0 auto;
  padding: 3rem 1rem;
}

.list-plate-form {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.full-field {
  width: 100%;
}

.negotiable-check {
  margin-bottom: 0.5rem;
}

.error-message {
  color: #d32f2f;
  font-size: 0.85rem;
}

.submit-btn {
  width: 100%;
  margin-top: 0.5rem;
}
```

- [ ] **Step 4: Verify compilation**

```bash
npx tsc --noEmit 2>&1 | head -20
```

Expected: no errors.

- [ ] **Step 5: Commit**

```bash
git add src/app/core/list-plate/
git commit -m "feat: create ListPlateComponent with Stripe Checkout form"
```

---

### Task 5: Create `ListPlateSuccessComponent`

**Files:**
- Create: `src/app/core/list-plate-success/list-plate-success.component.ts`
- Create: `src/app/core/list-plate-success/list-plate-success.component.html`
- Create: `src/app/core/list-plate-success/list-plate-success.component.scss`

- [ ] **Step 1: Create the TypeScript component**

Create `src/app/core/list-plate-success/list-plate-success.component.ts`:

```typescript
import { Component } from '@angular/core';
import { RouterModule } from '@angular/router';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';

@Component({
  selector: 'app-list-plate-success',
  standalone: true,
  imports: [RouterModule, MatButtonModule, MatIconModule],
  templateUrl: './list-plate-success.component.html',
  styleUrl: './list-plate-success.component.scss'
})
export class ListPlateSuccessComponent {}
```

- [ ] **Step 2: Create the HTML template**

Create `src/app/core/list-plate-success/list-plate-success.component.html`:

```html
<div class="container-fluid main-bg-c">
  <div class="success-container">
    <mat-icon class="success-icon">check_circle</mat-icon>
    <h1 class="cabin-font-sketch text-center">You're listed!</h1>
    <p class="text-center text-muted">
      Payment received. Your plate listing is now live and will appear in the marketplace shortly.
    </p>
    <p class="text-center text-muted">
      You can view and edit your listing from your
      <a routerLink="/account-dashboard">Account Dashboard</a>.
    </p>
    <a mat-raised-button color="primary" routerLink="/plates-for-sale" class="cta-btn">
      View marketplace
    </a>
  </div>
</div>
```

- [ ] **Step 3: Create the SCSS**

Create `src/app/core/list-plate-success/list-plate-success.component.scss`:

```scss
.success-container {
  max-width: 480px;
  margin: 0 auto;
  padding: 4rem 1rem;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 1rem;
  text-align: center;
}

.success-icon {
  font-size: 4rem;
  width: 4rem;
  height: 4rem;
  color: #2e7d32;
}

.cta-btn {
  margin-top: 1rem;
}
```

- [ ] **Step 4: Verify compilation**

```bash
npx tsc --noEmit 2>&1 | head -20
```

Expected: no errors.

- [ ] **Step 5: Commit**

```bash
git add src/app/core/list-plate-success/
git commit -m "feat: create ListPlateSuccessComponent"
```

---

### Task 6: Add routes

**Files:**
- Modify: `src/app/app.routes.ts`

- [ ] **Step 1: Read the current routes file**

Read `src/app/app.routes.ts`. The current routes are:
```typescript
{ path: '', component: MainSectionComponent },
{ path: 'login', component: LoginComponent },
{ path: 'register', component: RegisterComponent },
{ path: 'account-dashboard', component: AccountDashboardComponent, canActivate: [authGuard] },
{ path: 'forgot-password', component: ForgotPasswordComponent },
{ path: 'plates-for-sale', component: PlatesForSaleComponent },
```

- [ ] **Step 2: Add the new routes and imports**

The updated file should be:

```typescript
import { Routes } from '@angular/router';
import { LoginComponent } from './core/login/login.component';
import { MainSectionComponent } from './core/main-section/main-section.component';
import { RegisterComponent } from './core/register/register.component';
import { authGuard } from './guards/auth.guard';
import { AccountDashboardComponent } from './core/account-dashboard/account-dashboard.component';
import { ForgotPasswordComponent } from './core/forgot-password/forgot-password.component';
import { PlatesForSaleComponent } from './core/plates-for-sale/plates-for-sale.component';
import { ListPlateComponent } from './core/list-plate/list-plate.component';
import { ListPlateSuccessComponent } from './core/list-plate-success/list-plate-success.component';

export const routes: Routes = [
    { path: '', component: MainSectionComponent },
    { path: 'login', component: LoginComponent },
    { path: 'register', component: RegisterComponent },
    {
        path: 'account-dashboard',
        component: AccountDashboardComponent,
        canActivate: [authGuard]
    },
    { path: 'forgot-password', component: ForgotPasswordComponent },
    { path: 'plates-for-sale', component: PlatesForSaleComponent },
    { path: 'list-plate', component: ListPlateComponent },
    { path: 'list-plate/success', component: ListPlateSuccessComponent },
];
```

- [ ] **Step 3: Verify compilation**

```bash
npx tsc --noEmit 2>&1 | head -20
```

Expected: no errors.

- [ ] **Step 4: Verify routes work**

Run `ng serve`. Navigate to `http://localhost:4200/list-plate` — the form should appear. Navigate to `http://localhost:4200/list-plate/success` — the success page should appear.

- [ ] **Step 5: Commit**

```bash
git add src/app/app.routes.ts
git commit -m "feat: add list-plate and list-plate/success routes"
```

---

### Task 7: Add My Listings tab to `AccountDashboardComponent`

**Files:**
- Modify: `src/app/core/account-dashboard/account-dashboard.component.ts`
- Modify: `src/app/core/account-dashboard/account-dashboard.component.html`
- Modify: `src/app/core/account-dashboard/account-dashboard.component.scss`

- [ ] **Step 1: Update the TypeScript**

Read `src/app/core/account-dashboard/account-dashboard.component.ts` in full. Apply the following changes:

**Add imports at the top:**
```typescript
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { PlateListingService } from '../../services/plate-listing.service';
import { PlateListing } from '../../models/plate-listing.model';
```

Note: `SellerEnquiry` and `SellerEnquiryService` are already imported. `PlateListingService` and `PlateListing` are new additions.

**Add `ReactiveFormsModule`, `MatFormFieldModule`, `MatInputModule` to the `imports` array in `@Component`:**

```typescript
imports: [
  CommonModule,
  DatePipe,
  UpperCasePipe,
  MatButtonModule,
  MatTabsModule,
  RouterModule,
  UserAccountDetailsComponent,
  AccountDashboardValuationComponent,
  AdminComponent,
  MeComponent,
  MatDialogModule,
  ReactiveFormsModule,
  MatFormFieldModule,
  MatInputModule,
],
```

**Add new properties to the class body** (after `sellerEnquiries$`):

```typescript
myListings$ = signal<PlateListing[]>([]);
listingForms = new Map<string, FormGroup>();
savingListingId: string | null = null;
saveError = new Map<string, string>();

private plateListingService = inject(PlateListingService);
private fb = inject(FormBuilder);
```

**Add `ngOnInit` subscription for My Listings** (add inside `ngOnInit`, after the existing `sellerEnquiries$` subscription):

```typescript
this.subs.add(
  this.authService.currentUser$.pipe(
    switchMap(user => {
      const uid = (user as any)?.uid;
      if (!uid) return of([] as PlateListing[]);
      return this.plateListingService.getMyListings(uid);
    })
  ).subscribe(listings => {
    this.myListings$.set(listings);
    listings.forEach(l => {
      const id = String(l.id);
      if (!this.listingForms.has(id)) {
        this.listingForms.set(id, this.fb.group({
          askingPrice: [l.askingPrice, [Validators.required, Validators.min(1)]],
          meanings: [l.meanings ?? ''],
        }));
      }
    });
  })
);
```

**Add `getListingForm` and `saveListing` methods** (after `signOut`):

```typescript
getListingForm(listing: PlateListing): FormGroup {
  return this.listingForms.get(String(listing.id))!;
}

async saveListing(listing: PlateListing): Promise<void> {
  const form = this.getListingForm(listing);
  if (!form || form.invalid) return;
  const id = String(listing.id);
  this.savingListingId = id;
  this.saveError.delete(id);
  try {
    await this.plateListingService.updateListing(id, {
      askingPrice: String(form.value.askingPrice),
      meanings: form.value.meanings ?? '',
    });
    form.markAsPristine();
  } catch {
    this.saveError.set(id, 'Failed to save. Please try again.');
  } finally {
    this.savingListingId = null;
  }
}
```

- [ ] **Step 2: Add the My Listings tab to the HTML**

Read `src/app/core/account-dashboard/account-dashboard.component.html` in full.

Add this tab **before** the closing `</mat-tab-group>` tag:

```html
<mat-tab [label]="'My Listings (' + myListings$().length + ')'">
    <div class="tab-content">
        @if (myListings$().length === 0) {
            <p class="text-muted mt-3 text-center">
                No listings yet.
                <a routerLink="/list-plate">List a plate</a>
            </p>
        } @else {
            @for (listing of myListings$(); track listing.id) {
                <div class="my-listing-card" [formGroup]="getListingForm(listing)">
                    <div class="enquiry-plate-row">
                        <span class="bevel-plate enquiry-plate">{{ listing.plateCharacters | uppercase }}</span>
                        <span class="enquiry-date">Listed {{ listing.createdDate | date:'d MMM y' }}</span>
                    </div>

                    <mat-form-field appearance="outline" class="full-field">
                        <mat-label>Asking price (£)</mat-label>
                        <input matInput type="number" formControlName="askingPrice" min="1">
                        <mat-error>Valid price required</mat-error>
                    </mat-form-field>

                    <mat-form-field appearance="outline" class="full-field">
                        <mat-label>Meanings (optional)</mat-label>
                        <input matInput formControlName="meanings">
                    </mat-form-field>

                    @if (saveError.get(String(listing.id))) {
                        <p class="save-error">{{ saveError.get(String(listing.id)) }}</p>
                    }

                    @if (getListingForm(listing).dirty) {
                        <button type="button" mat-raised-button color="primary"
                            [disabled]="getListingForm(listing).invalid || savingListingId === String(listing.id)"
                            (click)="saveListing(listing)">
                            Save changes
                        </button>
                    }
                </div>
            }
        }
    </div>
</mat-tab>
```

- [ ] **Step 3: Add styles to the SCSS**

Read `src/app/core/account-dashboard/account-dashboard.component.scss`. Append:

```scss
.my-listing-card {
  background: white;
  border: 1px solid #e0e0e0;
  border-radius: 10px;
  padding: 1rem 1.25rem;
  margin-bottom: 1rem;
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.full-field {
  width: 100%;
}

.save-error {
  color: #d32f2f;
  font-size: 0.85rem;
  margin: 0;
}
```

- [ ] **Step 4: Verify compilation**

```bash
npx tsc --noEmit 2>&1 | head -20
```

Expected: no errors.

- [ ] **Step 5: Commit**

```bash
git add src/app/core/account-dashboard/account-dashboard.component.ts
git add src/app/core/account-dashboard/account-dashboard.component.html
git add src/app/core/account-dashboard/account-dashboard.component.scss
git commit -m "feat: add My Listings tab to AccountDashboard with inline editing"
```

---

### Task 8: Update Firestore rules and deploy

**Files:**
- Modify: `firestore.rules`

- [ ] **Step 1: Read the current rules**

Read `firestore.rules`.

- [ ] **Step 2: Update the `plate-listings` rule**

Find the existing `plate-listings` block:

```
match /plate-listings/{docId} {
  allow read: if true;
  allow update: if request.auth != null
    && request.resource.data.diff(resource.data).affectedKeys().hasOnly(['viewsPlaceholder']);
  allow create, delete: if false;
}
```

Replace it with:

```
// Plate listings — publicly readable; owner can update price/meanings; only server can create
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

- [ ] **Step 3: Deploy the rules**

```bash
cd /Users/gurvindersinghsandhu/Documents/development/guv/projects/mrg-app-v1
firebase deploy --only firestore:rules
```

Expected: `Deploy complete!` with firestore rules updated.

- [ ] **Step 4: Commit**

```bash
git add firestore.rules
git commit -m "feat: allow listing owner to update askingPrice and meanings in Firestore rules"
```
