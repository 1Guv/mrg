import { computed, inject, Injectable, signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { Auth, signInWithCustomToken } from '@angular/fire/auth';
import { Functions, httpsCallable } from '@angular/fire/functions';
import { environment } from '../../environments/environment';
import { RegValuation } from '../models/reg.model';
import { AuthService } from './auth.service';
import { EmailLinkSignInService } from './email-link-sign-in.service';

export interface ValuationEmailRequest {
  firstName: string;
  email: string;
  marketingConsent: boolean;
  intent: 'email' | 'list';
  registration: string;
  type: string;
  price: number;
  minPrice: number;
  maxPrice: number;
  valuation?: RegValuation;
}

export interface ValuationEmailResult {
  /** A new account was made for this email. */
  created: boolean;
  /** The visitor is now signed in on this device. */
  signedIn: boolean;
}

/**
 * The value-first email gate: the valuation range is free, the exact figure
 * unlocks once the visitor is signed in or has given an email this session.
 */
@Injectable({ providedIn: 'root' })
export class ValuationGateService {
  private auth = inject(Auth);
  private functions = inject(Functions);
  private authService = inject(AuthService);
  private emailLink = inject(EmailLinkSignInService);

  private user = toSignal(this.authService.currentUser$, { initialValue: null });
  private emailGiven = signal(false);

  readonly unlocked = computed(() => !!this.user() || this.emailGiven());
  readonly loggedIn = computed(() => !!this.user());

  async captureEmail(request: ValuationEmailRequest): Promise<ValuationEmailResult> {
    type Payload = Omit<ValuationEmailRequest, 'valuation'> & { valuation?: Record<string, unknown>; appBaseUrl: string };
    const fn = httpsCallable<Payload, { created: boolean; customToken?: string }>(
      this.functions,
      'captureValuationEmail'
    );
    const { data } = await fn({ ...request, valuation: this.plain(request.valuation), appBaseUrl: environment.appBaseUrl });

    // The emailed link may be opened on this device; remember the address so
    // Firebase doesn't have to ask for it again.
    this.emailLink.rememberEmail(request.email);
    this.emailGiven.set(true);

    if (data.customToken) {
      await signInWithCustomToken(this.auth, data.customToken);
      return { created: data.created, signedIn: true };
    }
    return { created: data.created, signedIn: false };
  }

  // Callables only accept JSON; drop Dates and undefined.
  private plain(valuation?: RegValuation): Record<string, unknown> | undefined {
    return valuation ? JSON.parse(JSON.stringify(valuation)) : undefined;
  }
}
