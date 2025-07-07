import { Component, Input, Signal, input } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatIconModule } from '@angular/material/icon';

@Component({
  selector: 'app-user-account-details',
  standalone: true,
  imports: [
    MatButtonModule,
    MatCardModule,
    MatIconModule
  ],
  template: `
  <mat-card class="my-3">
      <div class="mx-2 my-2">
          <!-- <img class="round" src="{{ currentUser().photoUrl }}"> -->
          <mat-card-header>
              <mat-card-title>User Details</mat-card-title>
              <mat-card-subtitle>Welcome back {{ currentUser()?.firstName }}</mat-card-subtitle>
          </mat-card-header>
          <mat-card-content>
              <div class="my-3">
                  <p><span class="tag">Full Name:</span> {{ currentUser()?.name }}</p>
                  <p><span class="tag">Email:</span> {{ currentUser()?.email }}</p>
                  <p><span class="tag">Provider Name:</span> {{ currentUser()?.provider }}</p>
              </div>
          </mat-card-content>
      </div>
  </mat-card>
  `,
  styleUrl: './user-account-details.component.scss'
})
export class UserAccountDetailsComponent {
  currentUser = input<any>();
}
