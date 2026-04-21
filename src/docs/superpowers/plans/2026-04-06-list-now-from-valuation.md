# List Now from Valuation Results — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a "List Now" button to both valuation results pages that navigates to `/list-plate` with plate characters and valuation pre-filled.

**Architecture:** Each valuation component gains a `listNow()` method that calls `router.navigate(['/list-plate'], { queryParams: { plate, price, min, max } })`. `ListPlateComponent` reads those query params on init, pre-fills the form, and shows a valuation range hint below the asking price field.

**Tech Stack:** Angular Router `queryParams`, `ActivatedRoute`, Angular reactive forms `patchValue`.

---

## File Structure

- **Modify:** `src/app/core/list-plate/list-plate.component.ts` — read query params, store min/max for hint
- **Modify:** `src/app/core/list-plate/list-plate.component.html` — show valuation range hint
- **Modify:** `src/app/core/reg-plate-valuation-results/reg-plate-valuation-results.component.ts` — add `listNow()` method (Router already injected at line 130)
- **Modify:** `src/app/core/reg-plate-valuation-results/reg-plate-valuation-results.component.html` — add 2 List Now buttons
- **Modify:** `src/app/core/current-plate-valuation/current-plate-valuation.component.ts` — add `listNow()` method (Router already injected at line 70)
- **Modify:** `src/app/core/current-plate-valuation/current-plate-valuation.component.html` — add 2 List Now buttons

---

### Task 1: Update ListPlateComponent to read query params and show hint

**Files:**
- Modify: `src/app/core/list-plate/list-plate.component.ts`
- Modify: `src/app/core/list-plate/list-plate.component.html`

**Context:** The current `ngOnInit` at line 52–59 only checks auth and pre-fills email. We need to also read `plate`, `price`, `min`, `max` query params and pre-fill the form. `ActivatedRoute` is not yet injected. `RouterModule` is already in imports.

- [ ] **Step 1: Update list-plate.component.ts**

Replace the entire file contents with:

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
import { RouterModule, ActivatedRoute } from '@angular/router';
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
  private route = inject(ActivatedRoute);

  form: FormGroup = this.fb.group({
    plateCharacters: ['', [Validators.required, Validators.minLength(2), Validators.maxLength(8)]],
    askingPrice: ['', [Validators.required, Validators.min(1)]],
    phone: ['', Validators.required],
    email: ['', [Validators.required, Validators.email]],
    initials: ['', [Validators.required, Validators.maxLength(3)]],
    meanings: [''],
    negotiable: [false],
  });

  loading = false;
  errorMessage = '';
  valuationMin: number | null = null;
  valuationMax: number | null = null;

  ngOnInit(): void {
    const params = this.route.snapshot.queryParams;
    const prefill: Record<string, string> = {};
    if (params['plate']) prefill['plateCharacters'] = String(params['plate']).toUpperCase();
    if (params['price']) prefill['askingPrice'] = String(params['price']);
    if (Object.keys(prefill).length) this.form.patchValue(prefill);
    if (params['min']) this.valuationMin = Number(params['min']);
    if (params['max']) this.valuationMax = Number(params['max']);

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
        initials: this.form.value.initials.toUpperCase(),
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

- [ ] **Step 2: Add valuation range hint to list-plate.component.html**

The asking price `mat-form-field` currently ends at line 24. Add the hint block immediately after it (before the phone field):

Find:
```html
      <mat-form-field appearance="outline" class="full-field">
        <mat-label>Asking price (£)</mat-label>
        <input matInput type="number" formControlName="askingPrice" placeholder="e.g. 5000" min="1">
        <mat-error>A valid asking price is required</mat-error>
      </mat-form-field>
```

Replace with:
```html
      <mat-form-field appearance="outline" class="full-field">
        <mat-label>Asking price (£)</mat-label>
        <input matInput type="number" formControlName="askingPrice" placeholder="e.g. 5000" min="1">
        <mat-error>A valid asking price is required</mat-error>
      </mat-form-field>

      @if (valuationMin !== null && valuationMax !== null) {
        <p class="valuation-hint text-muted">
          Valuation range: £{{ valuationMin | number:'1.2-2' }} – £{{ valuationMax | number:'1.2-2' }}.
          You can adjust the price above.
        </p>
      }
```

- [ ] **Step 3: Verify TypeScript compiles**

```bash
cd /Users/gurvindersinghsandhu/Documents/development/guv/projects/mrg-app-v1
npx tsc --noEmit
```

Expected: no output (clean).

- [ ] **Step 4: Commit**

```bash
git add src/app/core/list-plate/list-plate.component.ts \
        src/app/core/list-plate/list-plate.component.html
git commit -m "feat: pre-fill list-plate form from valuation query params"
```

---

### Task 2: Add listNow() to reg-plate-valuation-results and insert buttons

**Files:**
- Modify: `src/app/core/reg-plate-valuation-results/reg-plate-valuation-results.component.ts`
- Modify: `src/app/core/reg-plate-valuation-results/reg-plate-valuation-results.component.html`

**Context:**
- `Router` is already injected at line 130: `private router = inject(Router);`
- Key properties: `currentPlate: string`, `totalPoints: number`, `multiplier: number`, `minPrice: number`, `maxPrice: number`
- Template insertion points:
  - Line ~209: between end of min/max `</mat-card>` and `<app-share-buttons>` (this satisfies both "below plate card" and "above share buttons")
  - Line ~269: after the bottom `Start Over` button

- [ ] **Step 1: Add listNow() method to the component TS**

In `reg-plate-valuation-results.component.ts`, find the `onResetPlateForm()` method and add `listNow()` immediately after it:

Find:
```typescript
  onResetPlateForm(): void {
```

(read the full method body and the closing brace, then add after it):

First read lines around `onResetPlateForm` to find the end of the method:
```bash
grep -n "onResetPlateForm" src/app/core/reg-plate-valuation-results/reg-plate-valuation-results.component.ts
```

Then add the following method to the class (place it after `onResetPlateForm`):

```typescript
  listNow(): void {
    this.router.navigate(['/list-plate'], {
      queryParams: {
        plate: this.currentPlate.toUpperCase(),
        price: (this.totalPoints * this.multiplier).toFixed(2),
        min: this.minPrice.toFixed(2),
        max: this.maxPrice.toFixed(2),
      },
    });
  }
```

- [ ] **Step 2: Add List Now button above share-buttons in template**

In `reg-plate-valuation-results.component.html`, find:
```html
    <app-share-buttons [shareText]="shareText" />
```

Replace with:
```html
    <p class="d-flex justify-content-center">
      <button mat-raised-button type="button" class="list-now-btn" (click)="listNow()">List Now</button>
    </p>

    <app-share-buttons [shareText]="shareText" />
```

- [ ] **Step 3: Add List Now button after the bottom Start Over button**

In `reg-plate-valuation-results.component.html`, find the bottom Start Over button (line ~269):
```html
        <button mat-raised-button type="button" class="valuate-now" (click)="onResetPlateForm()">Start Over</button>
```

Replace with:
```html
        <button mat-raised-button type="button" class="valuate-now" (click)="onResetPlateForm()">Start Over</button>
        <button mat-raised-button type="button" class="list-now-btn" (click)="listNow()">List Now</button>
```

- [ ] **Step 4: Add .list-now-btn style**

In `src/app/core/reg-plate-valuation-results/reg-plate-valuation-results.component.scss`, add at the end of the file:

```scss
.list-now-btn {
  margin: 0.5rem;
  background-color: #2e7d32;
  color: white;
}
```

- [ ] **Step 5: Verify TypeScript compiles**

```bash
npx tsc --noEmit
```

Expected: no output (clean).

- [ ] **Step 6: Commit**

```bash
git add src/app/core/reg-plate-valuation-results/reg-plate-valuation-results.component.ts \
        src/app/core/reg-plate-valuation-results/reg-plate-valuation-results.component.html \
        src/app/core/reg-plate-valuation-results/reg-plate-valuation-results.component.scss
git commit -m "feat: add List Now button to reg-plate-valuation-results"
```

---

### Task 3: Add listNow() to current-plate-valuation and insert buttons

**Files:**
- Modify: `src/app/core/current-plate-valuation/current-plate-valuation.component.ts`
- Modify: `src/app/core/current-plate-valuation/current-plate-valuation.component.html`

**Context:**
- `Router` is already injected at line 70: `private router = inject(Router);`
- Key properties: `registration: string | null`, `totalPrice: number`, `minPrice: number`, `maxPrice: number`
- Template insertion points:
  - Line ~310: between `<app-plate-valuation-totals ... />` and `<app-share-buttons>` (satisfies "below plate card" and "above share buttons")
  - Line ~321: after the `Start Over` button

- [ ] **Step 1: Add listNow() method to the component TS**

In `current-plate-valuation.component.ts`, find the `onReset()` method and add `listNow()` immediately after it:

```typescript
  listNow(): void {
    this.router.navigate(['/list-plate'], {
      queryParams: {
        plate: (this.registration ?? '').toUpperCase(),
        price: this.totalPrice.toFixed(2),
        min: this.minPrice.toFixed(2),
        max: this.maxPrice.toFixed(2),
      },
    });
  }
```

- [ ] **Step 2: Add List Now button between totals and share-buttons in template**

In `current-plate-valuation.component.html`, find:
```html
      <app-share-buttons [shareText]="shareText" />
```

Replace with:
```html
      <p class="d-flex justify-content-center">
        <button mat-raised-button type="button" class="list-now-btn" (click)="listNow()">List Now</button>
      </p>

      <app-share-buttons [shareText]="shareText" />
```

- [ ] **Step 3: Add List Now button after the Start Over button**

In `current-plate-valuation.component.html`, find:
```html
        <button mat-raised-button type="button" class="valuate-now" (click)="onReset()">Start Over</button>
```

Replace with:
```html
        <button mat-raised-button type="button" class="valuate-now" (click)="onReset()">Start Over</button>
        <button mat-raised-button type="button" class="list-now-btn" (click)="listNow()">List Now</button>
```

- [ ] **Step 4: Add .list-now-btn style**

In `src/app/core/current-plate-valuation/current-plate-valuation.component.scss`, add at the end of the file:

```scss
.list-now-btn {
  margin: 0.5rem;
  background-color: #2e7d32;
  color: white;
}
```

- [ ] **Step 5: Verify TypeScript compiles**

```bash
npx tsc --noEmit
```

Expected: no output (clean).

- [ ] **Step 6: Commit**

```bash
git add src/app/core/current-plate-valuation/current-plate-valuation.component.ts \
        src/app/core/current-plate-valuation/current-plate-valuation.component.html \
        src/app/core/current-plate-valuation/current-plate-valuation.component.scss
git commit -m "feat: add List Now button to current-plate-valuation"
```

---

### Task 4: Build and deploy to GitHub Pages

**Files:**
- Modify: `docs/` (build output)

- [ ] **Step 1: Production build**

```bash
cd /Users/gurvindersinghsandhu/Documents/development/guv/projects/mrg-app-v1
npx ng build --configuration production
```

Expected: `Application bundle generation complete.` with only warnings (no errors).

- [ ] **Step 2: Copy 404.html**

```bash
cp docs/index.html docs/404.html
```

- [ ] **Step 3: Commit and push**

```bash
git add docs/
git commit -m "Production build for GitHub Pages"
git push origin master
```

Expected: pushed cleanly to `master`, GitHub Pages deploys within ~2 minutes.

- [ ] **Step 4: Smoke test**

1. Go to `https://mrvaluations.co.uk`, enter a plate and get a valuation
2. Verify "List Now" button appears above share buttons and after Start Over
3. Click "List Now" — should land on `/list-plate` with plate and price pre-filled
4. Verify the valuation range hint shows below the asking price field
5. Verify the price is editable
