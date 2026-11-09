import { Component, inject, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatButtonModule } from '@angular/material/button';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { ActivatedRoute, Router, RouterModule } from '@angular/router';
import { take } from 'rxjs';
import { AuthService } from '../../services/auth.service';
import { PayPerEnquiryService } from '../../services/pay-per-enquiry.service';
import { EmailLinkSignInService } from '../../services/email-link-sign-in.service';
import { ConversionTrackingService } from '../../services/conversion-tracking.service';
import { PlateListingService } from '../../services/plate-listing.service';
import { feeShare } from '../../utils/fee-share';
import { StatsStripComponent } from '../../shared/stats-strip/stats-strip.component';

@Component({
  selector: 'app-list-plate',
  standalone: true,
  imports: [
    StatsStripComponent,
    CommonModule,
    ReactiveFormsModule,
    MatFormFieldModule,
    MatInputModule,
    MatButtonModule,
    MatCheckboxModule,
    MatProgressSpinnerModule,
    RouterModule,
  ],
  templateUrl: './list-plate.component.html',
  styleUrl: './list-plate.component.scss'
})
export class ListPlateComponent implements OnInit {
  private fb = inject(FormBuilder);
  private authService = inject(AuthService);
  private payPerEnquiry = inject(PayPerEnquiryService);
  private router = inject(Router);
  private tracking = inject(ConversionTrackingService);
  plateListingService = inject(PlateListingService);
  private route = inject(ActivatedRoute);
  private emailLink = inject(EmailLinkSignInService);

  form: FormGroup = this.fb.group({
    plateCharacters: ['', [Validators.required, Validators.minLength(2), Validators.maxLength(8), Validators.pattern(/^[A-Za-z0-9 ]+$/)]],
    askingPrice: ['', [Validators.required, Validators.min(1)]],
    // Optional: without one, buyers message through the site only
    phone: ['', Validators.pattern(/^\+?[\d\s()-]{7,20}$/)],
    email: ['', [Validators.required, Validators.email]],
    meanings: [''],
    negotiable: [false],
  });

  /** form, or a step of listing by email link for visitors who aren't signed in. */
  step: 'form' | 'checkInbox' | 'confirming' | 'linkExpired' = 'form';
  signedIn = false;
  loading = false;
  errorMessage = '';
  resent = false;
  valuationMin: number | null = null;
  valuationMax: number | null = null;
  private initials = '';
  private pendingId = '';

  /** "3%": the fee against the asking price as they type it. */
  get feeShare(): string | null {
    return feeShare(this.plateListingService.listingFee, Number(this.form.value.askingPrice));
  }

  get loginLink(): { returnUrl: string } {
    return { returnUrl: this.router.url };
  }

  ngOnInit(): void {
    const params = this.route.snapshot.queryParams;
    const prefill: Record<string, string> = {};
    if (params['plate']) prefill['plateCharacters'] = String(params['plate']).toUpperCase();
    const price = Math.round(Number(params['price']));
    if (price > 0) prefill['askingPrice'] = String(price);
    if (params['meaning']) prefill['meanings'] = String(params['meaning']).slice(0, 80);
    if (Object.keys(prefill).length) this.form.patchValue(prefill);
    const minVal = Number(params['min']);
    if (!isNaN(minVal) && minVal > 0) this.valuationMin = minVal;
    const maxVal = Number(params['max']);
    if (!isNaN(maxVal) && maxVal > 0) this.valuationMax = maxVal;

    this.pendingId = String(params['pending'] ?? '');
    if (this.pendingId) this.step = 'confirming';

    const source = this.emailLink.hasLinkInUrl() ? 'email_link' :
      params['from'] === 'result' ? 'valuation' :
      params['voucher'] ? 'nudge' :
      params['plate'] ? 'valuation' : 'direct';
    this.tracking.listPlateViewed(source);

    // A sign-in link in the URL is still being redeemed; wait for it.
    this.emailLink.ready.then(() => this.authService.currentUser$.pipe(take(1)).subscribe(user => {
      this.signedIn = !!user;
      if (user) {
        this.form.patchValue({ email: user.email ?? '' });
        this.initials = this.initialsOf(user.displayName);
      }
      if (this.pendingId) {
        if (user) this.confirmPending(); else this.step = 'linkExpired';
      }
    }));
  }

  private initialsOf(name: string | null | undefined): string {
    const words = (name ?? '').trim().split(/\s+/).filter(Boolean);
    return words.map(w => w[0]).join('').slice(0, 3).toUpperCase();
  }

  async onSubmit(): Promise<void> {
    if (this.form.invalid) return;
    this.loading = true;
    this.errorMessage = '';
    const listing = {
      plateCharacters: this.form.value.plateCharacters.toUpperCase(),
      askingPrice: String(this.form.value.askingPrice),
      phone: this.form.value.phone ?? '',
      initials: this.initials,
      meanings: this.form.value.meanings ?? '',
      negotiable: this.form.value.negotiable ?? false,
    };
    try {
      if (this.signedIn) {
        const created = await this.payPerEnquiry.createFreeListing(listing);
        this.tracking.freeListingCreated();
        this.router.navigate(['/list-plate/success'], { queryParams: { plate: created.plateCharacters } });
        return;
      }
      const email = this.form.value.email.trim();
      const pending = await this.payPerEnquiry.createPendingListing({ ...listing, email });
      // The link then signs them in without asking for their email again.
      this.emailLink.rememberEmail(email);
      this.pendingId = pending.pendingId;
      this.tracking.pendingListingCreated();
      this.step = 'checkInbox';
    } catch (err) {
      this.errorMessage = this.messageFor(err);
    }
    this.loading = false;
  }

  async resend(): Promise<void> {
    this.loading = true;
    this.errorMessage = '';
    try {
      await this.payPerEnquiry.resendPendingListing(this.pendingId);
      this.resent = true;
    } catch (err) {
      this.errorMessage = this.messageFor(err);
    }
    this.loading = false;
  }

  /** Back to the form, e.g. to fix a mistyped email. */
  editListing(): void {
    this.step = 'form';
    this.resent = false;
    this.errorMessage = '';
  }

  private async confirmPending(): Promise<void> {
    try {
      const listing = await this.payPerEnquiry.confirmPendingListing(this.pendingId);
      this.tracking.pendingListingConfirmed();
      this.router.navigate(['/list-plate/success'], { queryParams: { plate: listing.plateCharacters } });
    } catch (err) {
      this.step = 'form';
      this.errorMessage = this.messageFor(err);
    }
  }

  /** The server's own messages explain themselves; anything else is unexpected. */
  private messageFor(err: unknown): string {
    const code = (err as { code?: string }).code ?? '';
    return /invalid-argument|resource-exhausted|already-exists|not-found|permission-denied/.test(code) ?
      (err as Error).message :
      'Something went wrong. Please try again.';
  }
}
