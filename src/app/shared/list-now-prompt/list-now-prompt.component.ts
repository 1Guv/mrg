import { Component, computed, effect, inject, input, signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { DatePipe, DecimalPipe } from '@angular/common';
import { Router } from '@angular/router';
import { MatButtonModule } from '@angular/material/button';
import { PlateListingCardComponent } from '../plate-listing-card/plate-listing-card.component';
import { PlateListing } from '../../models/plate-listing.model';
import { AuthService } from '../../services/auth.service';
import { ConversionTrackingService } from '../../services/conversion-tracking.service';
import { FormsModule } from '@angular/forms';
import {
  ListNowService, MeaningCategory, PlateMeaning, ResultVoucher, SellIntent
} from '../../services/list-now.service';
import { PlateListingService } from '../../services/plate-listing.service';
import { ValuationGateService } from '../../services/valuation-gate.service';

/**
 * Sits under a revealed valuation in place of a bare "List Now" button:
 * real buyer demand, "Would you sell at this price?", and on "Yes" the
 * visitor's listing ready to publish, with their 48-hour 10% voucher.
 */
@Component({
  selector: 'app-list-now-prompt',
  standalone: true,
  imports: [DatePipe, DecimalPipe, FormsModule, MatButtonModule, PlateListingCardComponent],
  templateUrl: './list-now-prompt.component.html',
  styleUrl: './list-now-prompt.component.scss'
})
export class ListNowPromptComponent {
  private router = inject(Router);
  private listNow = inject(ListNowService);
  private tracking = inject(ConversionTrackingService);
  private gate = inject(ValuationGateService);
  private user = toSignal(inject(AuthService).currentUser$, { initialValue: null });
  readonly fee = inject(PlateListingService).listingFee;

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

  readonly answer = signal<SellIntent | null>(null);
  readonly demand = signal(0);
  readonly voucher = signal<ResultVoucher | null>(null);

  readonly plate = computed(() => this.registration().replace(/\s/g, '').toUpperCase());
  /** The asking price the preview suggests, to the nearest £10. */
  readonly askingPrice = computed(() => Math.max(10, Math.round(this.price() / 10) * 10));
  readonly discountedFee = computed(() => {
    const v = this.voucher();
    return v ? Math.round(this.fee * (100 - v.percentOff)) / 100 : this.fee;
  });

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
      this.answer.set(this.listNow.answer(reg));
      const saved = this.listNow.meaning(reg);
      this.meaning.set(saved);
      this.meaningCategory.set(saved?.category ?? null);
      this.meaningText = saved?.text ?? '';
      this.demand.set(0);
      this.voucher.set(null);
      this.listNow.buyerDemand(reg).then(n => { if (reg === this.plate()) this.demand.set(n); });
      this.listNow.voucher(reg).then(v => { if (reg === this.plate()) this.voucher.set(v); });
    });
  }

  choose(answer: SellIntent): void {
    this.answer.set(answer);
    this.tracking.sellIntentAnswered(answer, this.plateType());
    this.listNow.recordAnswer(this.plate(), answer);
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

  publish(): void {
    this.tracking.listPreviewPublishClicked(!!this.voucher());
    this.goToListing(this.askingPrice());
  }

  /** "List now anyway" after Maybe later / Just curious: the valuation as is. */
  listAnyway(): void {
    this.goToListing(this.price());
  }

  private goToListing(price: number): void {
    this.tracking.listNowClicked(this.gate.loggedIn());
    this.router.navigate(['/list-plate'], {
      queryParams: {
        plate: this.plate(),
        price: price.toFixed(2),
        min: this.minPrice().toFixed(2),
        max: this.maxPrice().toFixed(2),
        ...(this.meaning()?.text ? { meaning: this.meaning()!.text } : {}),
        ...this.listNow.voucherParams(this.voucher()),
      },
    });
  }

  private initials(): string {
    const name = this.user()?.displayName?.trim();
    if (!name) return 'ME';
    return name.split(/\s+/).map(w => w[0]).join('').slice(0, 3).toUpperCase();
  }
}
