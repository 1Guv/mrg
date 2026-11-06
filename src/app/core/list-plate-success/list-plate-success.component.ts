import { Component, inject, OnInit } from '@angular/core';
import { ActivatedRoute, RouterModule } from '@angular/router';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { CHECKOUT_VALUE_STORAGE_KEY, LISTING_FEE } from '../../constants/listing-fee';
import { ConversionTrackingService } from '../../services/conversion-tracking.service';
import { normalisePlate } from '../../utils/normalise-plate';

@Component({
  selector: 'app-list-plate-success',
  standalone: true,
  imports: [RouterModule, MatButtonModule, MatIconModule],
  templateUrl: './list-plate-success.component.html',
  styleUrl: './list-plate-success.component.scss'
})
export class ListPlateSuccessComponent implements OnInit {
  private route = inject(ActivatedRoute);
  private tracking = inject(ConversionTrackingService);

  readonly fee = LISTING_FEE;
  /** Set after a free listing; paid listings come back with session_id. */
  freePlate = '';
  freePlateSlug = '';

  ngOnInit(): void {
    this.freePlate = this.route.snapshot.queryParamMap.get('plate') ?? '';
    this.freePlateSlug = normalisePlate(this.freePlate);

    // GA4 drops repeat purchases with the same transaction_id, so a reload is safe
    const sessionId = this.route.snapshot.queryParamMap.get('session_id');
    if (sessionId) this.tracking.listingPurchased(sessionId, this.paidPounds());
  }

  private paidPounds(): number {
    try {
      const stored = Number(sessionStorage.getItem(CHECKOUT_VALUE_STORAGE_KEY));
      if (stored > 0) return stored;
    } catch {
      // Storage can be blocked; fall through to the full fee.
    }
    return LISTING_FEE;
  }
}
