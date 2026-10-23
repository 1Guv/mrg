import { Component, inject, OnInit } from '@angular/core';
import { ActivatedRoute, RouterModule } from '@angular/router';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { ConversionTrackingService } from '../../services/conversion-tracking.service';

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

  ngOnInit(): void {
    // GA4 drops repeat purchases with the same transaction_id, so a reload is safe
    const sessionId = this.route.snapshot.queryParamMap.get('session_id');
    if (sessionId) this.tracking.listingPurchased(sessionId);
  }
}
