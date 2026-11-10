import { inject, Injectable } from '@angular/core';
import { Auth, signInWithCustomToken } from '@angular/fire/auth';
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
  private auth = inject(Auth);

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

  /** Publishes a pending listing from its emailed link, and signs the seller in. */
  async confirmPendingListing(pendingId: string, key: string): Promise<{ listingId: string; plateCharacters: string }> {
    const fn = httpsCallable<{ pendingId: string; key: string }, { listingId: string; plateCharacters: string; customToken?: string }>(
      this.functions,
      'confirmPendingListing'
    );
    const { customToken, ...listing } = (await fn({ pendingId, key })).data;
    if (customToken) await signInWithCustomToken(this.auth, customToken);
    return listing;
  }

  /** Stops a pending listing, and its reminders, from the emailed link. */
  async cancelPendingListing(pendingId: string, key: string): Promise<{ plateCharacters: string }> {
    const fn = httpsCallable<{ pendingId: string; key: string }, { plateCharacters: string }>(
      this.functions,
      'cancelPendingListing'
    );
    return (await fn({ pendingId, key })).data;
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
