import { Component, inject, Input, OnInit, signal } from '@angular/core';
import { DecimalPipe } from '@angular/common';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { MatDialog } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { Router } from '@angular/router';
import { RegValuation } from '../../models/reg.model';
import { ConversionTrackingService } from '../../services/conversion-tracking.service';
import { PlateListingService } from '../../services/plate-listing.service';
import { ValuationGateService } from '../../services/valuation-gate.service';
import { CheckInboxDialogComponent } from './check-inbox-dialog.component';

/**
 * Shown under a valuation for visitors who are not signed in: the range is
 * free, the exact figure (and a one-click "List it" email) costs a first name
 * and an email. Once given, ValuationGateService.unlocked() flips and the
 * parent swaps this out for the full result.
 */
@Component({
  selector: 'app-valuation-email-gate',
  standalone: true,
  imports: [
    DecimalPipe,
    ReactiveFormsModule,
    MatButtonModule,
    MatCardModule,
    MatCheckboxModule,
    MatFormFieldModule,
    MatInputModule,
    MatProgressSpinnerModule,
  ],
  templateUrl: './valuation-email-gate.component.html',
  styleUrl: './valuation-email-gate.component.scss'
})
export class ValuationEmailGateComponent implements OnInit {
  @Input({ required: true }) registration = '';
  @Input({ required: true }) plateType = '';
  @Input({ required: true }) price = 0;
  @Input({ required: true }) minPrice = 0;
  @Input({ required: true }) maxPrice = 0;
  @Input() valuation?: RegValuation;

  /**
   * Stands in for the price behind the blur, so the real figure is never in
   * the page. Same number of digits as the price, which the range gives away.
   */
  get lockedFigure(): string {
    const digits = Math.max(1, String(Math.round(this.price)).length);
    return Number('8'.repeat(digits)).toLocaleString('en-GB');
  }

  private fb = inject(FormBuilder);
  private gate = inject(ValuationGateService);
  private tracking = inject(ConversionTrackingService);
  private dialog = inject(MatDialog);
  private router = inject(Router);
  plateListingService = inject(PlateListingService);

  form = this.fb.nonNullable.group({
    firstName: ['', [Validators.required, Validators.maxLength(50)]],
    email: ['', [Validators.required, Validators.email]],
    marketingConsent: [false],
  });

  intent = signal<'email' | 'list'>('email');
  sending = signal(false);
  errorMessage = signal('');

  ngOnInit(): void {
    this.tracking.emailGateViewed(this.plateType);
  }

  chooseList(): void {
    this.tracking.listNowClicked(false);
    this.intent.set('list');
  }

  private listPath(): string {
    const params = new URLSearchParams({
      plate: this.registration.replace(/\s/g, '').toUpperCase(),
      price: this.price.toFixed(2),
      min: this.minPrice.toFixed(2),
      max: this.maxPrice.toFixed(2),
    });
    return `/list-plate?${params}`;
  }

  async onSubmit(): Promise<void> {
    if (this.form.invalid || this.sending()) return;
    this.sending.set(true);
    this.errorMessage.set('');
    const { firstName, email, marketingConsent } = this.form.getRawValue();
    const intent = this.intent();
    this.tracking.emailGateSubmitted(intent, marketingConsent);

    try {
      const { signedIn, created } = await this.gate.captureEmail({
        firstName: firstName.trim(),
        email: email.trim(),
        marketingConsent,
        intent,
        registration: this.registration.replace(/\s/g, '').toUpperCase(),
        type: this.plateType,
        price: this.price,
        minPrice: this.minPrice,
        maxPrice: this.maxPrice,
        valuation: this.valuation,
      });
      this.tracking.valuationEmailCaptured(this.plateType);
      if (created) this.tracking.signedUp('valuation_email');

      if (intent === 'list') {
        // Navigate from here: unlocking removes this component from the page.
        if (signedIn) {
          this.router.navigateByUrl(this.listPath());
        } else {
          // Existing account (or no token issued): the emailed link is the way in.
          this.dialog.open(CheckInboxDialogComponent, {
            width: '400px',
            data: { email: email.trim(), registration: this.registration.toUpperCase(), listPath: this.listPath() },
          });
        }
      }
    } catch (err: unknown) {
      const code = (err as { code?: string })?.code ?? '';
      this.errorMessage.set(code.endsWith('resource-exhausted') ?
        'Too many attempts. Please try again in an hour.' :
        'Something went wrong. Please check your email address and try again.');
    } finally {
      this.sending.set(false);
    }
  }
}
