import { inject, Injectable } from '@angular/core';
import { Functions, httpsCallable } from '@angular/fire/functions';
import { environment } from '../../environments/environment';

export interface ListingForm {
  plateCharacters: string;
  askingPrice: string;
  /** Optional; without one, buyers message through the site only. */
  phone: string;
  initials: string;
  meanings: string;
  negotiable: boolean;
}

/**
 * Free listings, and the one-off payment that unlocks a free listing's
 * enquiries. A signed-in seller's email comes from their account, not the form.
 */
@Injectable({ providedIn: 'root' })
export class PayPerEnquiryService {
  private functions = inject(Functions);

  async createFreeListing(data: ListingForm): Promise<{ listingId: string; plateCharacters: string }> {
    const fn = httpsCallable<ListingForm, { listingId: string; plateCharacters: string }>(
      this.functions,
      'createFreeListing'
    );
    return (await fn(data)).data;
  }

  /** For visitors who aren't signed in: emails them a link that publishes the listing. */
  async createPendingListing(data: ListingForm & { email: string }): Promise<{ pendingId: string; plateCharacters: string }> {
    const fn = httpsCallable<object, { pendingId: string; plateCharacters: string }>(
      this.functions,
      'createPendingListing'
    );
    return (await fn({ ...data, appBaseUrl: environment.appBaseUrl })).data;
  }

  async resendPendingListing(pendingId: string): Promise<void> {
    await httpsCallable(this.functions, 'resendPendingListing')({ pendingId });
  }

  /** Publishes a pending listing once its emailed link has signed the visitor in. */
  async confirmPendingListing(pendingId: string): Promise<{ listingId: string; plateCharacters: string }> {
    const fn = httpsCallable<{ pendingId: string }, { listingId: string; plateCharacters: string }>(
      this.functions,
      'confirmPendingListing'
    );
    return (await fn({ pendingId })).data;
  }

  /** Checkout URL for unlocking every enquiry on one of the seller's listings. */
  async createUnlockSession(listingId: string): Promise<string> {
    const fn = httpsCallable<{ listingId: string; appBaseUrl: string }, { url: string }>(
      this.functions,
      'createUnlockSession'
    );
    const result = await fn({ listingId, appBaseUrl: environment.appBaseUrl });
    return result.data.url;
  }
}
