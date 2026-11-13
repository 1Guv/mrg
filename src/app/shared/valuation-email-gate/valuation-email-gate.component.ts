import { Component, inject, Input, OnInit, signal } from '@angular/core';
import { DecimalPipe } from '@angular/common';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { RegValuation } from '../../models/reg.model';
import { ConversionTrackingService } from '../../services/conversion-tracking.service';
import { AuthService } from '../../services/auth.service';
import { ValuationGateService } from '../../services/valuation-gate.service';
import { StatsStripComponent } from '../stats-strip/stats-strip.component';

/**
 * Shown under a valuation for visitors who are not signed in: the range is
 * free, the exact figure costs an email, or one tap on "Continue with
 * Google". Once given, ValuationGateService.unlocked() flips and the parent
 * swaps this out for the full result, which is the visitor's listing ready
 * to publish.
 */
@Component({
  selector: 'app-valuation-email-gate',
  standalone: true,
  imports: [
    StatsStripComponent,
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
  private authService = inject(AuthService);

  form = this.fb.nonNullable.group({
    email: ['', [Validators.required, Validators.email]],
    marketingConsent: [false],
  });

  sending = signal(false);
  errorMessage = signal('');

  ngOnInit(): void {
    this.tracking.emailGateViewed(this.plateType);
  }

  async onSubmit(): Promise<void> {
    if (this.form.invalid || this.sending()) return;
    const { email, marketingConsent } = this.form.getRawValue();
    this.tracking.emailGateSubmitted('email', marketingConsent);
    await this.capture(email.trim(), '', marketingConsent);
  }

  /** One tap, no typing; Google confirms the email, so they're signed in too. */
  async continueWithGoogle(): Promise<void> {
    if (this.sending()) return;
    this.errorMessage.set('');
    let email = '';
    let firstName = '';
    try {
      const { user } = await this.authService.loginWithGoogle();
      email = user.email ?? '';
      firstName = (user.displayName ?? '').trim().split(/\s+/)[0] ?? '';
    } catch (err: unknown) {
      const code = (err as { code?: string })?.code ?? '';
      if (!code.endsWith('popup-closed-by-user') && !code.endsWith('cancelled-popup-request')) {
        this.errorMessage.set("Google sign-in didn't work. Try your email instead.");
      }
      return;
    }
    const { marketingConsent } = this.form.getRawValue();
    this.tracking.emailGateSubmitted('email', marketingConsent, 'google');
    // Signed in, so the result is already showing; this saves and emails it.
    if (email) await this.capture(email, firstName, marketingConsent);
  }

  private async capture(email: string, firstName: string, marketingConsent: boolean): Promise<void> {
    this.sending.set(true);
    this.errorMessage.set('');
    try {
      const { created } = await this.gate.captureEmail({
        firstName,
        email,
        marketingConsent,
        intent: 'email',
        registration: this.registration.replace(/\s/g, '').toUpperCase(),
        type: this.plateType,
        price: this.price,
        minPrice: this.minPrice,
        maxPrice: this.maxPrice,
        valuation: this.valuation,
      });
      this.tracking.valuationEmailCaptured(this.plateType);
      if (created) this.tracking.signedUp('valuation_email');
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
