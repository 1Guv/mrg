# Seller Notifications & Dashboard Messages — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** When a buyer sends a message, automatically email the seller, increment the plate's view count, and show all received enquiries in the seller's account dashboard Messages tab.

**Architecture:** Extend `SellerEnquiryService.saveEnquiry()` to fire three parallel Firestore writes (enquiry doc, mail doc, view increment); add `getEnquiriesForSeller()` for the dashboard; wire a new Messages tab into `AccountDashboardComponent`; tighten Firestore rules to allow seller reads and view-only updates on plate listings.

**Tech Stack:** Angular 17+ standalone components, Angular Fire (`addDoc`, `updateDoc`, `increment`, `collectionData`, `where`, `serverTimestamp`), RxJS (`switchMap`, `of`, `map`), Angular Material tabs, Jasmine/TestBed.

---

## File Map

| Action | File |
|--------|------|
| Modify | `src/app/services/plate-listing.service.ts` |
| Modify | `src/app/services/seller-enquiry.service.ts` |
| Modify | `src/app/services/seller-enquiry.service.spec.ts` |
| Modify | `src/app/shared/message-seller-dialog/message-seller-dialog.component.ts` |
| Modify | `src/app/core/account-dashboard/account-dashboard.component.ts` |
| Modify | `src/app/core/account-dashboard/account-dashboard.component.html` |
| Modify | `src/app/core/account-dashboard/account-dashboard.component.scss` |
| Modify | `firestore.rules` |

---

## Task 1: PlateListingService — add `incrementViews()`

**Files:**
- Modify: `src/app/services/plate-listing.service.ts`

- [ ] **Step 1: Read the current file**

```bash
cat src/app/services/plate-listing.service.ts
```

- [ ] **Step 2: Replace the file with the updated version**

Replace `src/app/services/plate-listing.service.ts` with:

```typescript
import { inject, Injectable } from '@angular/core';
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
  increment
} from '@angular/fire/firestore';
import { Observable } from 'rxjs';
import { PlateListing } from '../models/plate-listing.model';

@Injectable({
  providedIn: 'root'
})
export class PlateListingService {

  private firestore = inject(Firestore);
  private readonly COLLECTION = 'plate-listings';

  getAll(): Observable<PlateListing[]> {
    const ref = collection(this.firestore, this.COLLECTION);
    const q = query(ref, orderBy('createdDate', 'asc'));
    return collectionData(q, { idField: 'id' }) as Observable<PlateListing[]>;
  }

  getSold(): Observable<PlateListing[]> {
    const ref = collection(this.firestore, this.COLLECTION);
    const q = query(ref, where('isSold', '==', true));
    return collectionData(q, { idField: 'id' }) as Observable<PlateListing[]>;
  }

  async getById(id: string): Promise<PlateListing | null> {
    const ref = doc(this.firestore, `${this.COLLECTION}/${id}`);
    const snap = await getDoc(ref);
    return snap.exists() ? ({ id: snap.id, ...snap.data() } as unknown as PlateListing) : null;
  }

  incrementViews(plateId: string): Promise<void> {
    const ref = doc(this.firestore, `${this.COLLECTION}/${plateId}`);
    return updateDoc(ref, { viewsPlaceholder: increment(1) }).then(() => {});
  }
}
```

- [ ] **Step 3: Verify the build compiles**

```bash
cd /Users/gurvindersinghsandhu/Documents/development/guv/projects/mrg-app-v1
ng build --configuration development 2>&1 | tail -10
```

Expected: Build succeeds with no errors.

- [ ] **Step 4: Commit**

```bash
git add src/app/services/plate-listing.service.ts
git commit -m "feat: add incrementViews() to PlateListingService"
```

---

## Task 2: SellerEnquiryService — extend saveEnquiry() and add getEnquiriesForSeller()

**Files:**
- Modify: `src/app/services/seller-enquiry.service.ts`
- Modify: `src/app/services/seller-enquiry.service.spec.ts`

- [ ] **Step 1: Update the spec file**

Replace `src/app/services/seller-enquiry.service.spec.ts` with:

```typescript
import { TestBed } from '@angular/core/testing';
import { SellerEnquiryService } from './seller-enquiry.service';
import { Firestore } from '@angular/fire/firestore';
import { PlateListingService } from './plate-listing.service';

describe('SellerEnquiryService', () => {
  let service: SellerEnquiryService;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        SellerEnquiryService,
        { provide: Firestore, useValue: {} },
        { provide: PlateListingService, useValue: { incrementViews: () => Promise.resolve() } }
      ]
    });
    service = TestBed.inject(SellerEnquiryService);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });
});
```

- [ ] **Step 2: Run the test to confirm it still passes**

```bash
ng test --include="**/seller-enquiry.service.spec.ts" --watch=false 2>&1 | tail -10
```

Expected: 1 spec, 0 failures.

- [ ] **Step 3: Replace the service implementation**

Replace `src/app/services/seller-enquiry.service.ts` with:

```typescript
import { inject, Injectable } from '@angular/core';
import {
  Firestore,
  collection,
  collectionData,
  addDoc,
  query,
  where,
  serverTimestamp
} from '@angular/fire/firestore';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import { PlateListing } from '../models/plate-listing.model';
import { PlateListingService } from './plate-listing.service';

export interface SellerEnquiry {
  id?: string;
  plateId: number;
  plateCharacters: string;
  enquiryType: string;
  message: string;
  buyerUid: string;
  buyerEmail: string;
  sellerLCNumber: string;
  sellerEmail: string;
  submittedAt?: any;
}

@Injectable({ providedIn: 'root' })
export class SellerEnquiryService {
  private firestore = inject(Firestore);
  private plateListingService = inject(PlateListingService);

  async saveEnquiry(
    listing: PlateListing,
    enquiryType: string,
    message: string,
    buyerUid: string,
    buyerEmail: string
  ): Promise<void> {
    const enquiriesRef = collection(this.firestore, 'seller_enquiries');
    const mailRef = collection(this.firestore, 'mail');

    await Promise.all([
      addDoc(enquiriesRef, {
        plateId: listing.id,
        plateCharacters: listing.plateCharacters,
        enquiryType,
        message,
        buyerUid,
        buyerEmail,
        sellerLCNumber: listing.lCNumber,
        sellerEmail: listing.lCEmail,
        submittedAt: serverTimestamp()
      }),
      addDoc(mailRef, {
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
      }),
      this.plateListingService.incrementViews(String(listing.id))
    ]);
  }

  getEnquiriesForSeller(email: string): Observable<SellerEnquiry[]> {
    const ref = collection(this.firestore, 'seller_enquiries');
    const q = query(ref, where('sellerEmail', '==', email));
    return (collectionData(q, { idField: 'id' }) as Observable<SellerEnquiry[]>).pipe(
      map(enquiries => [...enquiries].sort((a, b) => {
        const aTime = a.submittedAt?.toMillis?.() ?? 0;
        const bTime = b.submittedAt?.toMillis?.() ?? 0;
        return bTime - aTime;
      }))
    );
  }
}
```

- [ ] **Step 4: Run the test to confirm it still passes**

```bash
ng test --include="**/seller-enquiry.service.spec.ts" --watch=false 2>&1 | tail -10
```

Expected: 1 spec, 0 failures.

- [ ] **Step 5: Commit**

```bash
git add src/app/services/seller-enquiry.service.ts src/app/services/seller-enquiry.service.spec.ts
git commit -m "feat: extend SellerEnquiryService with email notification, view increment, and seller query"
```

---

## Task 3: MessageSellerDialogComponent — update onSubmit() call

**Files:**
- Modify: `src/app/shared/message-seller-dialog/message-seller-dialog.component.ts`

- [ ] **Step 1: Read the current file**

```bash
cat src/app/shared/message-seller-dialog/message-seller-dialog.component.ts
```

- [ ] **Step 2: Replace onSubmit() with updated call signature**

Replace the entire `onSubmit()` method. The new signature passes individual args instead of a flat object:

```typescript
async onSubmit(): Promise<void> {
  if (this.form.invalid) return;
  this.loading = true;
  this.errorMessage = '';

  this.authService.currentUser$.pipe(take(1)).subscribe(async (user: User | null) => {
    try {
      await this.enquiryService.saveEnquiry(
        this.listing,
        this.form.value.enquiryType,
        this.form.value.message,
        user!.uid,
        user!.email ?? ''
      );
      this.submitted = true;
    } catch {
      this.errorMessage = 'Something went wrong. Please try again.';
    } finally {
      this.loading = false;
    }
  });
}
```

- [ ] **Step 3: Verify the build compiles**

```bash
ng build --configuration development 2>&1 | tail -10
```

Expected: Build succeeds with no errors.

- [ ] **Step 4: Commit**

```bash
git add src/app/shared/message-seller-dialog/message-seller-dialog.component.ts
git commit -m "feat: update MessageSellerDialog to use new saveEnquiry() signature"
```

---

## Task 4: AccountDashboardComponent — add Messages tab

**Files:**
- Modify: `src/app/core/account-dashboard/account-dashboard.component.ts`
- Modify: `src/app/core/account-dashboard/account-dashboard.component.html`
- Modify: `src/app/core/account-dashboard/account-dashboard.component.scss`

- [ ] **Step 1: Read the current TypeScript file**

```bash
cat src/app/core/account-dashboard/account-dashboard.component.ts
```

- [ ] **Step 2: Replace the TypeScript file**

Replace `src/app/core/account-dashboard/account-dashboard.component.ts` with:

```typescript
import { Component, OnDestroy, OnInit, effect, inject, signal } from '@angular/core';
import { CommonModule, DatePipe, UpperCasePipe } from '@angular/common';
import { MatButtonModule } from '@angular/material/button';
import { MatTabsModule } from '@angular/material/tabs';
import { Router, RouterModule } from '@angular/router';
import { AuthService } from '../../services/auth.service';
import { map, of, Subscription, switchMap } from 'rxjs';
import { UserAccountDetailsComponent } from '../user-account-details/user-account-details.component';
import { ValuationService } from '../../services/valuation.service';
import { NumberPlateType, RegValuation } from '../../models/reg.model';
import { AccountDashboardValuationComponent } from '../account-dashboard-valuation/account-dashboard-valuation.component';
import { NumberPlateFormService } from '../../services/number-plate-form.service';
import { AdminComponent } from '../admin/admin.component';
import { AdminService, AutoValuation, PlateSearch, PlateValuationMessage, UserProfile, ValuationFeedback } from '../../services/admin.service';
import { AdminsService } from '../../services/admins.service';
import { MeComponent } from '../me/me.component';
import { SellerEnquiryService, SellerEnquiry } from '../../services/seller-enquiry.service';

@Component({
  selector: 'app-account-dashboard',
  standalone: true,
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
    MeComponent
  ],
  templateUrl: './account-dashboard.component.html',
  styleUrl: './account-dashboard.component.scss'
})
export class AccountDashboardComponent implements OnInit, OnDestroy {

  currentUser$ = signal({});
  subs = new Subscription();

  private valuationService = inject(ValuationService);
  private adminService = inject(AdminService);
  private adminsService = inject(AdminsService);
  private numberPlateFormService = inject(NumberPlateFormService);
  private sellerEnquiryService = inject(SellerEnquiryService);

  valuations$ = signal<RegValuation[]>([]);
  plateSearches$ = signal<PlateSearch[]>([]);
  autoValuations$ = signal<AutoValuation[]>([]);
  users$ = signal<UserProfile[]>([]);
  feedback$ = signal<ValuationFeedback[]>([]);
  plateMessages$ = signal<PlateValuationMessage[]>([]);
  sellerEnquiries$ = signal<SellerEnquiry[]>([]);

  private hasLoadedUsers = false;

  constructor(
    private router: Router,
    private authService: AuthService
  ) {
    effect(() => {
      const uid = (this.currentUser$() as any)?.uid;
      if (uid && this.adminsService.isAdmin(uid) && !this.hasLoadedUsers) {
        this.hasLoadedUsers = true;
        this.subs.add(
          this.adminService.getAuthUsers().subscribe((users) => this.users$.set(users))
        );
      }
    });
  }

  ngOnInit() {
    this.numberPlateFormService.triggerReset();

    this.subs.add(
      this.authService.currentUser$
        .pipe(map((user: any) => this.currentUser$.set(user)))
        .subscribe()
    );

    this.subs.add(
      this.valuationService
        .getValuations()
        .pipe(map((valuations: RegValuation[]) => this.valuations$.set([...valuations].reverse())))
        .subscribe()
    );

    this.subs.add(
      this.adminService
        .getPlateSearches()
        .subscribe((searches) => this.plateSearches$.set(searches))
    );

    this.subs.add(
      this.adminService
        .getAutoValuations()
        .subscribe((valuations) => this.autoValuations$.set(valuations))
    );

    this.subs.add(
      this.adminService
        .getFeedback()
        .subscribe((feedback) => this.feedback$.set(feedback))
    );

    this.subs.add(
      this.adminService
        .getPlateValuationMessages()
        .subscribe((messages) => this.plateMessages$.set(messages))
    );

    this.subs.add(
      this.authService.currentUser$.pipe(
        switchMap(user => (user as any)?.email
          ? this.sellerEnquiryService.getEnquiriesForSeller((user as any).email)
          : of([])
        )
      ).subscribe(enquiries => this.sellerEnquiries$.set(enquiries))
    );
  }

  get currentValuations(): RegValuation[] {
    return this.valuations$().filter(v => v.type === NumberPlateType.Current);
  }

  get prefixValuations(): RegValuation[] {
    return this.valuations$().filter(v => v.type === NumberPlateType.Prefix);
  }

  get suffixValuations(): RegValuation[] {
    return this.valuations$().filter(v => v.type === NumberPlateType.Suffix);
  }

  get datelessValuations(): RegValuation[] {
    return this.valuations$().filter(v => v.type === NumberPlateType.Dateless);
  }

  get isAdmin(): boolean {
    return this.adminsService.isAdmin((this.currentUser$() as any)?.uid);
  }

  async signOut(): Promise<void> {
    await this.authService.logout();
    await this.router.navigateByUrl('/login');
  }

  ngOnDestroy(): void {
    this.subs.unsubscribe();
  }
}
```

- [ ] **Step 3: Read the current HTML file**

```bash
cat src/app/core/account-dashboard/account-dashboard.component.html
```

- [ ] **Step 4: Replace the HTML file**

Replace `src/app/core/account-dashboard/account-dashboard.component.html` with:

```html
@if( currentUser$() ){
    <div class="container-fluid container-color">
        <div class="py-5">
            <h1 class="h1-admin-title text-center">Account Dashboard</h1>

            <mat-tab-group animationDuration="200ms" class="dashboard-tabs">

                @if(isAdmin) {
                <mat-tab label="Me">
                    <div class="tab-content">
                        <app-me
                            [currentUser]="currentUser$()"
                            [searches]="plateSearches$()"
                            [autoValuations]="autoValuations$()"
                            [feedback]="feedback$()"
                            [plateMessages]="plateMessages$()">
                        </app-me>
                    </div>
                </mat-tab>
                }

                @if(isAdmin) {
                <mat-tab [label]="'Plate Searches (' + plateSearches$().length + ')'">
                    <div class="tab-content">
                        <app-admin [currentUser]="currentUser$()" [searches]="plateSearches$()" [autoValuations]="autoValuations$()" [users]="users$()" [feedback]="feedback$()" [plateMessages]="plateMessages$()"></app-admin>
                    </div>
                </mat-tab>
                }

                <mat-tab label="User Details">
                    <div class="tab-content">
                        <app-user-account-details [currentUser]="currentUser$()"></app-user-account-details>
                    </div>
                </mat-tab>

                <mat-tab [label]="'Saved Valuations (' + valuations$().length + ')'">
                    <div class="tab-content">
                        @if (valuations$().length === 0) {
                            <p class="text-muted mt-3 text-center">No saved valuations yet.</p>
                        } @else {
                            <mat-tab-group animationDuration="200ms">

                                <mat-tab [label]="'Current (' + currentValuations.length + ')'">
                                    @for (valuation of currentValuations; track valuation.id) {
                                        <app-account-dashboard-valuation [valuation]="valuation"></app-account-dashboard-valuation>
                                    } @empty {
                                        <p class="text-muted mt-3 text-center">No current plate valuations saved.</p>
                                    }
                                </mat-tab>

                                <mat-tab [label]="'Prefix (' + prefixValuations.length + ')'">
                                    @for (valuation of prefixValuations; track valuation.id) {
                                        <app-account-dashboard-valuation [valuation]="valuation"></app-account-dashboard-valuation>
                                    } @empty {
                                        <p class="text-muted mt-3 text-center">No prefix plate valuations saved.</p>
                                    }
                                </mat-tab>

                                <mat-tab [label]="'Suffix (' + suffixValuations.length + ')'">
                                    @for (valuation of suffixValuations; track valuation.id) {
                                        <app-account-dashboard-valuation [valuation]="valuation"></app-account-dashboard-valuation>
                                    } @empty {
                                        <p class="text-muted mt-3 text-center">No suffix plate valuations saved.</p>
                                    }
                                </mat-tab>

                                <mat-tab [label]="'Dateless (' + datelessValuations.length + ')'">
                                    @for (valuation of datelessValuations; track valuation.id) {
                                        <app-account-dashboard-valuation [valuation]="valuation"></app-account-dashboard-valuation>
                                    } @empty {
                                        <p class="text-muted mt-3 text-center">No dateless plate valuations saved.</p>
                                    }
                                </mat-tab>

                            </mat-tab-group>
                        }
                    </div>
                </mat-tab>

                <mat-tab [label]="'Messages (' + sellerEnquiries$().length + ')'">
                    <div class="tab-content">
                        @if (sellerEnquiries$().length === 0) {
                            <p class="text-muted mt-3 text-center">
                                No messages yet. When someone enquires about your plate, it will appear here.
                            </p>
                        } @else {
                            @for (enquiry of sellerEnquiries$(); track enquiry.id) {
                                <div class="enquiry-card">
                                    <div class="enquiry-plate-row">
                                        <span class="bevel-plate enquiry-plate">{{ enquiry.plateCharacters | uppercase }}</span>
                                        <span class="enquiry-date">{{ enquiry.submittedAt?.toDate() | date:'d MMM y, HH:mm' }}</span>
                                    </div>
                                    <p class="enquiry-type">{{ enquiry.enquiryType }}</p>
                                    <p class="enquiry-message">{{ enquiry.message }}</p>
                                    <p class="enquiry-from">From: {{ enquiry.buyerEmail }}</p>
                                </div>
                            }
                        }
                    </div>
                </mat-tab>

            </mat-tab-group>

            <button type="button" class="my-3 mx-auto d-block" color="accent" mat-raised-button [disabled]="!currentUser$()" (click)="signOut()">Sign Out</button>

        </div>
    </div>
}
```

- [ ] **Step 5: Add enquiry card styles to SCSS**

Append to `src/app/core/account-dashboard/account-dashboard.component.scss`:

```scss
.enquiry-card {
  background: white;
  border: 1px solid #e0e0e0;
  border-radius: 10px;
  padding: 1rem 1.25rem;
  margin-bottom: 1rem;
  display: flex;
  flex-direction: column;
  gap: 0.4rem;
}

.enquiry-plate-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 0.25rem;
}

.enquiry-plate {
  font-size: 1.4rem;
  background-color: #fff9c4;
  border-radius: 4px;
  padding: 2px 10px;
}

.enquiry-date {
  font-size: 0.75rem;
  color: #888;
}

.enquiry-type {
  font-size: 0.8rem;
  font-weight: 700;
  color: #1565c0;
  margin: 0;
  text-transform: uppercase;
  letter-spacing: 0.3px;
}

.enquiry-message {
  font-size: 0.9rem;
  color: #333;
  margin: 0;
  line-height: 1.5;
}

.enquiry-from {
  font-size: 0.78rem;
  color: #666;
  margin: 0;
}
```

- [ ] **Step 6: Verify the build compiles**

```bash
ng build --configuration development 2>&1 | tail -10
```

Expected: Build succeeds with no errors.

- [ ] **Step 7: Commit**

```bash
git add src/app/core/account-dashboard/account-dashboard.component.ts
git add src/app/core/account-dashboard/account-dashboard.component.html
git add src/app/core/account-dashboard/account-dashboard.component.scss
git commit -m "feat: add Messages tab to account dashboard showing seller enquiries"
```

---

## Task 5: Firestore Rules

**Files:**
- Modify: `firestore.rules`

- [ ] **Step 1: Replace firestore.rules**

Replace `firestore.rules` with:

```
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {

    // Valuations — authenticated users can read/write their own
    match /valuations/{docId} {
      allow read, write: if request.auth != null && request.auth.uid == resource.data.userId;
    }

    // Auto valuations — write only (no auth required), no read from client
    match /auto_valuations/{docId} {
      allow create: if true;
      allow read, update, delete: if false;
    }

    // Plate searches — write only (no auth required)
    match /plate_searches/{docId} {
      allow create: if true;
      allow read, update, delete: if false;
    }

    // Valuation feedback — write only
    match /valuation_feedback/{docId} {
      allow create: if true;
      allow read, update, delete: if false;
    }

    // Plate valuation message feedback — write only
    match /plate_valuation_message_feedback/{docId} {
      allow create: if true;
      allow read, update, delete: if false;
    }

    // Feature requests — write only
    match /feature_requests/{docId} {
      allow create: if true;
      allow read, update, delete: if false;
    }

    // Mail — write only (used by Firebase Extension)
    match /mail/{docId} {
      allow create: if true;
      allow read, update, delete: if false;
    }

    // Seller enquiries — authenticated users can create; sellers can read their own
    match /seller_enquiries/{docId} {
      allow create: if request.auth != null;
      allow read: if request.auth != null
        && request.auth.token.email == resource.data.sellerEmail;
      allow update, delete: if false;
    }

    // Plate listings — publicly readable; authenticated users may increment viewsPlaceholder only
    match /plate-listings/{docId} {
      allow read: if true;
      allow update: if request.auth != null
        && request.resource.data.diff(resource.data).affectedKeys().hasOnly(['viewsPlaceholder']);
      allow create, delete: if false;
    }
  }
}
```

- [ ] **Step 2: Commit the rules**

```bash
git add firestore.rules
git commit -m "feat: update Firestore rules — seller enquiry reads + plate view increment"
```

- [ ] **Step 3: Deploy the rules**

```bash
firebase deploy --only firestore:rules
```

Expected: `Deploy complete!`

If you see a permissions error on `firebase-tools.json`, run first:
```bash
sudo chmod 644 ~/.config/configstore/firebase-tools.json
```
