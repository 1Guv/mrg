import { Component, computed, input, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatCardModule } from '@angular/material/card';
import { MatTableModule } from '@angular/material/table';
import { MatExpansionModule } from '@angular/material/expansion';
import { MatButtonToggleModule } from '@angular/material/button-toggle';
import { AutoValuation, PlateSearch } from '../../services/admin.service';

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
    @if(currentUser()?.email === 'gurvinder.singh.sandhu@gmail.com' && currentUser()?.emailVerified){
      <mat-card class="mb-4">
        <mat-card-header>
          <mat-card-title>Plate Searches</mat-card-title>
        </mat-card-header>
        <mat-card-content>
          @if(searches().length === 0){
            <p class="text-muted mt-3">No searches yet.</p>
          } @else {

            <mat-accordion class="mt-3">

              <!-- My Searches -->
              <mat-expansion-panel>
                <mat-expansion-panel-header>
                  <mat-panel-title>My Searches</mat-panel-title>
                  <mat-panel-description>
                    <span class="search-count">{{ mySearches().length }}</span>
                  </mat-panel-description>
                </mat-expansion-panel-header>
                @if(mySearches().length === 0){
                  <p class="text-muted mt-2">No searches from you yet.</p>
                } @else {
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
                    <tr mat-header-row *matHeaderRowDef="columns"></tr>
                    <tr mat-row *matRowDef="let row; columns: columns;"></tr>
                  </table>
                }
              </mat-expansion-panel>

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

              <!-- My Valuations -->
              <mat-expansion-panel>
                <mat-expansion-panel-header>
                  <mat-panel-title>My Valuations</mat-panel-title>
                  <mat-panel-description>
                    <span class="search-count">{{ myAutoValuations().length }}</span>
                  </mat-panel-description>
                </mat-expansion-panel-header>
                @if(myAutoValuations().length === 0){
                  <p class="text-muted mt-2">No valuations from you yet.</p>
                } @else {
                  <table mat-table [dataSource]="myAutoValuations()" class="w-100 mt-2">
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
                    <tr mat-header-row *matHeaderRowDef="valuationColumns"></tr>
                    <tr mat-row *matRowDef="let row; columns: valuationColumns;"></tr>
                  </table>
                }
              </mat-expansion-panel>

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
    }
  `,
  styleUrl: './admin.component.scss'
})
export class AdminComponent {
  currentUser = input<any>();
  searches = input<PlateSearch[]>([]);
  autoValuations = input<AutoValuation[]>([]);

  columns = ['registration', 'type', 'badge', 'searchedAt', 'price'];
  columnsWithUser = ['registration', 'type', 'badge', 'searchedAt', 'price', 'userId'];
  valuationColumns = ['registration', 'type', 'price', 'minPrice', 'maxPrice', 'savedAt'];
  valuationColumnsWithUser = ['registration', 'type', 'price', 'minPrice', 'maxPrice', 'savedAt', 'userId'];

  mySearches = computed(() =>
    this.searches().filter((s) => s.userId === this.currentUser()?.uid)
  );

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

  myAutoValuations = computed(() =>
    this.autoValuations().filter((v) => v.userId === this.currentUser()?.uid)
  );

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
    if (!price) return '-';
    return '£' + price.toLocaleString('en-GB', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  }
}
