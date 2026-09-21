import { Component, computed, inject, input, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { PlateListingService } from '../../services/plate-listing.service';
import { PlateListing } from '../../models/plate-listing.model';
import { PlateListingCardComponent }
  from '../plate-listing-card/plate-listing-card.component';

/**
 * A short teaser of the newest plates for sale, shown on the homepage behind
 * the mode toggle. Deliberately not the full listings page — it links there
 * rather than reproducing its search, tabs and dialogs.
 */
@Component({
  selector: 'app-plates-preview',
  standalone: true,
  imports: [RouterLink, PlateListingCardComponent],
  templateUrl: './plates-preview.component.html',
  styleUrl: './plates-preview.component.scss',
})
export class PlatesPreviewComponent {
  private plateListingService = inject(PlateListingService);

  readonly limit = input(6);

  private readonly all = signal<PlateListing[]>([]);
  readonly loaded = signal(false);

  // Derived rather than snapshotted, so the view stays correct whatever
  // order the listings and the limit input arrive in.
  // getAll() is already ordered createdDate desc, so the newest unsold
  // listings are simply the first ones left after filtering.
  readonly listings = computed(() =>
    this.all().filter(l => !l.isSold).slice(0, this.limit()));

  constructor() {
    this.plateListingService.getAll()
      .pipe(takeUntilDestroyed())
      .subscribe(all => {
        this.all.set(all);
        this.loaded.set(true);
      });
  }
}
