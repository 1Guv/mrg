# Message Seller Dialog — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Allow authenticated users to send an enquiry to a plate seller via a form dialog, with Firestore storage and a WhatsApp link; redirect unauthenticated users to log in first.

**Architecture:** Two focused dialogs (`AuthPromptDialogComponent` for unauthenticated users, `MessageSellerDialogComponent` for the form) plus a `SellerEnquiryService` for Firestore writes. `PlatesForSaleComponent` checks auth state and opens the appropriate dialog.

**Tech Stack:** Angular 17+ standalone components, Angular Material (MatDialog, MatSelect, MatFormField), Angular Fire (Firestore `addDoc`, `serverTimestamp`), RxJS `take(1)`, Jasmine/TestBed.

---

## File Map

| Action | File |
|--------|------|
| Create | `src/app/services/seller-enquiry.service.ts` |
| Create | `src/app/services/seller-enquiry.service.spec.ts` |
| Create | `src/app/shared/auth-prompt-dialog/auth-prompt-dialog.component.ts` |
| Create | `src/app/shared/auth-prompt-dialog/auth-prompt-dialog.component.html` |
| Create | `src/app/shared/auth-prompt-dialog/auth-prompt-dialog.component.scss` |
| Create | `src/app/shared/message-seller-dialog/message-seller-dialog.component.ts` |
| Create | `src/app/shared/message-seller-dialog/message-seller-dialog.component.html` |
| Create | `src/app/shared/message-seller-dialog/message-seller-dialog.component.scss` |
| Modify | `src/app/core/plates-for-sale/plates-for-sale.component.ts` |
| Modify | `src/app/core/plates-for-sale/plates-for-sale.component.html` |

---

## Task 1: SellerEnquiryService

**Files:**
- Create: `src/app/services/seller-enquiry.service.ts`
- Create: `src/app/services/seller-enquiry.service.spec.ts`

- [ ] **Step 1: Write the failing test**

Create `src/app/services/seller-enquiry.service.spec.ts`:

```typescript
import { TestBed } from '@angular/core/testing';
import { SellerEnquiryService } from './seller-enquiry.service';
import { Firestore } from '@angular/fire/firestore';

describe('SellerEnquiryService', () => {
  let service: SellerEnquiryService;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        SellerEnquiryService,
        { provide: Firestore, useValue: {} }
      ]
    });
    service = TestBed.inject(SellerEnquiryService);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
cd /Users/gurvindersinghsandhu/Documents/development/guv/projects/mrg-app-v1
ng test --include="**/seller-enquiry.service.spec.ts" --watch=false
```

Expected: FAIL — `SellerEnquiryService` not found.

- [ ] **Step 3: Create the service**

Create `src/app/services/seller-enquiry.service.ts`:

```typescript
import { inject, Injectable } from '@angular/core';
import {
  Firestore,
  collection,
  addDoc,
  serverTimestamp
} from '@angular/fire/firestore';

export interface SellerEnquiry {
  plateId: number;
  plateCharacters: string;
  enquiryType: string;
  message: string;
  buyerUid: string;
  buyerEmail: string;
  sellerLCNumber: string;
}

@Injectable({ providedIn: 'root' })
export class SellerEnquiryService {
  private firestore = inject(Firestore);

  saveEnquiry(data: SellerEnquiry): Promise<void> {
    const ref = collection(this.firestore, 'seller_enquiries');
    return addDoc(ref, { ...data, submittedAt: serverTimestamp() }).then(() => {});
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

```bash
ng test --include="**/seller-enquiry.service.spec.ts" --watch=false
```

Expected: PASS — 1 spec, 0 failures.

- [ ] **Step 5: Commit**

```bash
git add src/app/services/seller-enquiry.service.ts src/app/services/seller-enquiry.service.spec.ts
git commit -m "feat: add SellerEnquiryService writing to seller_enquiries Firestore collection"
```

---

## Task 2: AuthPromptDialogComponent

**Files:**
- Create: `src/app/shared/auth-prompt-dialog/auth-prompt-dialog.component.ts`
- Create: `src/app/shared/auth-prompt-dialog/auth-prompt-dialog.component.html`
- Create: `src/app/shared/auth-prompt-dialog/auth-prompt-dialog.component.scss`

- [ ] **Step 1: Create the component TypeScript**

Create `src/app/shared/auth-prompt-dialog/auth-prompt-dialog.component.ts`:

```typescript
import { Component, inject } from '@angular/core';
import { MatDialogRef, MatDialogModule } from '@angular/material/dialog';
import { MatButtonModule } from '@angular/material/button';
import { Router } from '@angular/router';

@Component({
  selector: 'app-auth-prompt-dialog',
  standalone: true,
  imports: [MatDialogModule, MatButtonModule],
  templateUrl: './auth-prompt-dialog.component.html',
  styleUrl: './auth-prompt-dialog.component.scss'
})
export class AuthPromptDialogComponent {
  private dialogRef = inject(MatDialogRef<AuthPromptDialogComponent>);
  private router = inject(Router);

  goToLogin(): void {
    this.dialogRef.close();
    this.router.navigate(['/login']);
  }

  goToRegister(): void {
    this.dialogRef.close();
    this.router.navigate(['/register']);
  }
}
```

- [ ] **Step 2: Create the template**

Create `src/app/shared/auth-prompt-dialog/auth-prompt-dialog.component.html`:

```html
<h2 mat-dialog-title>Sign in to message the seller</h2>

<mat-dialog-content>
  <p class="prompt-message">
    You need to be logged in to message a seller.
    Please log in or create a free account to continue.
  </p>
</mat-dialog-content>

<mat-dialog-actions align="end">
  <button mat-button mat-dialog-close>Cancel</button>
  <button mat-stroked-button (click)="goToRegister()">Register</button>
  <button mat-raised-button color="primary" (click)="goToLogin()">Log in</button>
</mat-dialog-actions>
```

- [ ] **Step 3: Create the styles**

Create `src/app/shared/auth-prompt-dialog/auth-prompt-dialog.component.scss`:

```scss
.prompt-message {
  font-size: 0.95rem;
  color: #444;
  line-height: 1.5;
  margin: 0.5rem 0;
}
```

- [ ] **Step 4: Commit**

```bash
git add src/app/shared/auth-prompt-dialog/
git commit -m "feat: add AuthPromptDialogComponent for unauthenticated message seller flow"
```

---

## Task 3: MessageSellerDialogComponent

**Files:**
- Create: `src/app/shared/message-seller-dialog/message-seller-dialog.component.ts`
- Create: `src/app/shared/message-seller-dialog/message-seller-dialog.component.html`
- Create: `src/app/shared/message-seller-dialog/message-seller-dialog.component.scss`

- [ ] **Step 1: Create the component TypeScript**

Create `src/app/shared/message-seller-dialog/message-seller-dialog.component.ts`:

```typescript
import { Component, inject } from '@angular/core';
import { CommonModule, UpperCasePipe } from '@angular/common';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { MAT_DIALOG_DATA, MatDialogRef, MatDialogModule } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { take } from 'rxjs';
import { AuthService } from '../../../services/auth.service';
import { SellerEnquiryService } from '../../../services/seller-enquiry.service';
import { PlateListing } from '../../../models/plate-listing.model';

@Component({
  selector: 'app-message-seller-dialog',
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    MatDialogModule,
    MatFormFieldModule,
    MatInputModule,
    MatSelectModule,
    MatButtonModule,
    MatIconModule,
    MatProgressSpinnerModule,
    UpperCasePipe
  ],
  templateUrl: './message-seller-dialog.component.html',
  styleUrl: './message-seller-dialog.component.scss'
})
export class MessageSellerDialogComponent {
  listing: PlateListing = inject(MAT_DIALOG_DATA);
  private dialogRef = inject(MatDialogRef<MessageSellerDialogComponent>);
  private fb = inject(FormBuilder);
  private authService = inject(AuthService);
  private enquiryService = inject(SellerEnquiryService);

  readonly enquiryTypes = [
    'I love this plate, I want to buy it',
    "I'm interested, I want to provide an offer",
    'Other'
  ];

  form: FormGroup = this.fb.group({
    enquiryType: ['', Validators.required],
    message: ['', [Validators.required, Validators.minLength(10)]]
  });

  loading = false;
  submitted = false;
  errorMessage = '';

  get whatsappUrl(): string {
    const number = this.listing.lCNumber.replace(/\D/g, '');
    const enquiryType = this.form.value.enquiryType ?? '';
    const message = this.form.value.message ?? '';
    const text = encodeURIComponent(
      `Hi, I'm enquiring about ${this.listing.plateCharacters.toUpperCase()} listed at £${this.listing.askingPrice}. ${enquiryType}. ${message}`
    );
    return `https://wa.me/${number}?text=${text}`;
  }

  async onSubmit(): Promise<void> {
    if (this.form.invalid) return;
    this.loading = true;
    this.errorMessage = '';

    this.authService.currentUser$.pipe(take(1)).subscribe(async user => {
      try {
        await this.enquiryService.saveEnquiry({
          plateId: this.listing.id,
          plateCharacters: this.listing.plateCharacters,
          enquiryType: this.form.value.enquiryType,
          message: this.form.value.message,
          buyerUid: user!.uid,
          buyerEmail: user!.email ?? '',
          sellerLCNumber: this.listing.lCNumber
        });
        this.submitted = true;
      } catch {
        this.errorMessage = 'Something went wrong. Please try again.';
      } finally {
        this.loading = false;
      }
    });
  }
}
```

- [ ] **Step 2: Create the template**

Create `src/app/shared/message-seller-dialog/message-seller-dialog.component.html`:

```html
<h2 mat-dialog-title>Message Seller › {{ listing.plateCharacters | uppercase }}</h2>

<mat-dialog-content>
  @if (submitted) {
    <div class="success-state">
      <mat-icon class="success-icon">check_circle</mat-icon>
      <p>Your message has been sent! The seller will be in touch.</p>
    </div>
  } @else {
    <div class="plate-summary">
      <div class="plate-css">
        <span class="bevel-plate">{{ listing.plateCharacters | uppercase }}</span>
      </div>
      @if (listing.meanings) {
        <p class="summary-meaning">{{ listing.meanings }}</p>
      }
      <span class="summary-price">£{{ listing.askingPrice }}</span>
    </div>

    <form [formGroup]="form" class="enquiry-form">
      <mat-form-field appearance="outline" class="full-field">
        <mat-label>Reason for enquiry</mat-label>
        <mat-select formControlName="enquiryType">
          @for (type of enquiryTypes; track type) {
            <mat-option [value]="type">{{ type }}</mat-option>
          }
        </mat-select>
        <mat-error>Please select an enquiry type</mat-error>
      </mat-form-field>

      <mat-form-field appearance="outline" class="full-field">
        <mat-label>Your message</mat-label>
        <textarea matInput formControlName="message" rows="4"
          placeholder="Tell the seller more..."></textarea>
        @if (form.get('message')?.hasError('required')) {
          <mat-error>Message is required</mat-error>
        }
        @if (form.get('message')?.hasError('minlength')) {
          <mat-error>Message must be at least 10 characters</mat-error>
        }
      </mat-form-field>

      @if (errorMessage) {
        <p class="error-message">{{ errorMessage }}</p>
      }
    </form>

    <div class="whatsapp-row">
      <span class="whatsapp-label">Or contact via</span>
      <a [href]="whatsappUrl" target="_blank" rel="noopener noreferrer"
        class="whatsapp-link" mat-stroked-button>
        <mat-icon>chat</mat-icon>
        WhatsApp
      </a>
    </div>
  }
</mat-dialog-content>

<mat-dialog-actions align="end">
  @if (submitted) {
    <button mat-raised-button color="primary" mat-dialog-close>Close</button>
  } @else {
    <button mat-button mat-dialog-close>Cancel</button>
    <button mat-raised-button color="primary"
      [disabled]="form.invalid || loading"
      (click)="onSubmit()">
      @if (loading) { Sending... } @else { Send Message }
    </button>
  }
</mat-dialog-actions>
```

- [ ] **Step 3: Create the styles**

Create `src/app/shared/message-seller-dialog/message-seller-dialog.component.scss`:

```scss
.plate-summary {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.5rem;
  margin-bottom: 1.25rem;
}

.plate-css {
  height: 60px;
  border-radius: 5px;
  background-color: #ff0;
  color: #000;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 0 20px;
  box-shadow: 0px 2px 4px -1px rgba(0,0,0,0.2), 0px 4px 5px 0px rgba(0,0,0,0.14), 0px 1px 10px 0px rgba(0,0,0,0.12);

  .bevel-plate {
    font-size: 2rem;
  }
}

.summary-meaning {
  font-size: 0.8rem;
  color: #555;
  text-align: center;
  margin: 0;
}

.summary-price {
  font-size: 1rem;
  font-weight: 700;
  color: white;
  background-color: #ff4081;
  border-radius: 999px;
  padding: 4px 14px;
}

.enquiry-form {
  display: flex;
  flex-direction: column;
}

.full-field {
  width: 100%;
}

.error-message {
  color: #d32f2f;
  font-size: 0.85rem;
  margin-top: -0.5rem;
}

.whatsapp-row {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  margin-top: 0.75rem;
}

.whatsapp-label {
  font-size: 0.85rem;
  color: #666;
}

.whatsapp-link {
  color: #25d366;
  border-color: #25d366 !important;
  text-decoration: none;

  mat-icon {
    font-size: 1.1rem;
    width: 1.1rem;
    height: 1.1rem;
    margin-right: 4px;
  }
}

.success-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.75rem;
  padding: 1.5rem 0;
  text-align: center;
}

.success-icon {
  font-size: 3rem;
  width: 3rem;
  height: 3rem;
  color: #2e7d32;
}
```

- [ ] **Step 4: Commit**

```bash
git add src/app/shared/message-seller-dialog/
git commit -m "feat: add MessageSellerDialogComponent with enquiry form and WhatsApp link"
```

---

## Task 4: Wire into PlatesForSaleComponent

**Files:**
- Modify: `src/app/core/plates-for-sale/plates-for-sale.component.ts`
- Modify: `src/app/core/plates-for-sale/plates-for-sale.component.html`

- [ ] **Step 1: Update the component TypeScript**

Replace the imports block and class body of `src/app/core/plates-for-sale/plates-for-sale.component.ts` — add `MatDialog`, `AuthService`, and the two new dialog components, plus the `onMessageSeller` method:

Add these imports at the top:

```typescript
import { MatDialog } from '@angular/material/dialog';
import { AuthService } from '../../services/auth.service';
import { AuthPromptDialogComponent } from '../../shared/auth-prompt-dialog/auth-prompt-dialog.component';
import { MessageSellerDialogComponent } from '../../shared/message-seller-dialog/message-seller-dialog.component';
```

Add `MatDialogModule` to the `imports` array in `@Component`:

```typescript
imports: [MatCardModule, MatIconModule, MatTabsModule, MatButtonModule, MatBadgeModule, BenefitCardComponent, ShareButtonsComponent, RecentlySoldComponent, ScrollingModule, UpperCasePipe, DatePipe, DecimalPipe, MatFormFieldModule, MatInputModule, FormsModule, MatDialogModule],
```

Add these two injects inside the class (alongside the existing `plateListingService`):

```typescript
private dialog = inject(MatDialog);
private authService = inject(AuthService);
```

Add this method to the class (after `trackRow`):

```typescript
onMessageSeller(listing: PlateListing): void {
  this.authService.currentUser$.pipe(take(1)).subscribe(user => {
    if (!user) {
      this.dialog.open(AuthPromptDialogComponent, { width: '380px' });
    } else {
      this.dialog.open(MessageSellerDialogComponent, {
        width: '520px',
        data: listing
      });
    }
  });
}
```

Add this import at the top of the file (with other rxjs imports):

```typescript
import { take } from 'rxjs';
```

- [ ] **Step 2: Wire the button in the template**

In `src/app/core/plates-for-sale/plates-for-sale.component.html`, find the Message Seller button and add the click handler:

Replace:
```html
<button mat-raised-button class="message-seller-btn"
    [matBadge]="listing.viewsPlaceholder"
    matBadgePosition="above after"
    matBadgeColor="accent">
    Message Seller
</button>
```

With:
```html
<button mat-raised-button class="message-seller-btn"
    [matBadge]="listing.viewsPlaceholder"
    matBadgePosition="above after"
    matBadgeColor="accent"
    (click)="onMessageSeller(listing)">
    Message Seller
</button>
```

- [ ] **Step 3: Verify the app compiles**

```bash
ng build --configuration development 2>&1 | tail -20
```

Expected: Build succeeds with no errors.

- [ ] **Step 4: Manual smoke test**

1. Open the app, navigate to Plates for Sale → Buy tab
2. While **not** logged in, click "Message Seller" on any card → `AuthPromptDialogComponent` should open with Log in / Register buttons
3. Log in, return to Buy tab, click "Message Seller" → `MessageSellerDialogComponent` should open showing the plate, dropdown, textarea, WhatsApp link
4. Fill in the form and submit → success state appears ("Your message has been sent!")
5. Check Firebase console → `seller_enquiries` collection should contain the new document

- [ ] **Step 5: Commit**

```bash
git add src/app/core/plates-for-sale/plates-for-sale.component.ts
git add src/app/core/plates-for-sale/plates-for-sale.component.html
git commit -m "feat: wire message seller button to auth prompt and enquiry dialog"
```
