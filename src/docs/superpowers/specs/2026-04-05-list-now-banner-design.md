# List Now Banner — Design Spec
**Date:** 2026-04-05

## Overview
Extract the listing fee (£6) into `PlateListingService` as a single source of truth, create a reusable `ListNowBannerComponent` that reads from the service, and update the existing benefit card in `PlatesForSaleComponent` to use the service value instead of a hardcoded string.

---

## Architecture

### Modified / Created Files

| Action | File | Change |
|--------|------|--------|
| Modify | `src/app/services/plate-listing.service.ts` | Add `readonly listingFee = 22` |
| Create | `src/app/shared/list-now-banner/list-now-banner.component.ts` | New standalone banner component |
| Create | `src/app/shared/list-now-banner/list-now-banner.component.html` | Banner template |
| Create | `src/app/shared/list-now-banner/list-now-banner.component.scss` | Banner styles |
| Modify | `src/app/core/plates-for-sale/plates-for-sale.component.ts` | Inject `PlateListingService`, update `buttonName` |

---

## 1. PlateListingService

Add a single readonly property to the existing service:

```typescript
readonly listingFee = 6;
```

No other changes to the service.

---

## 2. ListNowBannerComponent

**Selector:** `app-list-now-banner`

**TypeScript:**
- Standalone component
- Injects `PlateListingService`
- Exposes `plateListingService` as a public property so the template can read `listingFee`
- No inputs — the fee always comes from the service

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

**Template:**

Full-width strip with left-aligned text and a right-aligned button:

```html
<div class="list-now-banner">
  <span class="banner-text">Want to sell your plate? List now for £{{ plateListingService.listingFee }}</span>
  <a mat-raised-button color="primary" routerLink="/list-plate">List now</a>
</div>
```

**Styles:**

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

---

## 3. PlatesForSaleComponent

### TypeScript
- Inject `PlateListingService` using `inject()`
- Update the `buttonName` in the `benefits` array from the hardcoded string to a template literal:

```typescript
private plateListingService = inject(PlateListingService);

// In the benefits array:
buttonName: `List now for £${this.plateListingService.listingFee}`,
```

No other changes to the component.

---

## Data Flow

```
PlateListingService.listingFee (= 22)
  → ListNowBannerComponent (reads via inject)
    → Rendered as: "Want to sell your plate? List now for £6"
  → PlatesForSaleComponent benefit card buttonName
    → Rendered via BenefitCardComponent as: "List now for £6"
```
