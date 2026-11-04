import { Component, inject, input } from '@angular/core';
import { DecimalPipe } from '@angular/common';
import { PublicStatsService } from '../../services/public-stats.service';

/**
 * Real site numbers as social proof: plates for sale, plates valued and
 * members. Hidden until the numbers load. `compact` is a single small line
 * for forms and panels.
 */
@Component({
  selector: 'app-stats-strip',
  standalone: true,
  imports: [DecimalPipe],
  templateUrl: './stats-strip.component.html',
  styleUrl: './stats-strip.component.scss'
})
export class StatsStripComponent {
  readonly stats = inject(PublicStatsService).stats;
  readonly compact = input(false);
}
