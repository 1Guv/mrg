import { Directive, HostListener, input } from '@angular/core';
import { ClickMetricsService } from '../services/click-metrics.service';
import { inject } from '@angular/core';

/**
 * Tracks button clicks and saves counts to Firestore.
 *
 * Usage:
 *   <button appTrackClick="value-plate-btn">Get Valuation</button>
 *   <button [appTrackClick]="'list-plate-btn'" trackLabel="List Plate">List My Plate</button>
 */
@Directive({
  selector: '[appTrackClick]',
  standalone: true,
})
export class TrackClickDirective {
  appTrackClick = input.required<string>();
  trackLabel = input<string>('');

  private metrics = inject(ClickMetricsService);

  @HostListener('click')
  onClick(): void {
    const id = this.appTrackClick();
    const label = this.trackLabel() || id;
    this.metrics.track(id, label);
  }
}
