import { Component, effect, inject, input, signal } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatIconModule } from '@angular/material/icon';
import { MatSlideToggleModule } from '@angular/material/slide-toggle';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { NudgeEmailsService } from '../../services/nudge-emails.service';

@Component({
  selector: 'app-user-account-details',
  standalone: true,
  imports: [
    MatButtonModule,
    MatCardModule,
    MatIconModule,
    MatSlideToggleModule,
    MatProgressSpinnerModule,
  ],
  template: `
  <mat-card class="my-3">
      <div class="mx-2 my-2">
          <mat-card-header>
              <mat-card-title>User Details</mat-card-title>
              <mat-card-subtitle>Welcome back {{ currentUser()?.displayName?.split(' ')?.[0] }}</mat-card-subtitle>
          </mat-card-header>
          <mat-card-content>
              <div class="my-3">
                  <p><span class="tag">Full Name:</span> {{ currentUser()?.displayName }}</p>
                  <p><span class="tag">Email:</span> {{ currentUser()?.email }}</p>
                  <p><span class="tag">Provider Name:</span> {{ currentUser()?.providerData?.[0]?.providerId }}</p>
              </div>

              <div class="nudge-toggle-row my-3">
                  @if (nudgeLoading()) {
                      <mat-spinner diameter="20"></mat-spinner>
                  } @else {
                      <mat-slide-toggle
                          [checked]="nudgeEnabled()"
                          [disabled]="nudgeSaving()"
                          (change)="onNudgeToggle($event.checked)">
                          Plate listing suggestions
                      </mat-slide-toggle>
                      <p class="nudge-hint text-muted">
                          Receive occasional emails about listing your valued plates for sale.
                      </p>
                  }
              </div>
          </mat-card-content>
      </div>
  </mat-card>
  `,
  styleUrl: './user-account-details.component.scss'
})
export class UserAccountDetailsComponent {
  currentUser = input<any>();

  private nudgeService = inject(NudgeEmailsService);

  nudgeEnabled = signal(true);
  nudgeLoading = signal(false);
  nudgeSaving = signal(false);

  constructor() {
    effect(() => {
      const user = this.currentUser();
      if (user?.uid) {
        this.loadNudgeStatus();
      }
    });
  }

  private loadNudgeStatus(): void {
    this.nudgeLoading.set(true);
    this.nudgeService.getNudgeStatus().subscribe({
      next: (optedOut) => {
        this.nudgeEnabled.set(!optedOut);
        this.nudgeLoading.set(false);
      },
      error: () => this.nudgeLoading.set(false),
    });
  }

  onNudgeToggle(enabled: boolean): void {
    this.nudgeSaving.set(true);
    this.nudgeService.toggleNudgeEmails(!enabled).subscribe({
      next: () => {
        this.nudgeEnabled.set(enabled);
        this.nudgeSaving.set(false);
      },
      error: () => this.nudgeSaving.set(false),
    });
  }
}
