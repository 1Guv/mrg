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
    if (price == null) return '-';
    return '£' + price.toLocaleString('en-GB', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  }
}
