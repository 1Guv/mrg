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

  signedUp(method: 'valuation_dialog' | 'manual'): void {
    this.send('sign_up', { method });
  }

  checkoutStarted(feePounds: number, hasVoucher: boolean): void {
    this.send('begin_checkout', { value: feePounds, currency: 'GBP', has_voucher: hasVoucher });
  }

  listingPurchased(sessionId: string): void {
    this.send('purchase', { transaction_id: sessionId, currency: 'GBP' });
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
