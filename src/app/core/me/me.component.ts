import { Component, computed, inject, input, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatCardModule } from '@angular/material/card';
import { MatTableModule } from '@angular/material/table';
import { MatExpansionModule } from '@angular/material/expansion';
import { MatButtonModule } from '@angular/material/button';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { AutoValuation, PlateSearch, PlateValuationMessage, ValuationFeedback } from '../../services/admin.service';
import { AdminsService } from '../../services/admins.service';
import { SocialPostService } from '../../services/social-post.service';

@Component({
  selector: 'app-me',
  standalone: true,
  imports: [CommonModule, MatCardModule, MatTableModule, MatExpansionModule, MatButtonModule, MatSnackBarModule],
  template: `
    <!-- Content Queue (admin only) -->
    <mat-card class="mb-4 queue-card">
      <mat-card-header>
        <mat-card-title>📋 Content Queue</mat-card-title>
        <mat-card-subtitle>Process pending plates from the Google Sheet</mat-card-subtitle>
      </mat-card-header>
      <mat-card-content class="pt-3">
        @if (queueResult()) {
          <p class="queue-result" [class.queue-result--success]="!queueError()" [class.queue-result--error]="queueError()">
            {{ queueResult() }}
          </p>
        }
      </mat-card-content>
      <mat-card-actions class="px-3 pb-3">
        <button
          mat-raised-button
          color="primary"
          [disabled]="isProcessing()"
          (click)="processQueue()">
          {{ isProcessing() ? '⏳ Processing...' : '🚀 Process Queue Now' }}
        </button>
      </mat-card-actions>
    </mat-card>

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
        <mat-card-title>My Valuations</mat-card-title>
      </mat-card-header>
      <mat-card-content>
        @if(myAutoValuations().length === 0){
          <p class="text-muted mt-3">No valuations from you yet.</p>
        } @else {
          <mat-accordion class="mt-3">
            <mat-expansion-panel>
              <mat-expansion-panel-header>
                <mat-panel-title>Valuations</mat-panel-title>
                <mat-panel-description>
                  <span class="search-count">{{ myAutoValuations().length }}</span>
                </mat-panel-description>
              </mat-expansion-panel-header>
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
  private socialPostService = inject(SocialPostService);
  private snackBar = inject(MatSnackBar);

  isProcessing = signal(false);
  queueResult = signal<string | null>(null);
  queueError = signal(false);

  async processQueue(): Promise<void> {
    this.isProcessing.set(true);
    this.queueResult.set(null);
    this.queueError.set(false);
    try {
      const res = await this.socialPostService.processQueue();
      const msg = res.processed === 0
        ? 'No pending plates found in the sheet.'
        : `Done! ${res.processed} plate${res.processed === 1 ? '' : 's'} processed and posted.`;
      this.queueResult.set(msg);
      this.snackBar.open(msg, 'OK', { duration: 5000 });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Something went wrong. Check the function logs.';
      this.queueResult.set(msg);
      this.queueError.set(true);
      this.snackBar.open(msg, 'OK', { duration: 6000 });
    } finally {
      this.isProcessing.set(false);
    }
  }

  mySearches = computed(() =>
    this.searches().filter(s => s.userId === this.currentUser()?.uid)
  );

  myAutoValuations = computed(() =>
    this.autoValuations().filter(v => v.userId === this.currentUser()?.uid)
  );

  adminFeedback = computed(() =>
    this.feedback().filter(f => this.adminsService.adminUids().includes(f.userId ?? ''))
  );

  adminMessages = computed(() =>
    this.plateMessages().filter(m => this.adminsService.adminUids().includes(m.userId ?? ''))
  );

  searchColumns = ['registration', 'type', 'badge', 'searchedAt', 'price'];
  valuationColumns = ['registration', 'type', 'price', 'minPrice', 'maxPrice', 'savedAt'];
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
