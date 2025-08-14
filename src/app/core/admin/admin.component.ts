import { JsonPipe } from '@angular/common';
import { Component, inject, input } from '@angular/core';
import { MatCardModule } from '@angular/material/card';
import { MatButtonModule } from '@angular/material/button';
import { AdminService } from '../../services/admin.service';

@Component({
  selector: 'app-admin',
  imports: [
    MatCardModule,
    MatButtonModule
  ],
  template: `
    @if(currentUser()?.email === 'gurvinder.singh.sandhu@gmail.com' && currentUser()?.emailVerified){
      <mat-card>
        <mat-card-header>
          <mat-card-title>Admin</mat-card-title>
        </mat-card-header>
        <mat-card-content>

        </mat-card-content>
      </mat-card>
    }
    `,
  styleUrl: './admin.component.scss'
})
export class AdminComponent {
  adminService = inject(AdminService);
  currentUser = input<any>();
}
