import { Component, inject } from '@angular/core';
import { UpperCasePipe, DatePipe, DecimalPipe } from '@angular/common';
import { ScrollingModule } from '@angular/cdk/scrolling';
import { MatCardModule } from '@angular/material/card';
import { MatIconModule } from '@angular/material/icon';
import { MatTabsModule } from '@angular/material/tabs';
import { MatButtonModule } from '@angular/material/button';
import { MatBadgeModule } from '@angular/material/badge';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { FormsModule } from '@angular/forms';
import { BenefitCardComponent } from '../../shared/benefit-card/benefit-card.component';
import { ShareButtonsComponent } from '../../shared/share-buttons/share-buttons.component';
import { RecentlySoldComponent } from '../../shared/recently-sold/recently-sold.component';
import { BenefitCard } from '../../models/benefit-card.model';
import { PlateListing } from '../../models/plate-listing.model';
import { PlateListingService } from '../../services/plate-listing.service';
import { take } from 'rxjs';
import { MatDialog, MatDialogModule } from '@angular/material/dialog';
import { AuthService } from '../../services/auth.service';
import { AuthPromptDialogComponent } from '../../shared/auth-prompt-dialog/auth-prompt-dialog.component';
import { MessageSellerDialogComponent } from '../../shared/message-seller-dialog/message-seller-dialog.component';

@Component({
  selector: 'app-plates-for-sale',
  standalone: true,
  imports: [MatCardModule, MatIconModule, MatTabsModule, MatButtonModule, MatBadgeModule, BenefitCardComponent, ShareButtonsComponent, RecentlySoldComponent, ScrollingModule, UpperCasePipe, DatePipe, DecimalPipe, MatFormFieldModule, MatInputModule, FormsModule, MatDialogModule],
  templateUrl: './plates-for-sale.component.html',
  styleUrl: './plates-for-sale.component.scss'
})
export class PlatesForSaleComponent {

  private plateListingService = inject(PlateListingService);
  private dialog = inject(MatDialog);
  private authService = inject(AuthService);

  allListings: PlateListing[] = [];
  searchTerm = '';

  get filteredListings(): PlateListing[] {
    const term = this.searchTerm.trim().toLowerCase().replace(/\s/g, '');
    const available = this.allListings.filter(p => !p.isSold);
    if (!term) return available;
    return available.filter(p =>
      p.plateCharacters.toLowerCase().replace(/\s/g, '').includes(term) ||
      p.meanings?.toLowerCase().includes(term)
    );
  }

  get soldListings(): PlateListing[] {
    return this.allListings.filter(p => p.isSold);
  }

  get listingRows(): PlateListing[][] {
    const items = this.filteredListings;
    const rows: PlateListing[][] = [];
    for (let i = 0; i < items.length; i += 2) {
      rows.push(items.slice(i, i + 2));
    }
    return rows;
  }

  get soldListingRows(): PlateListing[][] {
    const items = this.soldListings;
    const rows: PlateListing[][] = [];
    for (let i = 0; i < items.length; i += 2) {
      rows.push(items.slice(i, i + 2));
    }
    return rows;
  }

  trackRow(index: number): number {
    return index;
  }

  onMessageSeller(listing: PlateListing): void {
    this.authService.currentUser$.pipe(take(1)).subscribe(user => {
      if (!user) {
        this.dialog.open(AuthPromptDialogComponent, { width: '380px' });
      } else {
        this.dialog.open(MessageSellerDialogComponent, {
          width: '520px',
          data: listing
        });
      }
    });
  }

  constructor() {
    this.plateListingService.getAll().subscribe(listings => {
      this.allListings = listings;
    });
  }

  comingSoonItems: BenefitCard[] = [
    {
      icon: 'gavel',
      title: 'Add your plate to an auction',
      description: 'Let buyers bid on your plate for the best possible price.',
      backgroundColor: '#f5f5f5',
      comingSoon: true
    },
    {
      icon: 'campaign',
      title: 'Social media promotion',
      description: "We'll promote your plate across Facebook, Instagram and TikTok to maximise your enquiries.",
      backgroundColor: '#f5f5f5',
      comingSoon: true
    }
  ];

  benefits: BenefitCard[] = [
    {
      icon: 'payments',
      title: 'One-off payment',
      description: 'Pay once, no subscriptions or hidden fees.',
      backgroundColor: '#e8f0fe',
      button: true,
      buttonName: 'List now for £22',
      buttonLink: '/list-plate'
    },
    {
      icon: 'schedule',
      title: 'Listed until sold',
      description: 'Your plate stays live until it finds a buyer.',
      backgroundColor: '#e0f7f7',
      button: true,
      buttonName: "Let's go",
      buttonLink: '/list-plate'
    },
    {
      icon: 'bar_chart',
      title: 'Live statistics',
      description: 'See views and engagement on your listing in real time.',
      backgroundColor: '#f3e5f5'
    },
    {
      icon: 'auto_awesome',
      title: 'Free instant valuation',
      description: "Know your plate's worth before you list — valued in seconds.",
      backgroundColor: '#e8f5e9',
      button: true,
      buttonName: 'Value my plate',
      buttonLink: '/'
    },
    {
      icon: 'groups',
      title: 'Reach serious buyers',
      description: 'Every visitor is already interested in plates — no tyre kickers, just genuine enquiries.',
      backgroundColor: '#fff8e1'
    },
    {
      icon: 'trending_up',
      title: 'Top search visibility',
      description: 'We rank at the top for "automated number plate valuation UK" — your plate gets seen by the right people.',
      backgroundColor: '#fce4ec'
    },
    {
      icon: 'dashboard',
      title: 'Manage your plates with us',
      description: 'Use our plate dashboard to manage your plate. There is no pressure to pay for a listing, however we can remind you of renewing your retention documents.',
      backgroundColor: '#e3f2fd',
      button: true,
      buttonName: 'Add now',
      buttonLink: '/list-plate'
    }
  ];
}
