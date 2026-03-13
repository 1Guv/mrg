import { Component, input } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatCardModule } from '@angular/material/card';
import { MatTableModule } from '@angular/material/table';
import { PlateSearch } from '../../services/admin.service';

@Component({
  selector: 'app-admin',
  imports: [
    CommonModule,
    MatCardModule,
    MatTableModule,
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
            <table mat-table [dataSource]="searches()" class="w-100 mt-3">
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
              <ng-container matColumnDef="userId">
                <th mat-header-cell *matHeaderCellDef>User</th>
                <td mat-cell *matCellDef="let s">{{ s.userId ?? 'Guest' }}</td>
              </ng-container>
              <tr mat-header-row *matHeaderRowDef="columns"></tr>
              <tr mat-row *matRowDef="let row; columns: columns;"></tr>
            </table>
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
  columns = ['registration', 'type', 'badge', 'searchedAt', 'userId'];
}
