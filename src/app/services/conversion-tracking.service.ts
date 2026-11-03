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
  valuationStarted(plateType: string): void {
    this.send('valuation_start', { plate_type: plateType });
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

  emailGateSubmitted(intent: 'email' | 'list', hasConsent: boolean): void {
    this.send('email_gate_submit', { intent, has_consent: hasConsent });
  }

  valuationEmailCaptured(plateType: string): void {
    this.send('generate_lead', { lead_source: 'valuation_email', plate_type: plateType });
  }

  listNowClicked(loggedIn: boolean): void {
    this.send('list_now_click', { logged_in: loggedIn });
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
