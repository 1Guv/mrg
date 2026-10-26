import { Component, OnDestroy, inject } from '@angular/core';
import { AsyncPipe, DatePipe, UpperCasePipe, DOCUMENT } from '@angular/common';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { Title, Meta } from '@angular/platform-browser';
import { Observable, Subscription, startWith, switchMap, map, tap, take, shareReplay, catchError, of, filter } from 'rxjs';
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
import { PrerenderDataService } from '../../services/prerender-data.service';
import { PLATE_FORMAT_INFO, PlateFormatInfo, plateFormat } from '../../utils/plate-format';

/** The embedded copy: display fields plus the AI-written description. */
type PrerenderedPlate = PlateListing & { meaningDescription?: string };

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
  private router = inject(Router);
  private plateListingService = inject(PlateListingService);
  private titleService = inject(Title);
  private metaService = inject(Meta);
  private document = inject(DOCUMENT);
  private dialog = inject(MatDialog);
  private authService = inject(AuthService);
  private snackBar = inject(MatSnackBar);
  private prerenderData = inject(PrerenderDataService);

  private canonicalLink: HTMLLinkElement | null = null;
  private jsonLdScript: HTMLScriptElement | null = null;
  private sub: Subscription;

  listingState$: Observable<ListingState> = this.route.paramMap.pipe(
    switchMap(params => {
      const plate = params.get('plate') ?? '';
      // On a direct load the page carries its listing's display fields, so it
      // renders at once; the live listing (with the seller details Message
      // Seller needs) replaces it when Firestore answers.
      const prerendered = this.prerenderData.get<PrerenderedPlate>('plate', normalisePlate(plate));
      const initial: ListingState = prerendered
        ? { status: 'found', listing: prerendered }
        : { status: 'loading' };
      return this.plateListingService.getByPlate(plate).pipe(
        tap(listing => { if (listing) this.setSeoTags(listing); }),
        map(listing =>
          listing
            ? ({ status: 'found' as const, listing })
            : ({ status: 'not-found' as const })
        ),
        // When Firestore can't connect (as in some crawlers) it reports an empty
        // result from its offline cache rather than an error, so an embedded
        // listing is only replaced by a real one, never by "not found".
        filter(state => !(prerendered && state.status === 'not-found')),
        catchError(() => of(prerendered ? initial : { status: 'not-found' as const })),
        startWith(initial)
      );
    }),
    shareReplay({ bufferSize: 1, refCount: true })
  );

  meaningDescription$: Observable<string | null> = this.route.paramMap.pipe(
    switchMap(params => {
      const plate = params.get('plate') ?? '';
      const prerendered = this.prerenderData.get<PrerenderedPlate>('plate', normalisePlate(plate))?.meaningDescription ?? null;
      return this.plateListingService.getMeaningDescription(plate).pipe(
        map(description => description ?? prerendered),
        catchError(() => of(prerendered)),
        startWith(prerendered)
      );
    })
  );

  similarListings$: Observable<PlateListing[]> = this.listingState$.pipe(
    switchMap(state => state.status === 'found'
      ? this.plateListingService.getSimilar(state.listing).pipe(catchError(() => of([])))
      : of([]))
  );

  constructor() {
    this.sub = this.listingState$.subscribe();
  }

  formatInfo(listing: PlateListing): PlateFormatInfo | null {
    const format = plateFormat(listing.plateCharacters);
    return format ? PLATE_FORMAT_INFO[format] : null;
  }

  plateLink(listing: PlateListing): string[] {
    return ['/plates-for-sale', normalisePlate(listing.plateCharacters)];
  }

  private setSeoTags(listing: PlateListing): void {
    const plate = normalisePlate(listing.plateCharacters);
    const title = `${plate} Number Plate For Sale | MR Valuations`;
    const desc = `${plate} private number plate for sale at £${listing.askingPrice}${listing.meanings ? '. ' + listing.meanings : ''}. Contact the seller directly on MR Valuations.`;

    this.titleService.setTitle(title);
    this.metaService.updateTag({ name: 'description', content: desc });

    // Remove any pre-existing canonical (e.g. the static one in index.html)
    this.document.head.querySelector('link[rel="canonical"]')?.remove();

    this.canonicalLink?.remove();
    const link = this.document.createElement('link');
    link.setAttribute('rel', 'canonical');
    link.setAttribute('href', `https://mrvaluations.co.uk/plates-for-sale/${plate}/`);
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
        price: Number(listing.askingPrice) || 0,
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
    // Restore the root canonical removed during setSeoTags
    const rootCanonical = this.document.createElement('link');
    rootCanonical.setAttribute('rel', 'canonical');
    rootCanonical.setAttribute('href', 'https://mrvaluations.co.uk/');
    this.document.head.appendChild(rootCanonical);
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

  goBack(event: MouseEvent): void {
    event.preventDefault();
    event.stopPropagation();
    this.router.navigate(['/plates-for-sale'], { queryParams: { tab: 'buy' } });
  }

  onCopyLink(): void {
    navigator.clipboard.writeText(window.location.href);
    this.snackBar.open('Link copied to clipboard!', 'Close', { duration: 3000 });
  }
}
