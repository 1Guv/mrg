import { Component, inject, input } from '@angular/core';
import { UpperCasePipe, DatePipe, DecimalPipe } from '@angular/common';
import { MatCardModule } from '@angular/material/card';
import { MatButtonModule } from '@angular/material/button';
import { MatBadgeModule } from '@angular/material/badge';
import { MatDialog } from '@angular/material/dialog';
import { ShareButtonsComponent } from '../share-buttons/share-buttons.component';
import { MessageSellerDialogComponent }
  from '../message-seller-dialog/message-seller-dialog.component';
import { PlateListing } from '../../models/plate-listing.model';
import { normalisePlate } from '../../utils/normalise-plate';

/** 'preview' is a seller's own listing before it's published: Message Seller and sharing show greyed out. */
export type PlateCardVariant = 'sale' | 'sold' | 'preview';

/**
 * A single plate listing card.
 *
 * Shared by the plates-for-sale Buy and Sold tabs and the homepage preview,
 * so all three stay identical. It owns its own styling — it does not rely on
 * a particular parent class — and handles Message Seller itself, so parents
 * only need to supply the listing.
 */
@Component({
  selector: 'app-plate-listing-card',
  standalone: true,
  imports: [
    MatCardModule, MatButtonModule, MatBadgeModule,
    ShareButtonsComponent, UpperCasePipe, DatePipe, DecimalPipe,
  ],
  templateUrl: './plate-listing-card.component.html',
  styleUrl: './plate-listing-card.component.scss',
})
export class PlateListingCardComponent {
  private dialog = inject(MatDialog);

  readonly listing = input.required<PlateListing>();
  readonly variant = input<PlateCardVariant>('sale');

  normalisePlate = normalisePlate;

  onMessageSeller(): void {
    // Signed-out buyers can message too, as guests.
    this.dialog.open(MessageSellerDialogComponent, {
      width: '520px',
      data: this.listing(),
    });
  }
}
