import { Component, inject, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatButtonModule } from '@angular/material/button';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatDialogModule, MatDialog } from '@angular/material/dialog';
import { ActivatedRoute, Router, RouterModule } from '@angular/router';
import { take } from 'rxjs';
import { AuthService } from '../../services/auth.service';
import { PayPerEnquiryService } from '../../services/pay-per-enquiry.service';
import { EmailLinkSignInService } from '../../services/email-link-sign-in.service';
import { ConversionTrackingService } from '../../services/conversion-tracking.service';
import { PlateListingService } from '../../services/plate-listing.service';
import { feeShare } from '../../utils/fee-share';
import { AuthPromptDialogComponent, AuthPromptDialogData } from '../../shared/auth-prompt-dialog/auth-prompt-dialog.component';
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
    MatDialogModule,
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
  private dialog = inject(MatDialog);
  plateListingService = inject(PlateListingService);
  private route = inject(ActivatedRoute);
  private emailLink = inject(EmailLinkSignInService);

  form: FormGroup = this.fb.group({
    plateCharacters: ['', [Validators.required, Validators.minLength(2), Validators.maxLength(8)]],
    askingPrice: ['', [Validators.required, Validators.min(1)]],
    phone: ['', Validators.required],
    email: ['', [Validators.required, Validators.email]],
    initials: ['', [Validators.required, Validators.maxLength(3)]],
    meanings: [''],
    negotiable: [false],
  });

  loading = false;
  errorMessage = '';
  valuationMin: number | null = null;
  valuationMax: number | null = null;

  /** "3%": the fee against the asking price as they type it. */
  get feeShare(): string | null {
    return feeShare(this.plateListingService.listingFee, Number(this.form.value.askingPrice));
  }

  ngOnInit(): void {
    const params = this.route.snapshot.queryParams;
    const prefill: Record<string, string> = {};
    if (params['plate']) prefill['plateCharacters'] = String(params['plate']).toUpperCase();
    if (params['price']) prefill['askingPrice'] = String(params['price']);
    if (params['meaning']) prefill['meanings'] = String(params['meaning']).slice(0, 80);
    if (Object.keys(prefill).length) this.form.patchValue(prefill);
    const minVal = Number(params['min']);
    if (!isNaN(minVal) && minVal > 0) this.valuationMin = minVal;
    const maxVal = Number(params['max']);
    if (!isNaN(maxVal) && maxVal > 0) this.valuationMax = maxVal;

    const source = this.emailLink.hasLinkInUrl() ? 'email_link' :
      params['from'] === 'result' ? 'valuation' :
      params['voucher'] ? 'nudge' :
      params['plate'] ? 'valuation' : 'direct';
    this.tracking.listPlateViewed(source);

    // A sign-in link in the URL is still being redeemed; wait so the visitor
    // isn't asked to log in while that happens.
    this.emailLink.ready.then(() => this.promptIfSignedOut());
  }

  private promptIfSignedOut(): void {
    this.authService.currentUser$.pipe(take(1)).subscribe(user => {
      if (!user) {
        this.dialog.open(AuthPromptDialogComponent, {
          width: '380px',
          data: {
            title: 'Sign in to list your plate',
            message: 'You need to be logged in to list a plate for sale. Please log in or create a free account to continue.',
            offerEmailLink: true,
          } satisfies AuthPromptDialogData,
        });
      } else {
        this.form.patchValue({ email: user.email ?? '' });
        if (!this.form.value.initials) this.form.patchValue({ initials: this.initialsOf(user.displayName) });
      }
    });
  }

  private initialsOf(name: string | null | undefined): string {
    const words = (name ?? '').trim().split(/\s+/).filter(Boolean);
    return words.map(w => w[0]).join('').slice(0, 3).toUpperCase();
  }

  async onSubmit(): Promise<void> {
    if (this.form.invalid) return;
    this.loading = true;
    this.errorMessage = '';
    try {
      const listing = await this.payPerEnquiry.createFreeListing({
        plateCharacters: this.form.value.plateCharacters.toUpperCase(),
        askingPrice: String(this.form.value.askingPrice),
        phone: this.form.value.phone,
        initials: this.form.value.initials.toUpperCase(),
        meanings: this.form.value.meanings ?? '',
        negotiable: this.form.value.negotiable ?? false,
      });
      this.tracking.freeListingCreated();
      this.router.navigate(['/list-plate/success'], { queryParams: { plate: listing.plateCharacters } });
    } catch (err) {
      // The listing limit and duplicate checks explain themselves.
      const code = (err as { code?: string }).code ?? '';
      this.errorMessage = /resource-exhausted|already-exists/.test(code) ?
        (err as Error).message :
        'Something went wrong. Please try again.';
      this.loading = false;
    }
  }
}
