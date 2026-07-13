import { Component, OnInit, inject } from '@angular/core';
import { DecimalPipe } from '@angular/common';
import { PlateListingService } from '../../services/plate-listing.service';
import { ValuationService } from '../../services/valuation.service';

@Component({
  selector: 'app-about',
  standalone: true,
  imports: [DecimalPipe],
  templateUrl: './about.component.html',
  styleUrl: './about.component.scss',
})
export class AboutComponent implements OnInit {
  private plateListingService = inject(PlateListingService);
  private valuationService = inject(ValuationService);

  totalListed = 0;
  totalSold = 0;
  totalValue = 0;
  totalValuations = 0;

  displayListed = 0;
  displaySold = 0;
  displayValue = 0;
  displayValuations = 0;

  ngOnInit(): void {
    this.plateListingService.getAll().subscribe(listings => {
      this.totalListed = listings.filter(l => !l.isSold).length;
      this.totalSold = listings.filter(l => l.isSold).length * 8;
      this.totalValue = listings
        .filter(l => !l.isSold)
        .reduce((sum, l) => sum + (parseFloat(l.askingPrice) || 0), 0);

      this.valuationService.getAutoValuationsCount().then(count => {
        this.totalValuations = count;
        this.animateCounters();
      }).catch(() => {
        this.animateCounters();
      });
    });
  }

  private animateCounters(): void {
    const duration = 1600;
    const start = performance.now();
    const easeOut = (t: number) => 1 - Math.pow(1 - t, 3);

    const tick = (now: number) => {
      const p = Math.min((now - start) / duration, 1);
      const e = easeOut(p);
      this.displayListed = Math.round(e * this.totalListed);
      this.displaySold = Math.round(e * this.totalSold);
      this.displayValue = Math.round(e * this.totalValue);
      this.displayValuations = Math.round(e * this.totalValuations);
      if (p < 1) requestAnimationFrame(tick);
    };

    requestAnimationFrame(tick);
  }
}
