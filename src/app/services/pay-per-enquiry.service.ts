import { inject, Injectable } from '@angular/core';
import { Functions, httpsCallable } from '@angular/fire/functions';
import { environment } from '../../environments/environment';

/**
 * Free listings, and the one-off payment that unlocks a free listing's
 * enquiries. The seller's email comes from their account, not the form.
 */
@Injectable({ providedIn: 'root' })
export class PayPerEnquiryService {
  private functions = inject(Functions);

  async createFreeListing(data: {
    plateCharacters: string;
    askingPrice: string;
    phone: string;
    initials: string;
    meanings: string;
    negotiable: boolean;
  }): Promise<{ listingId: string; plateCharacters: string }> {
    const fn = httpsCallable<typeof data, { listingId: string; plateCharacters: string }>(
      this.functions,
      'createFreeListing'
    );
    return (await fn(data)).data;
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
