# Reply to Enquiry Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a Reply button to each enquiry card in the Messages tab so admins/sellers can send a reply email to buyers via the platform `mail` Firestore collection.

**Architecture:** A new `ReplyToEnquiryDialogComponent` (standalone, follows the existing `MessageSellerDialogComponent` pattern exactly) is opened from `AccountDashboardComponent` when the Reply button is clicked. It calls a new `sendReply()` method on `SellerEnquiryService` which writes to the `mail` Firestore collection, triggering the Firebase Email Extension.

**Tech Stack:** Angular 17+ standalone components, Angular Material Dialog (`MAT_DIALOG_DATA`, `MatDialogRef`), Angular Reactive Forms, Angular Fire (`addDoc`, `collection`), Firebase Email Extension (`mail` collection).

---

## File Map

| Action | File | Responsibility |
|--------|------|----------------|
| Modify | `src/app/services/seller-enquiry.service.ts` | Add `sendReply()` method |
| Create | `src/app/shared/reply-to-enquiry-dialog/reply-to-enquiry-dialog.component.ts` | Dialog logic |
| Create | `src/app/shared/reply-to-enquiry-dialog/reply-to-enquiry-dialog.component.html` | Dialog template |
| Create | `src/app/shared/reply-to-enquiry-dialog/reply-to-enquiry-dialog.component.scss` | Dialog styles |
| Modify | `src/app/core/account-dashboard/account-dashboard.component.ts` | Inject `MatDialog`, add `onReply()` |
| Modify | `src/app/core/account-dashboard/account-dashboard.component.html` | Add Reply button to enquiry cards |

---

### Task 1: Add `sendReply()` to `SellerEnquiryService`

**Files:**
- Modify: `src/app/services/seller-enquiry.service.ts`

- [ ] **Step 1: Add `sendReply()` to the service**

Open `src/app/services/seller-enquiry.service.ts`. The file already imports `addDoc` and `collection` from `@angular/fire/firestore`. Add the method below at the end of the class body (after `getEnquiriesForSeller`):

```typescript
sendReply(enquiry: SellerEnquiry, replyMessage: string): Promise<void> {
  const mailRef = collection(this.firestore, 'mail');
  return addDoc(mailRef, {
    to: [enquiry.buyerEmail],
    message: {
      subject: `Re: Your enquiry about ${enquiry.plateCharacters.toUpperCase()}`,
      html: `
        <h2>The seller has replied to your enquiry</h2>
        <p><strong>Plate:</strong> ${enquiry.plateCharacters.toUpperCase()}</p>
        <p><strong>Reply:</strong> ${replyMessage}</p>
        <hr>
        <p style="color:#888"><em>Your original message: ${enquiry.message}</em></p>
      `
    }
  }).then(() => {});
}
```

The full updated file should look like this (showing only the class body additions; keep all existing imports and code unchanged):

```typescript
// After getEnquiriesForSeller() ...

sendReply(enquiry: SellerEnquiry, replyMessage: string): Promise<void> {
  const mailRef = collection(this.firestore, 'mail');
  return addDoc(mailRef, {
    to: [enquiry.buyerEmail],
    message: {
      subject: `Re: Your enquiry about ${enquiry.plateCharacters.toUpperCase()}`,
      html: `
        <h2>The seller has replied to your enquiry</h2>
        <p><strong>Plate:</strong> ${enquiry.plateCharacters.toUpperCase()}</p>
        <p><strong>Reply:</strong> ${replyMessage}</p>
        <hr>
        <p style="color:#888"><em>Your original message: ${enquiry.message}</em></p>
      `
    }
  }).then(() => {});
}
```

- [ ] **Step 2: Verify TypeScript compiles**

Run: `npx tsc --noEmit`
Expected: no errors related to `sendReply`

- [ ] **Step 3: Commit**

```bash
git add src/app/services/seller-enquiry.service.ts
git commit -m "feat: add sendReply() to SellerEnquiryService"
```

---

### Task 2: Create `ReplyToEnquiryDialogComponent`

**Files:**
- Create: `src/app/shared/reply-to-enquiry-dialog/reply-to-enquiry-dialog.component.ts`
- Create: `src/app/shared/reply-to-enquiry-dialog/reply-to-enquiry-dialog.component.html`
- Create: `src/app/shared/reply-to-enquiry-dialog/reply-to-enquiry-dialog.component.scss`

- [ ] **Step 1: Create the TypeScript component**

Create `src/app/shared/reply-to-enquiry-dialog/reply-to-enquiry-dialog.component.ts`:

```typescript
import { Component, inject } from '@angular/core';
import { CommonModule, UpperCasePipe } from '@angular/common';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { MAT_DIALOG_DATA, MatDialogRef, MatDialogModule } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { SellerEnquiryService, SellerEnquiry } from '../../services/seller-enquiry.service';

@Component({
  selector: 'app-reply-to-enquiry-dialog',
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    MatDialogModule,
    MatFormFieldModule,
    MatInputModule,
    MatButtonModule,
    MatIconModule,
    MatProgressSpinnerModule,
    UpperCasePipe
  ],
  templateUrl: './reply-to-enquiry-dialog.component.html',
  styleUrl: './reply-to-enquiry-dialog.component.scss'
})
export class ReplyToEnquiryDialogComponent {
  enquiry: SellerEnquiry = inject(MAT_DIALOG_DATA);
  private dialogRef = inject(MatDialogRef<ReplyToEnquiryDialogComponent>);
  private fb = inject(FormBuilder);
  private enquiryService = inject(SellerEnquiryService);

  form: FormGroup = this.fb.group({
    replyMessage: ['', [Validators.required, Validators.minLength(10)]]
  });

  loading = false;
  submitted = false;
  errorMessage = '';

  async onSubmit(): Promise<void> {
    if (this.form.invalid) return;
    this.loading = true;
    this.errorMessage = '';
    try {
      await this.enquiryService.sendReply(this.enquiry, this.form.value.replyMessage);
      this.submitted = true;
    } catch {
      this.errorMessage = 'Something went wrong. Please try again.';
    } finally {
      this.loading = false;
    }
  }
}
```

- [ ] **Step 2: Create the HTML template**

Create `src/app/shared/reply-to-enquiry-dialog/reply-to-enquiry-dialog.component.html`:

```html
<h2 mat-dialog-title>Reply to {{ enquiry.plateCharacters | uppercase }}</h2>

<mat-dialog-content>
  @if (submitted) {
    <div class="success-state">
      <mat-icon class="success-icon">check_circle</mat-icon>
      <p>Reply sent!</p>
    </div>
  } @else {
    <div class="enquiry-context">
      <p><strong>From:</strong> {{ enquiry.buyerEmail }}</p>
      <p><strong>Enquiry type:</strong> {{ enquiry.enquiryType }}</p>
      <p><strong>Original message:</strong> {{ enquiry.message }}</p>
    </div>

    <form [formGroup]="form" class="reply-form">
      <mat-form-field appearance="outline" class="full-field">
        <mat-label>Your reply</mat-label>
        <textarea matInput formControlName="replyMessage" rows="5"
          placeholder="Type your reply here..."></textarea>
        @if (form.get('replyMessage')?.hasError('required')) {
          <mat-error>Reply is required</mat-error>
        }
        @if (form.get('replyMessage')?.hasError('minlength')) {
          <mat-error>Reply must be at least 10 characters</mat-error>
        }
      </mat-form-field>

      @if (errorMessage) {
        <p class="error-message">{{ errorMessage }}</p>
      }
    </form>
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
      @if (loading) { Sending... } @else { Send Reply }
    </button>
  }
</mat-dialog-actions>
```

- [ ] **Step 3: Create the SCSS**

Create `src/app/shared/reply-to-enquiry-dialog/reply-to-enquiry-dialog.component.scss`:

```scss
.enquiry-context {
  background: #f5f5f5;
  border-radius: 6px;
  padding: 0.75rem 1rem;
  margin-bottom: 1.25rem;

  p {
    margin: 0.25rem 0;
    font-size: 0.9rem;
    color: #444;
  }
}

.reply-form {
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

- [ ] **Step 4: Verify TypeScript compiles**

Run: `npx tsc --noEmit`
Expected: no errors

- [ ] **Step 5: Commit**

```bash
git add src/app/shared/reply-to-enquiry-dialog/
git commit -m "feat: create ReplyToEnquiryDialogComponent"
```

---

### Task 3: Wire Reply button into `AccountDashboardComponent`

**Files:**
- Modify: `src/app/core/account-dashboard/account-dashboard.component.ts`
- Modify: `src/app/core/account-dashboard/account-dashboard.component.html`

- [ ] **Step 1: Update the TypeScript**

Open `src/app/core/account-dashboard/account-dashboard.component.ts`.

Add these imports at the top (after the existing imports):

```typescript
import { MatDialog, MatDialogModule } from '@angular/material/dialog';
import { ReplyToEnquiryDialogComponent } from '../../shared/reply-to-enquiry-dialog/reply-to-enquiry-dialog.component';
```

Add `MatDialogModule` to the `imports` array in `@Component`:

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
  MatDialogModule   // <-- add this
],
```

Inject `MatDialog` in the constructor (add alongside the existing private router and authService):

```typescript
constructor(
  private router: Router,
  private authService: AuthService,
  private dialog: MatDialog   // <-- add this
) {
```

Add the `onReply()` method to the class body (after `signOut()`):

```typescript
onReply(enquiry: SellerEnquiry): void {
  this.dialog.open(ReplyToEnquiryDialogComponent, { width: '520px', data: enquiry });
}
```

- [ ] **Step 2: Add the Reply button to the HTML**

Open `src/app/core/account-dashboard/account-dashboard.component.html`.

Find the enquiry card block (inside the Messages tab `@for` loop):

```html
<div class="enquiry-card">
    <div class="enquiry-plate-row">
        <span class="bevel-plate enquiry-plate">{{ enquiry.plateCharacters | uppercase }}</span>
        <span class="enquiry-date">{{ enquiry.submittedAt?.toDate() | date:'d MMM y, HH:mm' }}</span>
    </div>
    <p class="enquiry-type">{{ enquiry.enquiryType }}</p>
    <p class="enquiry-message">{{ enquiry.message }}</p>
    <p class="enquiry-from">From: {{ enquiry.buyerEmail }}</p>
</div>
```

Replace it with (adds Reply button at the bottom of each card):

```html
<div class="enquiry-card">
    <div class="enquiry-plate-row">
        <span class="bevel-plate enquiry-plate">{{ enquiry.plateCharacters | uppercase }}</span>
        <span class="enquiry-date">{{ enquiry.submittedAt?.toDate() | date:'d MMM y, HH:mm' }}</span>
    </div>
    <p class="enquiry-type">{{ enquiry.enquiryType }}</p>
    <p class="enquiry-message">{{ enquiry.message }}</p>
    <p class="enquiry-from">From: {{ enquiry.buyerEmail }}</p>
    <button mat-stroked-button color="primary" (click)="onReply(enquiry)">
        Reply
    </button>
</div>
```

- [ ] **Step 3: Verify TypeScript compiles**

Run: `npx tsc --noEmit`
Expected: no errors

- [ ] **Step 4: Smoke test manually**

Run `ng serve`, navigate to Account Dashboard > Messages. Verify:
- Each enquiry card shows a Reply button
- Clicking Reply opens the dialog with buyer email, enquiry type, and original message shown as read-only context
- Typing fewer than 10 characters in the textarea shows a validation error
- Submitting a valid reply shows the spinner while loading, then transitions to the success state ("Reply sent!" + check icon)
- Closing the dialog works via the Cancel and Close buttons

- [ ] **Step 5: Commit**

```bash
git add src/app/core/account-dashboard/account-dashboard.component.ts
git add src/app/core/account-dashboard/account-dashboard.component.html
git commit -m "feat: wire Reply button to ReplyToEnquiryDialogComponent in account dashboard"
```
