import { Component, computed, inject, input, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatCardModule } from '@angular/material/card';
import { MatTableModule } from '@angular/material/table';
import { MatExpansionModule } from '@angular/material/expansion';
import { MatButtonToggleModule } from '@angular/material/button-toggle';
import { AutoValuation, PlateSearch, PlateValuationMessage, UserProfile, ValuationFeedback } from '../../services/admin.service';
import { AdminsService } from '../../services/admins.service';

@Component({
  selector: 'app-admin',
  imports: [
    CommonModule,
    MatCardModule,
    MatTableModule,
    MatExpansionModule,
    MatButtonToggleModule,
  ],
  template: `
    @if(isAdmin){
      <mat-card class="mb-4">
        <mat-card-header>
          <mat-card-title>Plate Searches</mat-card-title>
        </mat-card-header>
        <mat-card-content>
          @if(searches().length === 0){
            <p class="text-muted mt-3">No searches yet.</p>
          } @else {

            <mat-accordion class="mt-3">

              <!-- Other Users -->
              <mat-expansion-panel>
                <mat-expansion-panel-header>
                  <mat-panel-title>Other Users</mat-panel-title>
                  <mat-panel-description>
                    <span class="search-count">{{ filteredOtherSearches().length }}</span>
                  </mat-panel-description>
                </mat-expansion-panel-header>
                @if(otherSearches().length === 0){
                  <p class="text-muted mt-2">No searches from other users yet.</p>
                } @else {
                  <mat-button-toggle-group class="type-filter mt-3" [value]="selectedSearchType()" (change)="selectedSearchType.set($event.value)">
                    <mat-button-toggle value="">All ({{ otherSearches().length }})</mat-button-toggle>
                    @for(type of otherSearchTypes(); track type){
                      <mat-button-toggle [value]="type">{{ type }} ({{ searchCountByType(type) }})</mat-button-toggle>
                    }
                  </mat-button-toggle-group>
                  <table mat-table [dataSource]="filteredOtherSearches()" class="w-100 mt-2">
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
                    <ng-container matColumnDef="fullName">
                      <th mat-header-cell *matHeaderCellDef>Name</th>
                      <td mat-cell *matCellDef="let s">{{ (s.firstName || s.lastName) ? (s.firstName + ' ' + s.lastName).trim() : '—' }}</td>
                    </ng-container>
                    <ng-container matColumnDef="email">
                      <th mat-header-cell *matHeaderCellDef>Email</th>
                      <td mat-cell *matCellDef="let s">{{ s.email || '—' }}</td>
                    </ng-container>
                    <ng-container matColumnDef="userId">
                      <th mat-header-cell *matHeaderCellDef>User</th>
                      <td mat-cell *matCellDef="let s">{{ s.userId ?? 'Guest' }}</td>
                    </ng-container>
                    <tr mat-header-row *matHeaderRowDef="columnsWithUser"></tr>
                    <tr mat-row *matRowDef="let row; columns: columnsWithUser;"></tr>
                  </table>
                }
              </mat-expansion-panel>

            </mat-accordion>
          }
        </mat-card-content>
      </mat-card>

      <mat-card class="mb-4">
        <mat-card-header>
          <mat-card-title>Auto Valuations</mat-card-title>
        </mat-card-header>
        <mat-card-content>
          @if(autoValuations().length === 0){
            <p class="text-muted mt-3">No auto valuations yet.</p>
          } @else {

            <mat-accordion class="mt-3">

              <!-- Other Users -->
              <mat-expansion-panel>
                <mat-expansion-panel-header>
                  <mat-panel-title>Other Users</mat-panel-title>
                  <mat-panel-description>
                    <span class="search-count">{{ otherAutoValuations().length }}</span>
                  </mat-panel-description>
                </mat-expansion-panel-header>
                @if(otherAutoValuations().length === 0){
                  <p class="text-muted mt-2">No valuations from other users yet.</p>
                } @else {
                  <table mat-table [dataSource]="otherAutoValuations()" class="w-100 mt-2">
                    <ng-container matColumnDef="registration">
                      <th mat-header-cell *matHeaderCellDef>Plate</th>
                      <td mat-cell *matCellDef="let v"><strong>{{ v.registration }}</strong></td>
                    </ng-container>
                    <ng-container matColumnDef="type">
                      <th mat-header-cell *matHeaderCellDef>Type</th>
                      <td mat-cell *matCellDef="let v">{{ v.type }}</td>
                    </ng-container>
                    <ng-container matColumnDef="price">
                      <th mat-header-cell *matHeaderCellDef>Valuation</th>
                      <td mat-cell *matCellDef="let v">{{ formatPrice(v.price) }}</td>
                    </ng-container>
                    <ng-container matColumnDef="minPrice">
                      <th mat-header-cell *matHeaderCellDef>Min</th>
                      <td mat-cell *matCellDef="let v">{{ formatPrice(v.minPrice) }}</td>
                    </ng-container>
                    <ng-container matColumnDef="maxPrice">
                      <th mat-header-cell *matHeaderCellDef>Max</th>
                      <td mat-cell *matCellDef="let v">{{ formatPrice(v.maxPrice) }}</td>
                    </ng-container>
                    <ng-container matColumnDef="savedAt">
                      <th mat-header-cell *matHeaderCellDef>Valued At</th>
                      <td mat-cell *matCellDef="let v">{{ v.savedAt?.toDate() | date:'dd/MM/yyyy HH:mm' }}</td>
                    </ng-container>
                    <ng-container matColumnDef="fullName">
                      <th mat-header-cell *matHeaderCellDef>Name</th>
                      <td mat-cell *matCellDef="let v">{{ (v.firstName || v.lastName) ? (v.firstName + ' ' + v.lastName).trim() : '—' }}</td>
                    </ng-container>
                    <ng-container matColumnDef="email">
                      <th mat-header-cell *matHeaderCellDef>Email</th>
                      <td mat-cell *matCellDef="let v">{{ v.email || '—' }}</td>
                    </ng-container>
                    <ng-container matColumnDef="userId">
                      <th mat-header-cell *matHeaderCellDef>User</th>
                      <td mat-cell *matCellDef="let v">{{ v.userId ?? 'Guest' }}</td>
                    </ng-container>
                    <tr mat-header-row *matHeaderRowDef="valuationColumnsWithUser"></tr>
                    <tr mat-row *matRowDef="let row; columns: valuationColumnsWithUser;"></tr>
                  </table>
                }
              </mat-expansion-panel>

            </mat-accordion>
          }
        </mat-card-content>
      </mat-card>

      <mat-card class="mb-4">
        <mat-card-header>
          <mat-card-title>Valuation Feedback</mat-card-title>
        </mat-card-header>
        <mat-card-content>
          @if (userFeedback().length === 0) {
            <p class="text-muted mt-3">No feedback yet.</p>
          } @else {
            <mat-accordion class="mt-3">
              <mat-expansion-panel>
                <mat-expansion-panel-header>
                  <mat-panel-title>Feedback Summary</mat-panel-title>
                  <mat-panel-description>
                    👍 {{ totalLikes() }} &nbsp; 👎 {{ totalDislikes() }} &nbsp;
                    <span class="search-count">{{ userFeedback().length }}</span>
                  </mat-panel-description>
                </mat-expansion-panel-header>
                <table mat-table [dataSource]="feedbackByPlate()" class="w-100 mt-2">
                  <ng-container matColumnDef="registration">
                    <th mat-header-cell *matHeaderCellDef>Plate</th>
                    <td mat-cell *matCellDef="let f"><strong>{{ f.registration }}</strong></td>
                  </ng-container>
                  <ng-container matColumnDef="valuation">
                    <th mat-header-cell *matHeaderCellDef>Valuation</th>
                    <td mat-cell *matCellDef="let f">{{ formatPrice(f.valuation) }}</td>
                  </ng-container>
                  <ng-container matColumnDef="likes">
                    <th mat-header-cell *matHeaderCellDef>👍 Likes</th>
                    <td mat-cell *matCellDef="let f" class="text-success fw-bold">{{ f.likes }}</td>
                  </ng-container>
                  <ng-container matColumnDef="dislikes">
                    <th mat-header-cell *matHeaderCellDef>👎 Dislikes</th>
                    <td mat-cell *matCellDef="let f" class="text-danger fw-bold">{{ f.dislikes }}</td>
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
          <mat-card-title>Plate Valuation Messages ({{ userMessages().length }})</mat-card-title>
        </mat-card-header>
        <mat-card-content>
          @if (userMessages().length === 0) {
            <p class="text-muted mt-3">No messages yet.</p>
          } @else {
            <mat-accordion class="mt-3">
              <mat-expansion-panel>
                <mat-expansion-panel-header>
                  <mat-panel-title>All Messages</mat-panel-title>
                  <mat-panel-description>
                    <span class="search-count">{{ userMessages().length }}</span>
                  </mat-panel-description>
                </mat-expansion-panel-header>
                <table mat-table [dataSource]="userMessages()" class="w-100 mt-3">
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
                  <tr mat-header-row *matHeaderRowDef="plateMessageColumns"></tr>
                  <tr mat-row *matRowDef="let row; columns: plateMessageColumns;"></tr>
                </table>
              </mat-expansion-panel>
            </mat-accordion>
          }
        </mat-card-content>
      </mat-card>

      <mat-card class="mb-4">
        <mat-card-header>
          <mat-card-title>Registered Users</mat-card-title>
        </mat-card-header>
        <mat-card-content>
          @if (nonAdminUsers().length === 0) {
            <p class="text-muted mt-3">Loading users...</p>
          } @else {
            <mat-accordion class="mt-3">
              <mat-expansion-panel>
                <mat-expansion-panel-header>
                  <mat-panel-title>All Users</mat-panel-title>
                  <mat-panel-description>
                    <span class="search-count">{{ nonAdminUsers().length }}</span>
                    &nbsp;&nbsp;Verified: {{ verifiedUsers().length }}
                    &nbsp;&nbsp;Unverified: {{ nonAdminUsers().length - verifiedUsers().length }}
                  </mat-panel-description>
                </mat-expansion-panel-header>
                <table mat-table [dataSource]="nonAdminUsers()" class="w-100 mt-2">
                  <ng-container matColumnDef="email">
                    <th mat-header-cell *matHeaderCellDef>Email</th>
                    <td mat-cell *matCellDef="let u">{{ u.email }}</td>
                  </ng-container>
                  <ng-container matColumnDef="emailVerified">
                    <th mat-header-cell *matHeaderCellDef>Verified</th>
                    <td mat-cell *matCellDef="let u">{{ u.emailVerified ? '✓' : '—' }}</td>
                  </ng-container>
                  <ng-container matColumnDef="plates">
                    <th mat-header-cell *matHeaderCellDef>Plates Valuated</th>
                    <td mat-cell *matCellDef="let u">
                      @if (getPlatesForUser(u.uid).length === 0) {
                        <span>—</span>
                      } @else {
                        @for (plate of getPlatesForUser(u.uid); track plate) {
                          <div>{{ plate }}</div>
                        }
                      }
                    </td>
                  </ng-container>
                  <ng-container matColumnDef="createdAt">
                    <th mat-header-cell *matHeaderCellDef>Registered</th>
                    <td mat-cell *matCellDef="let u">{{ u.createdAt | date:'dd/MM/yyyy HH:mm' }}</td>
                  </ng-container>
                  <ng-container matColumnDef="lastSignIn">
                    <th mat-header-cell *matHeaderCellDef>Last Sign In</th>
                    <td mat-cell *matCellDef="let u">{{ u.lastSignIn ? (u.lastSignIn | date:'dd/MM/yyyy HH:mm') : '—' }}</td>
                  </ng-container>
                  <tr mat-header-row *matHeaderRowDef="userColumns"></tr>
                  <tr mat-row *matRowDef="let row; columns: userColumns;"></tr>
                </table>
              </mat-expansion-panel>
            </mat-accordion>
          }
        </mat-card-content>
      </mat-card>
    }
  `,
  styleUrl: './admin.component.scss'
})
export class AdminComponent {
  currentUser = input<any>();
  searches = input<PlateSearch[]>([]);
  autoValuations = input<AutoValuation[]>([]);
  users = input<UserProfile[]>([]);
  feedback = input<ValuationFeedback[]>([]);
  plateMessages = input<PlateValuationMessage[]>([]);

  private adminsService = inject(AdminsService);

  protected get isAdmin(): boolean {
    return this.adminsService.isAdmin(this.currentUser()?.uid);
  }

  nonAdminUsers = computed(() =>
    this.users().filter(u => !this.adminsService.adminUids().includes(u.uid))
  );

  verifiedUsers = computed(() => this.nonAdminUsers().filter(u => u.emailVerified));

  userFeedback = computed(() =>
    this.feedback().filter(f => !this.adminsService.adminUids().includes(f.userId ?? ''))
  );

  userMessages = computed(() =>
    this.plateMessages().filter(m => !this.adminsService.adminUids().includes(m.userId ?? ''))
  );

  totalLikes = computed(() => this.userFeedback().filter(f => f.agreed).length);
  totalDislikes = computed(() => this.userFeedback().filter(f => !f.agreed).length);

  feedbackByPlate = computed(() => {
    const map = new Map<string, { likes: number; dislikes: number; valuation: number }>();
    for (const f of this.userFeedback()) {
      const key = f.registration?.toUpperCase() ?? 'UNKNOWN';
      const entry = map.get(key) ?? { likes: 0, dislikes: 0, valuation: f.valuation };
      if (f.agreed) entry.likes++; else entry.dislikes++;
      map.set(key, entry);
    }
    return [...map.entries()]
      .map(([registration, data]) => ({ registration, ...data }))
      .sort((a, b) => (b.likes + b.dislikes) - (a.likes + a.dislikes));
  });
  userColumns = ['email', 'emailVerified', 'plates', 'createdAt', 'lastSignIn'];

  getPlatesForUser(uid: string): string[] {
    const parts: string[] = [];

    const valuations = this.autoValuations().filter(v => v.userId === uid);
    const seenV = new Set<string>();
    valuations.forEach(v => {
      if (!seenV.has(v.registration)) {
        seenV.add(v.registration);
        parts.push(`${v.registration} (${this.formatPrice(v.price)})`);
      }
    });

    const searches = this.searches().filter(s => s.userId === uid);
    const seenS = new Set<string>();
    searches.forEach(s => {
      if (!seenS.has(s.registration)) {
        seenS.add(s.registration);
        parts.push(`${s.registration} (${s.type})`);
      }
    });

    return parts;
  }

  feedbackColumns = ['registration', 'valuation', 'likes', 'dislikes'];
  plateMessageColumns = ['registration', 'plateMeaning', 'valuation', 'message', 'submittedAt'];
  columnsWithUser = ['registration', 'type', 'badge', 'searchedAt', 'price', 'fullName', 'email', 'userId'];
  valuationColumnsWithUser = ['registration', 'type', 'price', 'minPrice', 'maxPrice', 'savedAt', 'fullName', 'email', 'userId'];

  otherSearches = computed(() =>
    this.searches().filter((s) => s.userId !== this.currentUser()?.uid)
  );

  selectedSearchType = signal('');

  otherSearchTypes = computed(() =>
    [...new Set(this.otherSearches().map((s) => s.type))].sort()
  );

  filteredOtherSearches = computed(() => {
    const type = this.selectedSearchType();
    return type ? this.otherSearches().filter((s) => s.type === type) : this.otherSearches();
  });

  searchCountByType(type: string): number {
    return this.otherSearches().filter((s) => s.type === type).length;
  }

  otherAutoValuations = computed(() =>
    this.autoValuations().filter((v) => v.userId !== this.currentUser()?.uid)
  );

  getPrice(registration: string): string {
    const match = this.autoValuations().find(
      (v) => v.registration?.toUpperCase() === registration?.toUpperCase()
    );
    if (!match || !match.price) return '-';
    return '£' + match.price.toLocaleString('en-GB', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  }

  formatPrice(price: number): string {
    if (price == null) return '-';
    return '£' + price.toLocaleString('en-GB', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  }
}
