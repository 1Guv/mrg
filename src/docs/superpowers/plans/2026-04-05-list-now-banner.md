# List Now Banner Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Extract the listing fee into `PlateListingService`, create a reusable `ListNowBannerComponent`, and update `PlatesForSaleComponent` to use the service value.

**Architecture:** A `readonly listingFee = 6` property is added to the existing `PlateListingService`. A new standalone `ListNowBannerComponent` injects the service and renders a full-width promotional strip linking to `/list-plate`. The existing `PlatesForSaleComponent` — which already injects `PlateListingService` — updates its hardcoded benefit card `buttonName` to a template literal reading from the service.

**Tech Stack:** Angular 17+ standalone components, Angular Material (MatButtonModule), Angular Router (RouterModule).

---

## File Map

| Action | File | Responsibility |
|--------|------|----------------|
| Modify | `src/app/services/plate-listing.service.ts` | Add `readonly listingFee = 6` |
| Create | `src/app/shared/list-now-banner/list-now-banner.component.ts` | Banner component logic |
| Create | `src/app/shared/list-now-banner/list-now-banner.component.html` | Banner template |
| Create | `src/app/shared/list-now-banner/list-now-banner.component.scss` | Banner styles |
| Modify | `src/app/core/plates-for-sale/plates-for-sale.component.ts` | Update hardcoded `buttonName` to use `listingFee` |

---

### Task 1: Add `listingFee` to `PlateListingService`

**Files:**
- Modify: `src/app/services/plate-listing.service.ts`

- [ ] **Step 1: Add the property**

Open `src/app/services/plate-listing.service.ts`. The class currently starts with:

```typescript
export class PlateListingService {

  private firestore = inject(Firestore);
  private readonly COLLECTION = 'plate-listings';
```

Add `readonly listingFee = 6;` after `COLLECTION`:

```typescript
export class PlateListingService {

  private firestore = inject(Firestore);
  private readonly COLLECTION = 'plate-listings';
  readonly listingFee = 6;
```

- [ ] **Step 2: Verify compilation**

Run: `cd /Users/gurvindersinghsandhu/Documents/development/guv/projects/mrg-app-v1 && npx tsc --noEmit 2>&1 | head -20`
Expected: no errors

- [ ] **Step 3: Commit**

```bash
git add src/app/services/plate-listing.service.ts
git commit -m "feat: add listingFee property to PlateListingService"
```

---

### Task 2: Create `ListNowBannerComponent`

**Files:**
- Create: `src/app/shared/list-now-banner/list-now-banner.component.ts`
- Create: `src/app/shared/list-now-banner/list-now-banner.component.html`
- Create: `src/app/shared/list-now-banner/list-now-banner.component.scss`

- [ ] **Step 1: Create the TypeScript component**

Create `src/app/shared/list-now-banner/list-now-banner.component.ts`:

```typescript
import { Component, inject } from '@angular/core';
import { RouterModule } from '@angular/router';
import { MatButtonModule } from '@angular/material/button';
import { PlateListingService } from '../../services/plate-listing.service';

@Component({
  selector: 'app-list-now-banner',
  standalone: true,
  imports: [RouterModule, MatButtonModule],
  templateUrl: './list-now-banner.component.html',
  styleUrl: './list-now-banner.component.scss'
})
export class ListNowBannerComponent {
  plateListingService = inject(PlateListingService);
}
```

- [ ] **Step 2: Create the HTML template**

Create `src/app/shared/list-now-banner/list-now-banner.component.html`:

```html
<div class="list-now-banner">
  <span class="banner-text">Want to sell your plate? List now for £{{ plateListingService.listingFee }}</span>
  <a mat-raised-button color="primary" routerLink="/list-plate">List now</a>
</div>
```

- [ ] **Step 3: Create the SCSS**

Create `src/app/shared/list-now-banner/list-now-banner.component.scss`:

```scss
.list-now-banner {
  display: flex;
  align-items: center;
  justify-content: space-between;
  background: #e8f0fe;
  border-radius: 8px;
  padding: 0.75rem 1.25rem;
  gap: 1rem;
}

.banner-text {
  font-size: 0.95rem;
  color: #1a237e;
  font-weight: 500;
}
```

- [ ] **Step 4: Verify compilation**

Run: `cd /Users/gurvindersinghsandhu/Documents/development/guv/projects/mrg-app-v1 && npx tsc --noEmit 2>&1 | head -20`
Expected: no errors

- [ ] **Step 5: Commit**

```bash
git add src/app/shared/list-now-banner/
git commit -m "feat: create ListNowBannerComponent"
```

---

### Task 3: Update `PlatesForSaleComponent` to use `listingFee`

**Files:**
- Modify: `src/app/core/plates-for-sale/plates-for-sale.component.ts`

- [ ] **Step 1: Update the hardcoded buttonName**

Open `src/app/core/plates-for-sale/plates-for-sale.component.ts`.

`PlateListingService` is already injected at line 33:
```typescript
private plateListingService = inject(PlateListingService);
```

Find the `benefits` array entry with `buttonName: 'List now for £22'` (around line 119) and change it to use the service:

```typescript
  benefits: BenefitCard[] = [
    {
      icon: 'payments',
      title: 'One-off payment',
      description: 'Pay once, no subscriptions or hidden fees.',
      backgroundColor: '#e8f0fe',
      button: true,
      buttonName: `List now for £${this.plateListingService.listingFee}`,
      buttonLink: '/list-plate'
    },
```

No other changes needed — `plateListingService` is already declared before `benefits` in the class body, so `this.plateListingService.listingFee` is available at field initialisation time.

- [ ] **Step 2: Verify compilation**

Run: `cd /Users/gurvindersinghsandhu/Documents/development/guv/projects/mrg-app-v1 && npx tsc --noEmit 2>&1 | head -20`
Expected: no errors

- [ ] **Step 3: Smoke test**

Run `ng serve`, navigate to `/plates-for-sale`. Verify:
- The "Sell" tab benefit card button reads "List now for £6" (not £22)
- Placing `<app-list-now-banner>` anywhere in any template renders the banner strip with the correct fee

- [ ] **Step 4: Commit**

```bash
git add src/app/core/plates-for-sale/plates-for-sale.component.ts
git commit -m "feat: use PlateListingService.listingFee in PlatesForSaleComponent benefit card"
```
