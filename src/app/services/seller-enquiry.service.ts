import { inject, Injectable } from '@angular/core';
import {
  Firestore,
  collection,
  collectionData,
  query,
  where
} from '@angular/fire/firestore';
import { Functions, httpsCallable } from '@angular/fire/functions';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import { PlateListing } from '../models/plate-listing.model';

export interface SellerEnquiry {
  id?: string;
  plateId: number | string;
  plateCharacters: string;
  enquiryType: string;
  message: string;
  buyerUid: string;
  buyerEmail: string;
  sellerLCNumber: string;
  sellerEmail: string;
  submittedAt?: any;
}

@Injectable({ providedIn: 'root' })
export class SellerEnquiryService {
  private firestore = inject(Firestore);
  private functions = inject(Functions);

  /** Sends the enquiry to the seller; resolves to their WhatsApp number, if any. */
  async sendEnquiry(listing: PlateListing, enquiryType: string, message: string): Promise<string | null> {
    const fn = httpsCallable<object, { whatsappNumber: string | null }>(this.functions, 'sendEnquiry');
    const result = await fn({
      listingId: String(listing.id),
      collection: listing._collection,
      enquiryType,
      message
    });
    return result.data.whatsappNumber;
  }

  getEnquiriesForSeller(email: string): Observable<SellerEnquiry[]> {
    const ref = collection(this.firestore, 'seller_enquiries');
    const q = query(ref, where('sellerEmail', '==', email));
    return (collectionData(q, { idField: 'id' }) as Observable<SellerEnquiry[]>).pipe(
      map(enquiries => [...enquiries].sort((a, b) => {
        const aTime = a.submittedAt?.toMillis?.() ?? 0;
        const bTime = b.submittedAt?.toMillis?.() ?? 0;
        return bTime - aTime;
      }))
    );
  }

  async sendReply(enquiry: SellerEnquiry, replyMessage: string): Promise<void> {
    const fn = httpsCallable<object, { success: boolean }>(this.functions, 'replyToEnquiry');
    await fn({ enquiryId: enquiry.id, replyMessage });
  }
}
