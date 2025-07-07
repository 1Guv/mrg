import { Component, inject, Input } from '@angular/core';
import { RegValuation } from '../../models/reg.model';
import { MatCardModule, MatCardHeader, MatCardTitle, MatCardSubtitle } from '@angular/material/card';
import { CommonModule, JsonPipe } from '@angular/common';
import { DecimalPipe } from "@angular/common";
import { MatButtonModule } from '@angular/material/button';
import { ValuationService } from '../../services/valuation.service';

@Component({
  selector: 'app-account-dashboard-valuation',
  imports: [CommonModule, MatCardModule, JsonPipe, MatCardHeader, MatCardTitle, MatCardSubtitle, DecimalPipe, MatButtonModule],
  template: `
    <mat-card class="my-2 bg-warning">
      <mat-card-header>
        <mat-card-title>{{ valuation.registration }}</mat-card-title>
        <mat-card-subtitle>
          <span class="fs-6 text-uppercase">{{ valuation.type }}</span>
        </mat-card-subtitle>
      </mat-card-header>
      <mat-card-content>
        <!-- <pre>{{ valuation | json }}</pre> -->
         <h1 class="my-4">£{{ ( (valuation.totalPoints ?? 0) * (valuation.multiplier ?? 0)) | number: '1.2-2' }}</h1>
         <h6>Min: £{{ (valuation.minPrice ?? 0) | number: '1.2-2' }}</h6>
         <h6>Max: £{{ (valuation.maxPrice ?? 0) | number: '1.2-2' }}</h6>
      </mat-card-content>
      <hr>
      <mat-card-actions>
        <button type="button" mat-raised-button color="warn" (click)="onDeleteValuation(valuation.id ?? '')">Delete</button>
      </mat-card-actions>
    </mat-card>
  `,  
  styleUrl: './account-dashboard-valuation.component.scss'
})
export class AccountDashboardValuationComponent {
  @Input() valuation: RegValuation = {} as RegValuation;

  private valuationService = inject(ValuationService);

  onDeleteValuation(valuationId: string) {
    this.valuationService.deleteValuation(valuationId);
  }
}
