import { Component, OnDestroy, inject } from '@angular/core';
import { AsyncPipe, DatePipe, UpperCasePipe, DOCUMENT } from '@angular/common';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { Title, Meta } from '@angular/platform-browser';
import { Observable, Subscription, startWith, switchMap, map, tap, take, shareReplay } from 'rxjs';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatDialog, MatDialogModule } from '@angular/material/dialog';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { PlateListingService } from '../../services/plate-listing.service';
import { AuthService } from '../../services/auth.service';
import { MessageSellerDialogComponent } from '../../shared/message-seller-dialog/message-seller-dialog.component';
import { AuthPromptDialogComponent } from '../../shared/auth-prompt-dialog/auth-prompt-dialog.component';
import { PlateListing } from '../../models/plate-listing.model';
import { normalisePlate } from '../../utils/normalise-plate';

type ListingState =
  | { status: 'loading' }
  | { status: 'found'; listing: PlateListing }
  | { status: 'not-found' };

@Component({
  selector: 'app-plate-detail',
  standalone: true,
  imports: [
    AsyncPipe, DatePipe, UpperCasePipe, RouterLink,
    MatButtonModule, MatIconModule, MatDialogModule, MatSnackBarModule,
  ],
  templateUrl: './plate-detail.component.html',
  styleUrl: './plate-detail.component.scss',
})
export class PlateDetailComponent implements OnDestroy {
  private route = inject(ActivatedRoute);
  private plateListingService = inject(PlateListingService);
  private titleService = inject(Title);
  private metaService = inject(Meta);
  private document = inject(DOCUMENT);
  private dialog = inject(MatDialog);
  private authService = inject(AuthService);
  private snackBar = inject(MatSnackBar);

  private canonicalLink: HTMLLinkElement | null = null;
  private jsonLdScript: HTMLScriptElement | null = null;
  private sub: Subscription;

  listingState$: Observable<ListingState> = this.route.paramMap.pipe(
    switchMap(params => {
      const plate = params.get('plate') ?? '';
      return this.plateListingService.getByPlate(plate).pipe(
        tap(listing => { if (listing) this.setSeoTags(listing); }),
        map(listing =>
          listing
            ? ({ status: 'found' as const, listing })
            : ({ status: 'not-found' as const })
        ),
        startWith({ status: 'loading' as const })
      );
    }),
    shareReplay(1)
  );

  constructor() {
    // Subscribe eagerly so side-effects (SEO tags) fire without needing a rendered template.
    this.sub = this.listingState$.subscribe();
  }

  private setSeoTags(listing: PlateListing): void {
    const plate = normalisePlate(listing.plateCharacters);
    const title = `${plate} Number Plate For Sale | MR Valuations`;
    const desc = `${plate} private number plate for sale at £${listing.askingPrice}${listing.meanings ? '. ' + listing.meanings : ''}. Contact the seller directly on MR Valuations.`;

    this.titleService.setTitle(title);
    this.metaService.updateTag({ name: 'description', content: desc });

    this.canonicalLink?.remove();
    const link = this.document.createElement('link');
    link.setAttribute('rel', 'canonical');
    link.setAttribute('href', `https://mrvaluations.co.uk/plates-for-sale/${plate}`);
    this.document.head.appendChild(link);
    this.canonicalLink = link;

    this.jsonLdScript?.remove();
    const script = this.document.createElement('script');
    script.type = 'application/ld+json';
    script.text = JSON.stringify({
      '@context': 'https://schema.org',
      '@type': 'Product',
      name: `${plate} Number Plate`,
      description: desc,
      offers: {
        '@type': 'Offer',
        price: listing.askingPrice,
        priceCurrency: 'GBP',
        availability: 'https://schema.org/InStock',
      },
    });
    this.document.head.appendChild(script);
    this.jsonLdScript = script;
  }

  ngOnDestroy(): void {
    this.sub.unsubscribe();
    this.titleService.setTitle('FREE Instant Number Plate Valuation | UKs 1st Automated Tool');
    this.metaService.removeTag('name="description"');
    this.canonicalLink?.remove();
    this.jsonLdScript?.remove();
  }

  onMessageSeller(listing: PlateListing): void {
    this.authService.currentUser$.pipe(take(1)).subscribe(user => {
      if (!user) {
        this.dialog.open(AuthPromptDialogComponent, { width: '380px' });
      } else {
        this.dialog.open(MessageSellerDialogComponent, { width: '520px', data: listing });
      }
    });
  }

  onCopyLink(): void {
    navigator.clipboard.writeText(window.location.href);
    this.snackBar.open('Link copied to clipboard!', 'Close', { duration: 3000 });
  }
}
