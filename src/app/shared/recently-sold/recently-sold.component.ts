import { Component, inject } from '@angular/core';
import { UpperCasePipe, DecimalPipe } from '@angular/common';
import { PlateListing } from '../../models/plate-listing.model';
import { PlateListingService } from '../../services/plate-listing.service';

@Component({
  selector: 'app-recently-sold',
  standalone: true,
  imports: [UpperCasePipe, DecimalPipe],
  templateUrl: './recently-sold.component.html',
  styleUrl: './recently-sold.component.scss'
})
export class RecentlySoldComponent {
  private plateListingService = inject(PlateListingService);

  soldListings: PlateListing[] = [];

  constructor() {
    this.plateListingService.getSold().subscribe(listings => {
      this.soldListings = listings;
    });
  }
}
