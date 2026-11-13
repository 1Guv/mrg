import { Component, computed, effect, inject, input, signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { DecimalPipe } from '@angular/common';
import { Router } from '@angular/router';
import { MatButtonModule } from '@angular/material/button';
import { MatDialog } from '@angular/material/dialog';
import { PlateListingCardComponent } from '../plate-listing-card/plate-listing-card.component';
import { PlateListing } from '../../models/plate-listing.model';
import { AdminsService } from '../../services/admins.service';
import { AuthService } from '../../services/auth.service';
import { ConversionTrackingService } from '../../services/conversion-tracking.service';
import { FormsModule } from '@angular/forms';
import { ListNowService, MeaningCategory, PlateMeaning } from '../../services/list-now.service';
import { PayPerEnquiryService } from '../../services/pay-per-enquiry.service';
import { PlateListingService } from '../../services/plate-listing.service';
import { ValuationGateService } from '../../services/valuation-gate.service';
import { feeShare } from '../../utils/fee-share';
import { StatsStripComponent } from '../stats-strip/stats-strip.component';
import { NotNowDialogComponent, NotNowDialogData, NotNowDialogResult } from '../not-now-dialog/not-now-dialog.component';
import {
  ListingCheckInboxData, ListingCheckInboxDialogComponent
} from '../listing-check-inbox-dialog/listing-check-inbox-dialog.component';

/**
 * Sits under a revealed valuation's price: the visitor's listing, already
 * filled in and shown as buyers will see it, with the asking price theirs to
 * change and one tap to publish it free. "Not now" asks why, so we learn
 * what stops people listing.
 */
@Component({
  selector: 'app-list-now-prompt',
  standalone: true,
  imports: [DecimalPipe, FormsModule, MatButtonModule, PlateListingCardComponent, StatsStripComponent],
  templateUrl: './list-now-prompt.component.html',
  styleUrl: './list-now-prompt.component.scss'
})
export class ListNowPromptComponent {
  private router = inject(Router);
  private listNow = inject(ListNowService);
  private tracking = inject(ConversionTrackingService);
  private gate = inject(ValuationGateService);
  private payPerEnquiry = inject(PayPerEnquiryService);
  private dialog = inject(MatDialog);
  private user = toSignal(inject(AuthService).currentUser$, { initialValue: null });
  readonly fee = inject(PlateListingService).listingFee;
  readonly isAdmin = inject(AdminsService).currentUserIsAdmin;

  readonly registration = input.required<string>();
  readonly plateType = input.required<string>();
  readonly price = input.required<number>();
  readonly minPrice = input.required<number>();
  readonly maxPrice = input.required<number>();

  readonly meaningCategories: { value: MeaningCategory; label: string; example: string }[] = [
    { value: 'name', label: 'Name / initials', example: 'e.g. Yolanda\'s initials' },
    { value: 'word', label: 'Word', example: 'e.g. spells BOSS' },
    { value: 'car', label: 'Car / model', example: 'e.g. Porsche 911' },
    { value: 'business', label: 'Business', example: 'e.g. Smith Plumbing' },
    { value: 'date', label: 'Date / age', example: 'e.g. born 1985' },
    { value: 'other', label: 'Other', example: 'e.g. lucky number' },
  ];

  /** The chip tapped, before the meaning is saved. */
  readonly meaningCategory = signal<MeaningCategory | null>(null);
  meaningText = '';
  /** Saved for this plate this session; pre-fills the preview and the listing. */
  readonly meaning = signal<PlateMeaning | null>(null);
  readonly meaningExample = computed(() =>
    this.meaningCategories.find(c => c.value === this.meaningCategory())?.example ?? '');

  readonly demand = signal(0);
  readonly publishing = signal(false);
  readonly errorMessage = signal('');
  /** Set once a signed-out visitor's listing is waiting for its emailed link. */
  readonly pendingEmail = signal<string | null>(null);

  readonly plate = computed(() => this.registration().replace(/\s/g, '').toUpperCase());
  /** The valuation to the nearest £10, until the visitor sets their own price. */
  private readonly suggestedPrice = computed(() => Math.max(10, Math.round(this.price() / 10) * 10));
  private readonly ownPrice = signal<number | null>(null);
  readonly askingPrice = computed(() => this.ownPrice() ?? this.suggestedPrice());
  /** "3%": the fee against the asking price the preview suggests. */
  readonly feeShare = computed(() => feeShare(this.fee, this.askingPrice()));

  readonly preview = computed<PlateListing>(() => ({
    id: 0,
    initials: this.initials(),
    profiletPicUrl: '',
    profiletPicInitials: true,
    createdDate: new Date().toISOString(),
    plateCharacters: this.plate(),
    askingPrice: this.askingPrice().toLocaleString('en-GB'),
    plateNegotiable: false,
    plateBestOffer: false,
    offersOver: false,
    orNearestOffer: false,
    meanings: this.meaning()?.text ?? '',
    viewsPlaceholder: 0,
    messageSeller: '',
    plateType: this.plateType(),
    plateCategory: '',
    isSold: false,
    soldPrice: null,
  }));

  constructor() {
    effect(() => {
      const reg = this.plate();
      this.ownPrice.set(null);
      this.pendingEmail.set(null);
      const saved = this.listNow.meaning(reg);
      this.meaning.set(saved);
      this.meaningCategory.set(saved?.category ?? null);
      this.meaningText = saved?.text ?? '';
      this.demand.set(0);
      this.listNow.buyerDemand(reg).then(n => { if (reg === this.plate()) this.demand.set(n); });
    });
  }

  setAskingPrice(value: number | string | null): void {
    const price = Math.round(Number(value));
    this.ownPrice.set(Number.isFinite(price) && price >= 1 ? price : null);
  }

  saveMeaning(): void {
    const category = this.meaningCategory();
    if (!category) return;
    const meaning = { category, text: this.meaningText.trim().slice(0, 80) };
    this.meaning.set(meaning);
    this.tracking.plateMeaningGiven(category, !!meaning.text, this.plateType());
    this.listNow.recordMeaning(this.plate(), meaning);
  }

  editMeaning(): void {
    this.meaning.set(null);
  }

  /** One tap: signed in, it's live; otherwise the emailed link publishes it. */
  async publish(price = this.askingPrice()): Promise<void> {
    if (this.publishing()) return;
    this.ownPrice.set(price);
    this.publishing.set(true);
    this.errorMessage.set('');
    this.tracking.sellIntentAnswered('yes', this.plateType());
    this.listNow.recordAnswer(this.plate(), 'yes');
    this.tracking.listPreviewPublishClicked(false);
    this.tracking.listNowClicked(this.gate.loggedIn());
    const listing = {
      plateCharacters: this.plate(),
      askingPrice: String(price),
      phone: '',
      initials: this.user()?.displayName ? this.initials() : '',
      meanings: this.meaning()?.text ?? '',
      negotiable: false,
    };
    try {
      if (this.user()) {
        const created = await this.payPerEnquiry.createFreeListing(listing);
        this.tracking.freeListingCreated();
        this.router.navigate(['/list-plate/success'], { queryParams: { plate: created.plateCharacters } });
        return;
      }
      const email = this.gate.givenEmail();
      if (!email) {
        this.editDetails();
        return;
      }
      const { pendingId } = await this.payPerEnquiry.createPendingListing({ ...listing, email });
      this.tracking.pendingListingCreated();
      this.pendingEmail.set(email);
      this.dialog.open<ListingCheckInboxDialogComponent, ListingCheckInboxData>(ListingCheckInboxDialogComponent, {
        width: '420px', maxWidth: '94vw',
        data: { email, plate: this.plate(), askingPrice: price, pendingId },
      });
    } catch (err) {
      this.errorMessage.set(this.messageFor(err));
    } finally {
      this.publishing.set(false);
    }
  }

  notNow(): void {
    const data: NotNowDialogData = {
      plate: this.plate(), plateType: this.plateType(), askingPrice: this.askingPrice(), fee: this.fee,
    };
    this.dialog.open<NotNowDialogComponent, NotNowDialogData, NotNowDialogResult>(
      NotNowDialogComponent, { width: '420px', maxWidth: '94vw', data }
    ).afterClosed().subscribe(result => {
      if (result) this.publish(result.publishAt);
    });
  }

  /** The full form, for a phone number, "negotiable" and the rest. */
  editDetails(): void {
    this.router.navigate(['/list-plate'], {
      queryParams: {
        plate: this.plate(),
        price: this.askingPrice().toFixed(2),
        min: this.minPrice().toFixed(2),
        max: this.maxPrice().toFixed(2),
        ...(this.meaning()?.text ? { meaning: this.meaning()!.text } : {}),
      },
    });
  }

  /** The server's own messages explain themselves; anything else is unexpected. */
  private messageFor(err: unknown): string {
    const code = (err as { code?: string }).code ?? '';
    return /invalid-argument|resource-exhausted|already-exists|not-found|permission-denied/.test(code) ?
      (err as Error).message :
      'Something went wrong. Please try again.';
  }

  private initials(): string {
    const name = this.user()?.displayName?.trim();
    if (!name) return 'ME';
    return name.split(/\s+/).map(w => w[0]).join('').slice(0, 3).toUpperCase();
  }
}
