import { Component, Input } from '@angular/core';
import { DecimalPipe } from '@angular/common';
import { MatCardModule } from '@angular/material/card';

@Component({
  selector: 'app-plate-valuation-totals',
  standalone: true,
  imports: [DecimalPipe, MatCardModule],
  templateUrl: './plate-valuation-totals.component.html',
  styleUrl: './plate-valuation-totals.component.scss',
})
export class PlateValuationTotalsComponent {
  @Input() totalPrice: number = 0;
  @Input() minPrice: number = 0;
  @Input() maxPrice: number = 0;
}
