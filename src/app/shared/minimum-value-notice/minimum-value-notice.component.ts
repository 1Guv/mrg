import { Component, EventEmitter, Input, Output } from '@angular/core';
import { DecimalPipe } from '@angular/common';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MINIMUM_PLATE_VALUE, ValuationReason } from '../../formulas/minimum-value';

/**
 * Shown when the chosen options add up to less than the minimum plate value:
 * the true calculated figure, what pulled it down, and the minimum range the
 * plate is valued at instead.
 */
@Component({
  selector: 'app-minimum-value-notice',
  standalone: true,
  imports: [DecimalPipe, MatButtonModule, MatCardModule],
  templateUrl: './minimum-value-notice.component.html',
  styleUrl: './minimum-value-notice.component.scss'
})
export class MinimumValueNoticeComponent {
  @Input({ required: true }) calculatedPrice = 0;
  @Input() reasons: ValuationReason[] = [];

  @Output() changeAnswers = new EventEmitter<void>();

  readonly minimum = MINIMUM_PLATE_VALUE;
}
