# Me Tab & Firestore Admin Identity Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add an admin-only "Me" tab to the account dashboard showing the admin's own searches, valuation feedback by admins, and plate valuation messages by admins — migrating admin identity from a hardcoded email to a Firestore `admins` collection.

**Architecture:** A new `AdminsService` fetches the `admins` Firestore collection and exposes `adminUids` as a computed signal and an `isAdmin(uid)` helper. A new `MeComponent` receives the already-loaded data from `AccountDashboardComponent` and computes filtered views. `AdminComponent` loses its "My Searches" panel and its hardcoded email check.

**Tech Stack:** Angular 19, Angular Fire (Firestore), Angular Material (mat-card, mat-table, mat-expansion-panel), Angular Signals, Jasmine/Karma

---

## File Map

| Action | Path | Responsibility |
|--------|------|----------------|
| Create | `src/app/services/admins.service.ts` | Fetch `admins` collection, expose `adminUids` signal + `isAdmin()` |
| Create | `src/app/services/admins.service.spec.ts` | Unit tests for AdminsService |
| Create | `src/app/core/me/me.component.ts` | "Me" tab UI — My Searches, admin feedback, admin messages |
| Create | `src/app/core/me/me.component.scss` | Styles (copied from admin.component.scss) |
| Create | `src/app/core/me/me.component.spec.ts` | Unit tests for MeComponent |
| Modify | `src/app/core/admin/admin.component.ts` | Remove My Searches panel; replace hardcoded email check |
| Modify | `src/app/core/account-dashboard/account-dashboard.component.ts` | Inject AdminsService; add MeComponent; update isAdmin; use effect for getAuthUsers |
| Modify | `src/app/core/account-dashboard/account-dashboard.component.html` | Add Me tab first; wire MeComponent inputs |

---

## Task 1: Create AdminsService

**Files:**
- Create: `src/app/services/admins.service.ts`
- Create: `src/app/services/admins.service.spec.ts`

- [ ] **Step 1: Write the failing test**

Create `src/app/services/admins.service.spec.ts`:

```typescript
import { TestBed } from '@angular/core/testing';
import { AdminsService } from './admins.service';
import { Firestore } from '@angular/fire/firestore';
import { of } from 'rxjs';
import * as firestoreModule from '@angular/fire/firestore';

describe('AdminsService', () => {
  let service: AdminsService;

  beforeEach(() => {
    spyOn(firestoreModule, 'collection').and.returnValue({} as any);
    spyOn(firestoreModule, 'collectionData').and.returnValue(
      of([{ uid: 'admin-uid-1', email: 'admin@test.com' }])
    );

    TestBed.configureTestingModule({
      providers: [
        AdminsService,
        { provide: Firestore, useValue: {} }
      ]
    });
    service = TestBed.inject(AdminsService);
  });

  it('isAdmin returns false for undefined', () => {
    expect(service.isAdmin(undefined)).toBeFalse();
  });

  it('isAdmin returns false for unknown uid', () => {
    expect(service.isAdmin('unknown-uid')).toBeFalse();
  });

  it('isAdmin returns true for a uid in the admins collection', () => {
    expect(service.isAdmin('admin-uid-1')).toBeTrue();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
ng test --watch=false --include='**/admins.service.spec.ts'
```

Expected: FAIL — `AdminsService` does not exist yet.

- [ ] **Step 3: Create AdminsService**

Create `src/app/services/admins.service.ts`:

```typescript
import { Injectable, inject, computed } from '@angular/core';
import { Firestore, collection, collectionData } from '@angular/fire/firestore';
import { toSignal } from '@angular/core/rxjs-interop';
import { Observable } from 'rxjs';

export interface Admin {
  uid: string;
  email: string;
}

@Injectable({ providedIn: 'root' })
export class AdminsService {
  private firestore = inject(Firestore);

  private admins = toSignal(
    collectionData(collection(this.firestore, 'admins'), { idField: 'uid' }) as Observable<Admin[]>,
    { initialValue: [] as Admin[] }
  );

  adminUids = computed(() => this.admins().map((a: Admin) => a.uid));

  isAdmin(uid: string | undefined): boolean {
    if (!uid) return false;
    return this.adminUids().includes(uid);
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

```bash
ng test --watch=false --include='**/admins.service.spec.ts'
```

Expected: 3 specs PASS.

- [ ] **Step 5: Commit**

```bash
git add src/app/services/admins.service.ts src/app/services/admins.service.spec.ts
git commit -m "feat: add AdminsService with Firestore-backed admin identity"
```

---

## Task 2: Create MeComponent

**Files:**
- Create: `src/app/core/me/me.component.ts`
- Create: `src/app/core/me/me.component.scss`
- Create: `src/app/core/me/me.component.spec.ts`

- [ ] **Step 1: Write the failing test**

Create `src/app/core/me/me.component.spec.ts`:

```typescript
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { MeComponent } from './me.component';
import { AdminsService } from '../../services/admins.service';
import { computed } from '@angular/core';
import { NoopAnimationsModule } from '@angular/platform-browser/animations';

describe('MeComponent', () => {
  let component: MeComponent;
  let fixture: ComponentFixture<MeComponent>;

  const mockAdminsService = {
    adminUids: computed(() => ['admin-uid'])
  };

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [MeComponent, NoopAnimationsModule],
      providers: [{ provide: AdminsService, useValue: mockAdminsService }]
    }).compileComponents();

    fixture = TestBed.createComponent(MeComponent);
    component = fixture.componentInstance;
  });

  it('mySearches returns only searches belonging to currentUser uid', () => {
    fixture.componentRef.setInput('currentUser', { uid: 'admin-uid' });
    fixture.componentRef.setInput('searches', [
      { userId: 'admin-uid', registration: 'AB12CDE', type: 'current', badge: '', searchedAt: null },
      { userId: 'other-uid', registration: 'XY99ZZZ', type: 'current', badge: '', searchedAt: null }
    ]);
    fixture.detectChanges();
    expect(component.mySearches().length).toBe(1);
    expect(component.mySearches()[0].registration).toBe('AB12CDE');
  });

  it('adminFeedback returns only feedback from admin uids', () => {
    fixture.componentRef.setInput('feedback', [
      { userId: 'admin-uid', registration: 'AB12CDE', valuation: 500, agreed: true, popularityMultiplier: 1, submittedAt: null },
      { userId: 'user-uid', registration: 'XY99ZZZ', valuation: 300, agreed: false, popularityMultiplier: 1, submittedAt: null }
    ]);
    fixture.detectChanges();
    expect(component.adminFeedback().length).toBe(1);
    expect(component.adminFeedback()[0].registration).toBe('AB12CDE');
  });

  it('adminMessages returns only messages from admin uids', () => {
    fixture.componentRef.setInput('plateMessages', [
      { userId: 'admin-uid', registration: 'AB12CDE', valuation: 500, plateMeaning: 'test', message: 'hello', submittedAt: null },
      { userId: 'user-uid', registration: 'XY99ZZZ', valuation: 300, plateMeaning: '', message: 'world', submittedAt: null }
    ]);
    fixture.detectChanges();
    expect(component.adminMessages().length).toBe(1);
    expect(component.adminMessages()[0].registration).toBe('AB12CDE');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
ng test --watch=false --include='**/me.component.spec.ts'
```

Expected: FAIL — `MeComponent` does not exist yet.

- [ ] **Step 3: Create me.component.scss**

Create `src/app/core/me/me.component.scss`:

```scss
.search-count {
  display: inline-block;
  background-color: #003399;
  color: white;
  border-radius: 12px;
  padding: 2px 10px;
  font-size: 14px;
  font-weight: bold;
  vertical-align: middle;
}

table {
  width: 100%;
}

th {
  font-weight: 600;
  color: #003399;
}

.message-cell {
  max-width: 280px;
  white-space: pre-wrap;
  word-break: break-word;
  font-size: 0.85rem;
  padding-top: 8px;
  padding-bottom: 8px;
}
```

- [ ] **Step 4: Create MeComponent**

Create `src/app/core/me/me.component.ts`:

```typescript
import { Component, computed, inject, input } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatCardModule } from '@angular/material/card';
import { MatTableModule } from '@angular/material/table';
import { MatExpansionModule } from '@angular/material/expansion';
import { AutoValuation, PlateSearch, PlateValuationMessage, ValuationFeedback } from '../../services/admin.service';
import { AdminsService } from '../../services/admins.service';

@Component({
  selector: 'app-me',
  standalone: true,
  imports: [CommonModule, MatCardModule, MatTableModule, MatExpansionModule],
  template: `
    <mat-card class="mb-4">
      <mat-card-header>
        <mat-card-title>My Searches</mat-card-title>
      </mat-card-header>
      <mat-card-content>
        @if(mySearches().length === 0){
          <p class="text-muted mt-3">No searches from you yet.</p>
        } @else {
          <mat-accordion class="mt-3">
            <mat-expansion-panel>
              <mat-expansion-panel-header>
                <mat-panel-title>Searches</mat-panel-title>
                <mat-panel-description>
                  <span class="search-count">{{ mySearches().length }}</span>
                </mat-panel-description>
              </mat-expansion-panel-header>
              <table mat-table [dataSource]="mySearches()" class="w-100 mt-2">
                <ng-container matColumnDef="registration">
                  <th mat-header-cell *matHeaderCellDef>Plate</th>
                  <td mat-cell *matCellDef="let s"><strong>{{ s.registration }}</strong></td>
                </ng-container>
                <ng-container matColumnDef="type">
                  <th mat-header-cell *matHeaderCellDef>Type</th>
                  <td mat-cell *matCellDef="let s">{{ s.type }}</td>
                </ng-container>
                <ng-container matColumnDef="badge">
                  <th mat-header-cell *matHeaderCellDef>Badge</th>
                  <td mat-cell *matCellDef="let s">{{ s.badge }}</td>
                </ng-container>
                <ng-container matColumnDef="searchedAt">
                  <th mat-header-cell *matHeaderCellDef>Searched At</th>
                  <td mat-cell *matCellDef="let s">{{ s.searchedAt?.toDate() | date:'dd/MM/yyyy HH:mm' }}</td>
                </ng-container>
                <ng-container matColumnDef="price">
                  <th mat-header-cell *matHeaderCellDef>Valuation</th>
                  <td mat-cell *matCellDef="let s">{{ getPrice(s.registration) }}</td>
                </ng-container>
                <tr mat-header-row *matHeaderRowDef="searchColumns"></tr>
                <tr mat-row *matRowDef="let row; columns: searchColumns;"></tr>
              </table>
            </mat-expansion-panel>
          </mat-accordion>
        }
      </mat-card-content>
    </mat-card>

    <mat-card class="mb-4">
      <mat-card-header>
        <mat-card-title>My Valuation Feedback</mat-card-title>
      </mat-card-header>
      <mat-card-content>
        @if(adminFeedback().length === 0){
          <p class="text-muted mt-3">No feedback submitted by admins yet.</p>
        } @else {
          <mat-accordion class="mt-3">
            <mat-expansion-panel>
              <mat-expansion-panel-header>
                <mat-panel-title>Admin Feedback</mat-panel-title>
                <mat-panel-description>
                  <span class="search-count">{{ adminFeedback().length }}</span>
                </mat-panel-description>
              </mat-expansion-panel-header>
              <table mat-table [dataSource]="adminFeedback()" class="w-100 mt-2">
                <ng-container matColumnDef="registration">
                  <th mat-header-cell *matHeaderCellDef>Plate</th>
                  <td mat-cell *matCellDef="let f"><strong>{{ f.registration }}</strong></td>
                </ng-container>
                <ng-container matColumnDef="valuation">
                  <th mat-header-cell *matHeaderCellDef>Valuation</th>
                  <td mat-cell *matCellDef="let f">{{ formatPrice(f.valuation) }}</td>
                </ng-container>
                <ng-container matColumnDef="agreed">
                  <th mat-header-cell *matHeaderCellDef>Reaction</th>
                  <td mat-cell *matCellDef="let f">{{ f.agreed ? '👍' : '👎' }}</td>
                </ng-container>
                <ng-container matColumnDef="submittedAt">
                  <th mat-header-cell *matHeaderCellDef>Date</th>
                  <td mat-cell *matCellDef="let f">{{ f.submittedAt?.toDate() | date:'dd/MM/yyyy HH:mm' }}</td>
                </ng-container>
                <tr mat-header-row *matHeaderRowDef="feedbackColumns"></tr>
                <tr mat-row *matRowDef="let row; columns: feedbackColumns;"></tr>
              </table>
            </mat-expansion-panel>
          </mat-accordion>
        }
      </mat-card-content>
    </mat-card>

    <mat-card class="mb-4">
      <mat-card-header>
        <mat-card-title>My Plate Valuation Messages</mat-card-title>
      </mat-card-header>
      <mat-card-content>
        @if(adminMessages().length === 0){
          <p class="text-muted mt-3">No messages submitted by admins yet.</p>
        } @else {
          <mat-accordion class="mt-3">
            <mat-expansion-panel>
              <mat-expansion-panel-header>
                <mat-panel-title>Admin Messages</mat-panel-title>
                <mat-panel-description>
                  <span class="search-count">{{ adminMessages().length }}</span>
                </mat-panel-description>
              </mat-expansion-panel-header>
              <table mat-table [dataSource]="adminMessages()" class="w-100 mt-3">
                <ng-container matColumnDef="registration">
                  <th mat-header-cell *matHeaderCellDef>Plate</th>
                  <td mat-cell *matCellDef="let m"><strong>{{ m.registration }}</strong></td>
                </ng-container>
                <ng-container matColumnDef="plateMeaning">
                  <th mat-header-cell *matHeaderCellDef>Meaning</th>
                  <td mat-cell *matCellDef="let m">{{ m.plateMeaning || '—' }}</td>
                </ng-container>
                <ng-container matColumnDef="valuation">
                  <th mat-header-cell *matHeaderCellDef>Valuation</th>
                  <td mat-cell *matCellDef="let m">{{ formatPrice(m.valuation) }}</td>
                </ng-container>
                <ng-container matColumnDef="message">
                  <th mat-header-cell *matHeaderCellDef>Message</th>
                  <td mat-cell *matCellDef="let m" class="message-cell">{{ m.message }}</td>
                </ng-container>
                <ng-container matColumnDef="submittedAt">
                  <th mat-header-cell *matHeaderCellDef>Date</th>
                  <td mat-cell *matCellDef="let m">{{ m.submittedAt?.toDate() | date:'dd/MM/yyyy HH:mm' }}</td>
                </ng-container>
                <tr mat-header-row *matHeaderRowDef="messageColumns"></tr>
                <tr mat-row *matRowDef="let row; columns: messageColumns;"></tr>
              </table>
            </mat-expansion-panel>
          </mat-accordion>
        }
      </mat-card-content>
    </mat-card>
  `,
  styleUrl: './me.component.scss'
})
export class MeComponent {
  currentUser = input<any>();
  searches = input<PlateSearch[]>([]);
  autoValuations = input<AutoValuation[]>([]);
  feedback = input<ValuationFeedback[]>([]);
  plateMessages = input<PlateValuationMessage[]>([]);

  private adminsService = inject(AdminsService);

  mySearches = computed(() =>
    this.searches().filter(s => s.userId === this.currentUser()?.uid)
  );

  adminFeedback = computed(() =>
    this.feedback().filter(f => this.adminsService.adminUids().includes(f.userId ?? ''))
  );

  adminMessages = computed(() =>
    this.plateMessages().filter(m => this.adminsService.adminUids().includes(m.userId ?? ''))
  );

  searchColumns = ['registration', 'type', 'badge', 'searchedAt', 'price'];
  feedbackColumns = ['registration', 'valuation', 'agreed', 'submittedAt'];
  messageColumns = ['registration', 'plateMeaning', 'valuation', 'message', 'submittedAt'];

  getPrice(registration: string): string {
    const match = this.autoValuations().find(
      v => v.registration?.toUpperCase() === registration?.toUpperCase()
    );
    if (!match?.price) return '-';
    return '£' + match.price.toLocaleString('en-GB', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  }

  formatPrice(price: number): string {
    if (!price) return '-';
    return '£' + price.toLocaleString('en-GB', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  }
}
```

- [ ] **Step 5: Run test to verify it passes**

```bash
ng test --watch=false --include='**/me.component.spec.ts'
```

Expected: 3 specs PASS.

- [ ] **Step 6: Commit**

```bash
git add src/app/core/me/
git commit -m "feat: add MeComponent with admin's searches, feedback and messages"
```

---

## Task 3: Update AdminComponent — Remove My Searches & Hardcoded Email Check

**Files:**
- Modify: `src/app/core/admin/admin.component.ts`

- [ ] **Step 1: Inject AdminsService**

In `src/app/core/admin/admin.component.ts`, add the import and inject at the top of the class:

```typescript
// Add to imports at top of file
import { AdminsService } from '../../services/admins.service';
```

Inside the `AdminComponent` class body, add after the existing `input()` declarations:

```typescript
adminsService = inject(AdminsService);
```

- [ ] **Step 2: Replace the hardcoded email guard in the template**

Find this line in the template (line 1 of the `template` string):

```
@if(currentUser()?.email === 'gurvinder.singh.sandhu@gmail.com' && currentUser()?.emailVerified){
```

Replace with:

```
@if(adminsService.isAdmin(currentUser()?.uid)){
```

- [ ] **Step 3: Remove the My Searches expansion panel from the template**

Find and delete the entire `<!-- My Searches -->` expansion panel block from the Plate Searches accordion. This is the block that starts with:

```html
<!-- My Searches -->
<mat-expansion-panel>
  <mat-expansion-panel-header>
    <mat-panel-title>My Searches</mat-panel-title>
```

and ends just before `<!-- Other Users -->`. Delete that entire expansion panel.

- [ ] **Step 4: Remove the mySearches computed**

Find and delete this computed from the class body:

```typescript
mySearches = computed(() =>
  this.searches().filter((s) => s.userId === this.currentUser()?.uid)
);
```

- [ ] **Step 5: Build to verify no compilation errors**

```bash
ng build --configuration development 2>&1 | head -40
```

Expected: Build completes with no errors (warnings are ok).

- [ ] **Step 6: Commit**

```bash
git add src/app/core/admin/admin.component.ts
git commit -m "refactor: remove My Searches from AdminComponent and replace hardcoded email check"
```

---

## Task 4: Update AccountDashboardComponent — Add Me Tab & Wire AdminsService

**Files:**
- Modify: `src/app/core/account-dashboard/account-dashboard.component.ts`
- Modify: `src/app/core/account-dashboard/account-dashboard.component.html`

- [ ] **Step 1: Update the TypeScript file**

Replace the full contents of `src/app/core/account-dashboard/account-dashboard.component.ts` with:

```typescript
import { Component, OnDestroy, OnInit, effect, inject, signal } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatTabsModule } from '@angular/material/tabs';
import { Router, RouterModule } from '@angular/router';
import { AuthService } from '../../services/auth.service';
import { map, Subscription } from 'rxjs';
import { UserAccountDetailsComponent } from '../user-account-details/user-account-details.component';
import { ValuationService } from '../../services/valuation.service';
import { NumberPlateType, RegValuation } from '../../models/reg.model';
import { AccountDashboardValuationComponent } from '../account-dashboard-valuation/account-dashboard-valuation.component';
import { NumberPlateFormService } from '../../services/number-plate-form.service';
import { AdminComponent } from '../admin/admin.component';
import { AdminService, AutoValuation, PlateSearch, PlateValuationMessage, UserProfile, ValuationFeedback } from '../../services/admin.service';
import { AdminsService } from '../../services/admins.service';
import { MeComponent } from '../me/me.component';

@Component({
  selector: 'app-account-dashboard',
  standalone: true,
  imports: [
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
  adminsService = inject(AdminsService);
  private numberPlateFormService = inject(NumberPlateFormService);

  valuations$ = signal<RegValuation[]>([]);
  plateSearches$ = signal<PlateSearch[]>([]);
  autoValuations$ = signal<AutoValuation[]>([]);
  users$ = signal<UserProfile[]>([]);
  feedback$ = signal<ValuationFeedback[]>([]);
  plateMessages$ = signal<PlateValuationMessage[]>([]);

  private hasLoadedUsers = false;

  constructor(
    private router: Router,
    private authService: AuthService
  ) {
    effect(() => {
      const uid = (this.currentUser$() as any)?.uid;
      if (uid && this.adminsService.isAdmin(uid) && !this.hasLoadedUsers) {
        this.hasLoadedUsers = true;
        this.adminService.getAuthUsers().subscribe((users) => this.users$.set(users));
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

- [ ] **Step 2: Update the HTML template**

Replace the full contents of `src/app/core/account-dashboard/account-dashboard.component.html` with:

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

            </mat-tab-group>

            <button type="button" class="my-3 mx-auto d-block" color="accent" mat-raised-button [disabled]="!currentUser$()" (click)="signOut()">Sign Out</button>

        </div>
    </div>
}
```

- [ ] **Step 3: Build to verify no compilation errors**

```bash
ng build --configuration development 2>&1 | head -40
```

Expected: Build completes with no errors.

- [ ] **Step 4: Run all tests**

```bash
ng test --watch=false
```

Expected: All specs PASS.

- [ ] **Step 5: Commit**

```bash
git add src/app/core/account-dashboard/account-dashboard.component.ts src/app/core/account-dashboard/account-dashboard.component.html
git commit -m "feat: add Me tab to account dashboard with Firestore-based admin check"
```
