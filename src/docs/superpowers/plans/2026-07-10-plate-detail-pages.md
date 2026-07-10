# Plate Detail Pages & SEO Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add individual, Google-indexable pages for each plate listing at `/plates-for-sale/:plate`, add an `open_in_new` icon button to listing cards, and generate a sitemap that includes all active listing URLs at build time.

**Architecture:** A new `PlateDetailComponent` reads the normalised plate characters from the route param, queries Firestore via an extended `PlateListingService`, and sets dynamic `<title>`, `<meta>`, canonical, and JSON-LD tags following the same pattern as `NewsArticleComponent`. A build-time Node.js script generates `sitemap.xml` with all active plate URLs before the Angular build runs.

**Tech Stack:** Angular 19 (standalone components), Angular Fire, RxJS, Firebase Admin SDK (Node.js script), Karma/Jasmine

## Global Constraints

- All components are standalone (no NgModules)
- Follow existing code style: `inject()` for DI, signal inputs where appropriate, `@if` / `@for` control flow
- `.bevel-plate` and `@include cabin-font` are global — do not redefine them
- Scripts use `.mjs` ES module format (not TypeScript) matching existing scripts in `scripts/`
- Default page title to restore on destroy: `'FREE Instant Number Plate Valuation | UKs 1st Automated Tool'`
- Base URL: `https://mrvaluations.co.uk`

---

## File Map

| File | Action | Responsibility |
|------|--------|---------------|
| `src/app/utils/normalise-plate.ts` | Create | Shared normalisation logic (strip spaces, uppercase) |
| `src/app/utils/normalise-plate.spec.ts` | Create | Unit tests for normalise-plate |
| `src/app/core/plate-detail/plate-detail.component.ts` | Create | Detail page component logic + SEO tags |
| `src/app/core/plate-detail/plate-detail.component.html` | Create | Detail page template |
| `src/app/core/plate-detail/plate-detail.component.scss` | Create | Detail page styles |
| `src/app/core/plate-detail/plate-detail.component.spec.ts` | Create | Component unit tests |
| `src/app/services/plate-listing.service.ts` | Modify | Add `getByPlate()` method |
| `src/app/app.routes.ts` | Modify | Register `/plates-for-sale/:plate` route |
| `src/app/core/plates-for-sale/plates-for-sale.component.ts` | Modify | Add `normalisePlate()` method + `RouterLink` import |
| `src/app/core/plates-for-sale/plates-for-sale.component.html` | Modify | Add `open_in_new` icon button to each listing card |
| `src/app/core/plates-for-sale/plates-for-sale.component.scss` | Modify | Style the card actions row |
| `scripts/generate-sitemap.mjs` | Create | Fetch active listings + write `src/sitemap.xml` |
| `package.json` | Modify | Prepend sitemap generation to `build:gh-pages` |

---

## Task 1: `normalisePlate` utility + `getByPlate()` in `PlateListingService`

**Files:**
- Create: `src/app/utils/normalise-plate.ts`
- Create: `src/app/utils/normalise-plate.spec.ts`
- Modify: `src/app/services/plate-listing.service.ts`

**Interfaces:**
- Produces: `normalisePlate(plate: string): string` — exported from `src/app/utils/normalise-plate.ts`
- Produces: `PlateListingService.getByPlate(plateChars: string): Observable<PlateListing | null>`

- [ ] **Step 1: Write the failing tests for `normalisePlate`**

Create `src/app/utils/normalise-plate.spec.ts`:

```typescript
import { normalisePlate } from './normalise-plate';

describe('normalisePlate', () => {
  it('strips spaces and uppercases', () => {
    expect(normalisePlate('ab12 xyz')).toBe('AB12XYZ');
  });

  it('handles already-normalised input', () => {
    expect(normalisePlate('AB12XYZ')).toBe('AB12XYZ');
  });

  it('handles mixed case with spaces', () => {
    expect(normalisePlate('Ab12 Xyz')).toBe('AB12XYZ');
  });

  it('handles empty string', () => {
    expect(normalisePlate('')).toBe('');
  });
});
```

- [ ] **Step 2: Run tests to confirm they fail**

```bash
cd /Users/gurvindersinghsandhu/Documents/development/guv/projects/mrg-app-v1
npx ng test --include='**/normalise-plate.spec.ts' --watch=false
```

Expected: `Cannot find module './normalise-plate'`

- [ ] **Step 3: Create `normalisePlate` utility**

Create `src/app/utils/normalise-plate.ts`:

```typescript
export function normalisePlate(plate: string): string {
  return plate.replace(/\s/g, '').toUpperCase();
}
```

- [ ] **Step 4: Run tests to confirm they pass**

```bash
npx ng test --include='**/normalise-plate.spec.ts' --watch=false
```

Expected: `4 specs, 0 failures`

- [ ] **Step 5: Add `getByPlate()` to `PlateListingService`**

In `src/app/services/plate-listing.service.ts`, add the import and the method.

Add to the imports at the top:
```typescript
import { normalisePlate } from '../utils/normalise-plate';
```

Add this method inside the `PlateListingService` class (after `updateListing`):
```typescript
getByPlate(plateChars: string): Observable<PlateListing | null> {
  const normalised = normalisePlate(plateChars);
  return this.getAll().pipe(
    map(listings =>
      listings.find(l => normalisePlate(l.plateCharacters) === normalised) ?? null
    )
  );
}
```

- [ ] **Step 6: Verify the app compiles**

```bash
npx ng build --configuration development 2>&1 | tail -5
```

Expected: `Build at:` line with no errors.

- [ ] **Step 7: Commit**

```bash
git add src/app/utils/normalise-plate.ts src/app/utils/normalise-plate.spec.ts src/app/services/plate-listing.service.ts
git commit -m "feat: add normalisePlate utility and getByPlate service method"
```

---

## Task 2: `PlateDetailComponent` + route registration

**Files:**
- Create: `src/app/core/plate-detail/plate-detail.component.ts`
- Create: `src/app/core/plate-detail/plate-detail.component.html`
- Create: `src/app/core/plate-detail/plate-detail.component.scss`
- Create: `src/app/core/plate-detail/plate-detail.component.spec.ts`
- Modify: `src/app/app.routes.ts`

**Interfaces:**
- Consumes: `normalisePlate` from `src/app/utils/normalise-plate.ts`
- Consumes: `PlateListingService.getByPlate(plateChars: string): Observable<PlateListing | null>`
- Consumes: `MessageSellerDialogComponent`, `AuthPromptDialogComponent` (same pattern as `PlatesForSaleComponent`)

- [ ] **Step 1: Write the failing component tests**

Create `src/app/core/plate-detail/plate-detail.component.spec.ts`:

```typescript
import { TestBed } from '@angular/core/testing';
import { PlateDetailComponent } from './plate-detail.component';
import { ActivatedRoute, ParamMap } from '@angular/router';
import { PlateListingService } from '../../services/plate-listing.service';
import { AuthService } from '../../services/auth.service';
import { MatDialog } from '@angular/material/dialog';
import { MatSnackBar } from '@angular/material/snack-bar';
import { Title } from '@angular/platform-browser';
import { of, Subject } from 'rxjs';
import { PlateListing } from '../../models/plate-listing.model';

function fakeParamMap(plate: string): ParamMap {
  return { get: (key: string) => (key === 'plate' ? plate : null) } as ParamMap;
}

describe('PlateDetailComponent', () => {
  let mockPlateService: jasmine.SpyObj<PlateListingService>;
  let paramMapSubject: Subject<ParamMap>;

  beforeEach(async () => {
    paramMapSubject = new Subject<ParamMap>();
    mockPlateService = jasmine.createSpyObj('PlateListingService', ['getByPlate']);
    mockPlateService.getByPlate.and.returnValue(of(null));

    await TestBed.configureTestingModule({
      imports: [PlateDetailComponent],
      providers: [
        { provide: ActivatedRoute, useValue: { paramMap: paramMapSubject.asObservable() } },
        { provide: PlateListingService, useValue: mockPlateService },
        { provide: AuthService, useValue: { currentUser$: of(null) } },
        { provide: MatDialog, useValue: { open: jasmine.createSpy() } },
        { provide: MatSnackBar, useValue: { open: jasmine.createSpy() } },
      ],
    }).compileComponents();
  });

  it('calls getByPlate with the route param', () => {
    TestBed.createComponent(PlateDetailComponent);
    paramMapSubject.next(fakeParamMap('AB12XYZ'));
    expect(mockPlateService.getByPlate).toHaveBeenCalledWith('AB12XYZ');
  });

  it('sets page title when listing is found', () => {
    const titleService = TestBed.inject(Title);
    spyOn(titleService, 'setTitle');
    const listing: Partial<PlateListing> = {
      plateCharacters: 'AB12 XYZ',
      askingPrice: '5000',
      meanings: 'Great plate',
      isSold: false,
    };
    mockPlateService.getByPlate.and.returnValue(of(listing as PlateListing));

    TestBed.createComponent(PlateDetailComponent);
    paramMapSubject.next(fakeParamMap('AB12XYZ'));

    expect(titleService.setTitle).toHaveBeenCalledWith('AB12XYZ Number Plate For Sale | MR Valuations');
  });

  it('resets page title on destroy', () => {
    const titleService = TestBed.inject(Title);
    spyOn(titleService, 'setTitle');
    const fixture = TestBed.createComponent(PlateDetailComponent);
    fixture.destroy();
    expect(titleService.setTitle).toHaveBeenCalledWith(
      'FREE Instant Number Plate Valuation | UKs 1st Automated Tool'
    );
  });
});
```

- [ ] **Step 2: Run tests to confirm they fail**

```bash
npx ng test --include='**/plate-detail.component.spec.ts' --watch=false
```

Expected: `Cannot find module './plate-detail.component'`

- [ ] **Step 3: Create the component TypeScript**

Create `src/app/core/plate-detail/plate-detail.component.ts`:

```typescript
import { Component, OnDestroy, inject } from '@angular/core';
import { AsyncPipe, DatePipe, UpperCasePipe, DOCUMENT } from '@angular/common';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { Title, Meta } from '@angular/platform-browser';
import { Observable, startWith, switchMap, map, tap, take } from 'rxjs';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatDialog, MatDialogModule } from '@angular/material/dialog';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { PlateListingService } from '../../services/plate-listing.service';
import { AuthService } from '../../services/auth.service';
import { MessageSellerDialogComponent } from '../../shared/message-seller-dialog/message-seller-dialog.component';
import { AuthPromptDialogComponent } from '../../shared/auth-prompt-dialog/auth-prompt-dialog.component';
import { PlateListing } from '../../models/plate-listing.model';
import { normalisePlate } from '../../utils/normalise-plate';

type ListingState =
  | { status: 'loading' }
  | { status: 'found'; listing: PlateListing }
  | { status: 'not-found' };

@Component({
  selector: 'app-plate-detail',
  standalone: true,
  imports: [
    AsyncPipe, DatePipe, UpperCasePipe, RouterLink,
    MatButtonModule, MatIconModule, MatDialogModule, MatSnackBarModule,
  ],
  templateUrl: './plate-detail.component.html',
  styleUrl: './plate-detail.component.scss',
})
export class PlateDetailComponent implements OnDestroy {
  private route = inject(ActivatedRoute);
  private plateListingService = inject(PlateListingService);
  private titleService = inject(Title);
  private metaService = inject(Meta);
  private document = inject(DOCUMENT);
  private dialog = inject(MatDialog);
  private authService = inject(AuthService);
  private snackBar = inject(MatSnackBar);

  private canonicalLink: HTMLLinkElement | null = null;
  private jsonLdScript: HTMLScriptElement | null = null;

  listingState$: Observable<ListingState> = this.route.paramMap.pipe(
    switchMap(params => {
      const plate = params.get('plate') ?? '';
      return this.plateListingService.getByPlate(plate).pipe(
        tap(listing => { if (listing) this.setSeoTags(listing); }),
        map(listing =>
          listing
            ? ({ status: 'found' as const, listing })
            : ({ status: 'not-found' as const })
        ),
        startWith({ status: 'loading' as const })
      );
    })
  );

  private setSeoTags(listing: PlateListing): void {
    const plate = normalisePlate(listing.plateCharacters);
    const title = `${plate} Number Plate For Sale | MR Valuations`;
    const desc = `${plate} private number plate for sale at £${listing.askingPrice}${listing.meanings ? '. ' + listing.meanings : ''}. Contact the seller directly on MR Valuations.`;

    this.titleService.setTitle(title);
    this.metaService.updateTag({ name: 'description', content: desc });

    this.canonicalLink?.remove();
    const link = this.document.createElement('link');
    link.setAttribute('rel', 'canonical');
    link.setAttribute('href', `https://mrvaluations.co.uk/plates-for-sale/${plate}`);
    this.document.head.appendChild(link);
    this.canonicalLink = link;

    this.jsonLdScript?.remove();
    const script = this.document.createElement('script');
    script.type = 'application/ld+json';
    script.text = JSON.stringify({
      '@context': 'https://schema.org',
      '@type': 'Product',
      name: `${plate} Number Plate`,
      description: desc,
      offers: {
        '@type': 'Offer',
        price: listing.askingPrice,
        priceCurrency: 'GBP',
        availability: 'https://schema.org/InStock',
      },
    });
    this.document.head.appendChild(script);
    this.jsonLdScript = script;
  }

  ngOnDestroy(): void {
    this.titleService.setTitle('FREE Instant Number Plate Valuation | UKs 1st Automated Tool');
    this.metaService.removeTag('name="description"');
    this.canonicalLink?.remove();
    this.jsonLdScript?.remove();
  }

  onMessageSeller(listing: PlateListing): void {
    this.authService.currentUser$.pipe(take(1)).subscribe(user => {
      if (!user) {
        this.dialog.open(AuthPromptDialogComponent, { width: '380px' });
      } else {
        this.dialog.open(MessageSellerDialogComponent, { width: '520px', data: listing });
      }
    });
  }

  onCopyLink(): void {
    navigator.clipboard.writeText(window.location.href);
    this.snackBar.open('Link copied to clipboard!', 'Close', { duration: 3000 });
  }
}
```

- [ ] **Step 4: Create the component template**

Create `src/app/core/plate-detail/plate-detail.component.html`:

```html
@if (listingState$ | async; as state) {
  @if (state.status === 'loading') {
    <div class="loading">
      <p class="text-muted">Loading...</p>
    </div>
  } @else if (state.status === 'found') {
    <div class="plate-detail">
      <div class="detail-breadcrumb">
        <a routerLink="/plates-for-sale">← Back to all plates</a>
      </div>
      <div class="detail-card">
        <div class="plate-css">
          <span class="bevel-plate">{{ state.listing.plateCharacters | uppercase }}</span>
        </div>
        <span class="listing-price">£{{ state.listing.askingPrice }}</span>
        @if (state.listing.meanings) {
          <div class="listing-meanings">
            <span class="listing-meanings-label">Meaning</span>
            <span class="listing-meanings-text">{{ state.listing.meanings }}</span>
          </div>
        }
        @if (state.listing.plateType) {
          <div class="plate-meta-row">
            <span>{{ state.listing.plateType }}</span>
            @if (state.listing.plateCategory) {
              <span> · {{ state.listing.plateCategory }}</span>
            }
          </div>
        }
        <div class="listed-date">Listed {{ state.listing.createdDate | date:'d MMMM y' }}</div>
        <hr class="listing-divider">
        <div class="card-actions">
          <button mat-raised-button class="message-seller-btn" (click)="onMessageSeller(state.listing)">
            Message Seller
          </button>
          <button mat-stroked-button (click)="onCopyLink()">
            <mat-icon>link</mat-icon>
            Copy link
          </button>
        </div>
      </div>
    </div>
  } @else {
    <div class="not-found">
      <h2>Listing not found</h2>
      <p>This plate may have been sold or removed.</p>
      <a routerLink="/plates-for-sale">← Back to all plates</a>
    </div>
  }
}
```

- [ ] **Step 5: Create the component styles**

Create `src/app/core/plate-detail/plate-detail.component.scss`:

```scss
@use '../../../styles/variables' as *;

.plate-detail {
  padding: 1.5rem;
  max-width: 480px;
  margin: 0 auto;
}

.detail-breadcrumb {
  margin-bottom: 1.5rem;

  a {
    color: #1565c0;
    text-decoration: none;
    font-size: 0.9rem;

    &:hover { text-decoration: underline; }
  }
}

.detail-card {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.75rem;
  background: white;
  border-radius: 20px;
  box-shadow: 0px 0px 16px 4px rgba(0, 0, 0, 0.2);
  padding: 2rem 1.5rem 1.5rem;
}

.plate-css {
  height: 60px;
  border-radius: 5px;
  background-color: #ff0;
  color: #000;
  font-size: 0.8rem;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 0 20px;
  box-shadow: 0px 2px 4px -1px rgba(0, 0, 0, 0.2), 0px 4px 5px 0px rgba(0, 0, 0, 0.14), 0px 1px 10px 0px rgba(0, 0, 0, 0.12);

  .bevel-plate {
    font-size: 3em;
  }
}

.listing-price {
  @include cabin-font;
  font-size: 1rem;
  color: white;
  font-weight: 700;
  background-color: #ff4081;
  border-radius: 999px;
  padding: 4px 14px;
}

.listing-meanings {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.15rem;
  text-align: center;
}

.listing-meanings-label {
  font-size: 0.7rem;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.5px;
}

.listing-meanings-text {
  font-size: 0.85rem;
  color: #333;
  line-height: 1.4;
}

.plate-meta-row {
  font-size: 0.8rem;
  color: #666;
}

.listed-date {
  font-size: 0.8rem;
  color: #888;
}

.listing-divider {
  width: 100%;
  margin: 0.5rem 0 0.25rem;
  border: none;
  border-top: 1px solid #e0e0e0;
}

.card-actions {
  display: flex;
  align-items: center;
  gap: 0.75rem;
}

.message-seller-btn {
  border-radius: 4px !important;
  background-color: #1565c0 !important;
  color: white !important;
}

.loading,
.not-found {
  padding: 3rem 1.5rem;
  text-align: center;

  a {
    color: #1565c0;
    text-decoration: none;

    &:hover { text-decoration: underline; }
  }
}
```

- [ ] **Step 6: Register the route in `app.routes.ts`**

In `src/app/app.routes.ts`, add the import and route:

Add to imports:
```typescript
import { PlateDetailComponent } from './core/plate-detail/plate-detail.component';
```

Add to the `routes` array after the `plates-for-sale` route (line 26):
```typescript
{ path: 'plates-for-sale/:plate', component: PlateDetailComponent },
```

- [ ] **Step 7: Run the tests to confirm they pass**

```bash
npx ng test --include='**/plate-detail.component.spec.ts' --watch=false
```

Expected: `3 specs, 0 failures`

- [ ] **Step 8: Commit**

```bash
git add src/app/core/plate-detail/ src/app/app.routes.ts
git commit -m "feat: add PlateDetailComponent with SEO meta tags and route"
```

---

## Task 3: `open_in_new` icon button on listing cards

**Files:**
- Modify: `src/app/core/plates-for-sale/plates-for-sale.component.ts`
- Modify: `src/app/core/plates-for-sale/plates-for-sale.component.html`
- Modify: `src/app/core/plates-for-sale/plates-for-sale.component.scss`

**Interfaces:**
- Consumes: `normalisePlate` from `src/app/utils/normalise-plate.ts`
- Consumes: `/plates-for-sale/:plate` route registered in Task 2

- [ ] **Step 1: Add `RouterLink`, `normalisePlate` to the component**

In `src/app/core/plates-for-sale/plates-for-sale.component.ts`:

Add `RouterLink` to the imports array (line 4 area):
```typescript
import { RouterLink } from '@angular/router';
```

Add `normalisePlate` import:
```typescript
import { normalisePlate } from '../../utils/normalise-plate';
```

Add `RouterLink` to the component `imports` array (the decorator array, currently line 31). Add it alongside the existing imports:
```typescript
imports: [MatCardModule, MatIconModule, MatTabsModule, MatButtonModule, MatBadgeModule, BenefitCardComponent, ShareButtonsComponent, RecentlySoldComponent, ScrollingModule, UpperCasePipe, DatePipe, DecimalPipe, MatFormFieldModule, MatInputModule, FormsModule, MatDialogModule, ListNowBannerComponent, TrackClickDirective, RouterLink],
```

Add a class property that exposes the utility function to the template (add it just before the `constructor`):
```typescript
protected readonly normalisePlate = normalisePlate;
```

- [ ] **Step 2: Add the icon button to the listing card template**

In `src/app/core/plates-for-sale/plates-for-sale.component.html`, replace the existing `<button mat-raised-button class="message-seller-btn" ...>` block (lines 88–94) with a wrapper div containing both the existing button and the new icon button:

Replace:
```html
                        <button mat-raised-button class="message-seller-btn"
                            [matBadge]="listing.viewsPlaceholder"
                            matBadgePosition="above after"
                            matBadgeColor="accent"
                            (click)="onMessageSeller(listing)">
                            Message Seller
                        </button>
```

With:
```html
                        <div class="card-actions-row">
                            <button mat-raised-button class="message-seller-btn"
                                [matBadge]="listing.viewsPlaceholder"
                                matBadgePosition="above after"
                                matBadgeColor="accent"
                                (click)="onMessageSeller(listing)">
                                Message Seller
                            </button>
                            <a mat-icon-button
                               [routerLink]="['/plates-for-sale', normalisePlate(listing.plateCharacters)]"
                               aria-label="View listing page">
                                <mat-icon>open_in_new</mat-icon>
                            </a>
                        </div>
```

- [ ] **Step 3: Add the `card-actions-row` style**

In `src/app/core/plates-for-sale/plates-for-sale.component.scss`, add after the `.message-seller-btn` block:

```scss
.card-actions-row {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  justify-content: center;
  width: 100%;
}
```

- [ ] **Step 4: Verify the app compiles and the button appears**

```bash
npx ng serve --port 1234
```

Open http://localhost:1234/plates-for-sale, go to the Buy tab. Each listing card should show the "Message Seller" button and a small `open_in_new` icon button beside it. Clicking the icon should navigate to `/plates-for-sale/AB12XYZ` and display the detail page. Clicking "Message Seller" should still open the modal as before.

- [ ] **Step 5: Commit**

```bash
git add src/app/core/plates-for-sale/
git commit -m "feat: add open_in_new icon button to listing cards linking to plate detail page"
```

---

## Task 4: Sitemap generation script + build integration

**Files:**
- Create: `scripts/generate-sitemap.mjs`
- Modify: `package.json`

**Interfaces:**
- Consumes: `scripts/service-account.json` (already present, gitignored)
- Consumes: Firestore collections `plate-listings` and `plate-listings-new`
- Produces: overwrites `src/sitemap.xml` with static URLs + one entry per active plate listing

- [ ] **Step 1: Create the sitemap generation script**

Create `scripts/generate-sitemap.mjs`:

```javascript
import { initializeApp, cert } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { writeFileSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';
import { createRequire } from 'module';

const __dirname = dirname(fileURLToPath(import.meta.url));
const require = createRequire(import.meta.url);
const serviceAccount = require('./service-account.json');

const BASE_URL = 'https://mrvaluations.co.uk';

const STATIC_URLS = [
  { loc: `${BASE_URL}/`,                  changefreq: 'weekly',  priority: '1.0' },
  { loc: `${BASE_URL}/plates-for-sale`,   changefreq: 'daily',   priority: '0.9' },
  { loc: `${BASE_URL}/list-plate`,        changefreq: 'monthly', priority: '0.8' },
  { loc: `${BASE_URL}/register`,          changefreq: 'monthly', priority: '0.5' },
  { loc: `${BASE_URL}/login`,             changefreq: 'monthly', priority: '0.4' },
];

function normalisePlate(plate) {
  return plate.replace(/\s/g, '').toUpperCase();
}

function buildXml(urls) {
  const entries = urls.map(u =>
    `  <url>\n    <loc>${u.loc}</loc>\n    <changefreq>${u.changefreq}</changefreq>\n    <priority>${u.priority}</priority>\n  </url>`
  ).join('\n');
  return `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${entries}\n</urlset>`;
}

async function generate() {
  initializeApp({ credential: cert(serviceAccount) });
  const db = getFirestore();

  const [oldSnap, newSnap] = await Promise.all([
    db.collection('plate-listings').where('isSold', '==', false).get(),
    db.collection('plate-listings-new').where('isSold', '==', false).get(),
  ]);

  const plates = [
    ...oldSnap.docs.map(d => d.data().plateCharacters),
    ...newSnap.docs.map(d => d.data().plateCharacters),
  ].filter(Boolean);

  const plateUrls = plates.map(plate => ({
    loc: `${BASE_URL}/plates-for-sale/${normalisePlate(plate)}`,
    changefreq: 'weekly',
    priority: '0.8',
  }));

  const allUrls = [...STATIC_URLS, ...plateUrls];
  const xml = buildXml(allUrls);

  const outPath = resolve(__dirname, '../src/sitemap.xml');
  writeFileSync(outPath, xml, 'utf8');
  console.log(`Sitemap written: ${allUrls.length} URLs (${plateUrls.length} plate listings)`);
}

generate().catch(err => {
  console.error('Sitemap generation failed:', err);
  process.exit(1);
});
```

- [ ] **Step 2: Test the script in isolation**

```bash
node scripts/generate-sitemap.mjs
```

Expected output: `Sitemap written: N URLs (M plate listings)` where M > 0.

Verify `src/sitemap.xml` now contains entries like:
```
<loc>https://mrvaluations.co.uk/plates-for-sale/AB12XYZ</loc>
```

- [ ] **Step 3: Prepend sitemap generation to the build script in `package.json`**

In `package.json`, update the `build:gh-pages` script by prepending `node scripts/generate-sitemap.mjs && `:

```json
"build:gh-pages": "node scripts/generate-sitemap.mjs && rm -rf docs && ng build --configuration production --output-path docs --base-href \"/\" --no-ssr && cp -a docs/browser/. docs/ && rm -rf docs/browser && echo 'mrvaluations.co.uk' > docs/CNAME && cp docs/index.html docs/404.html",
```

- [ ] **Step 4: Run the full build to confirm the pipeline works end to end**

```bash
npm run build:gh-pages 2>&1 | tail -10
```

Expected: sitemap generation log line followed by a successful Angular build. Verify `docs/sitemap.xml` contains plate listing URLs.

- [ ] **Step 5: Commit**

```bash
git add scripts/generate-sitemap.mjs package.json src/sitemap.xml
git commit -m "feat: add sitemap generation script and wire into build:gh-pages"
```
