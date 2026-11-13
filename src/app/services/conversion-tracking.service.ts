import { Injectable } from '@angular/core';

declare global {
  interface Window {
    gtag?: (...args: unknown[]) => void;
  }
}

/**
 * Sends funnel events to GA4 through the gtag snippet in index.html.
 *
 * Event names follow GA4's recommended events where one fits (sign_up,
 * begin_checkout, purchase, generate_lead, share) so they light up the
 * built-in reports; the rest are custom. Mark the ones that matter as key
 * events in GA4 → Admin → Events.
 *
 * Never throws: an ad blocker or a missing gtag must not break the app.
 */
@Injectable({ providedIn: 'root' })
export class ConversionTrackingService {
  /** source/article say where the plate was entered when it wasn't the homepage form. */
  valuationStarted(plateType: string, origin?: { source: string; article?: string }): void {
    this.send('valuation_start', { plate_type: plateType, ...(origin ?? {}) });
  }

  valuationCompleted(plateType: string, price: number): void {
    this.send('valuation_complete', { plate_type: plateType, value: Math.round(price), currency: 'GBP' });
  }

  signedUp(method: 'valuation_email' | 'manual'): void {
    this.send('sign_up', { method });
  }

  emailGateViewed(plateType: string): void {
    this.send('email_gate_view', { plate_type: plateType });
  }

  emailGateSubmitted(intent: 'email' | 'list', hasConsent: boolean, method: 'email' | 'google' = 'email'): void {
    this.send('email_gate_submit', { intent, has_consent: hasConsent, method });
  }

  valuationEmailCaptured(plateType: string): void {
    this.send('generate_lead', { lead_source: 'valuation_email', plate_type: plateType });
  }

  listNowClicked(loggedIn: boolean): void {
    this.send('list_now_click', { logged_in: loggedIn });
  }

  /** "Would you sell at this price?" on a revealed valuation. */
  sellIntentAnswered(answer: 'yes' | 'later' | 'curious', plateType: string, reason?: string): void {
    this.send('sell_intent', { answer, plate_type: plateType, ...(reason ? { reason } : {}) });
  }

  plateMeaningGiven(category: string, hasText: boolean, plateType: string): void {
    this.send('plate_meaning', { category, has_text: hasText, plate_type: plateType });
  }

  listPreviewPublishClicked(hasVoucher: boolean): void {
    this.send('list_preview_publish', { has_voucher: hasVoucher });
  }

  listPlateViewed(source: 'valuation' | 'email_link' | 'nudge' | 'direct'): void {
    this.send('list_plate_view', { source });
  }

  checkoutStarted(feePounds: number, hasVoucher: boolean): void {
    this.send('begin_checkout', { value: feePounds, currency: 'GBP', has_voucher: hasVoucher });
  }

  listingPurchased(sessionId: string, valuePounds: number): void {
    this.send('purchase', { transaction_id: sessionId, value: valuePounds, currency: 'GBP' });
  }

  /** A plate listed for free; the seller pays later, per enquiry. */
  freeListingCreated(): void {
    this.send('listing_created', { pricing_model: 'enquiry' });
  }

  /** A signed-out visitor sent the form; the listing waits for their email link. */
  pendingListingCreated(): void {
    this.send('listing_pending', { pricing_model: 'enquiry' });
  }

  /** The email link published a pending listing. */
  pendingListingConfirmed(): void {
    this.send('listing_created', { pricing_model: 'enquiry', via: 'email_link' });
  }

  unlockStarted(feePounds: number): void {
    this.send('begin_checkout', { value: feePounds, currency: 'GBP', checkout_type: 'unlock' });
  }

  enquirySent(enquiryType: string): void {
    this.send('generate_lead', { lead_source: 'seller_enquiry', enquiry_type: enquiryType });
  }

  shared(method: 'native' | 'whatsapp' | 'facebook' | 'copy'): void {
    this.send('share', { method, content_type: 'valuation' });
  }

  private send(event: string, params: Record<string, unknown>): void {
    try {
      window.gtag?.('event', event, params);
    } catch {
      // Analytics is best-effort.
    }
  }
}
