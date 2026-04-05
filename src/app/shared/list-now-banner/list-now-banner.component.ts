import { Component, inject } from '@angular/core';
import { RouterModule } from '@angular/router';
import { MatButtonModule } from '@angular/material/button';
import { PlateListingService } from '../../services/plate-listing.service';

@Component({
  selector: 'app-list-now-banner',
  standalone: true,
  imports: [RouterModule, MatButtonModule],
  templateUrl: './list-now-banner.component.html',
  styleUrl: './list-now-banner.component.scss'
})
export class ListNowBannerComponent {
  plateListingService = inject(PlateListingService);
}
