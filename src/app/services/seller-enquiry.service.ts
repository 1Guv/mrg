import { inject, Injectable } from '@angular/core';
import {
  Firestore,
  collection,
  collectionData,
  addDoc,
  query,
  where,
  serverTimestamp
} from '@angular/fire/firestore';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import { PlateListing } from '../models/plate-listing.model';
import { PlateListingService } from './plate-listing.service';

export interface SellerEnquiry {
  id?: string;
  plateId: number;
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
  private plateListingService = inject(PlateListingService);

  async saveEnquiry(
    listing: PlateListing,
    enquiryType: string,
    message: string,
    buyerUid: string,
    buyerEmail: string
  ): Promise<void> {
    const enquiriesRef = collection(this.firestore, 'seller_enquiries');
    const mailRef = collection(this.firestore, 'mail');

    await Promise.all([
      addDoc(enquiriesRef, {
        plateId: listing.id,
        plateCharacters: listing.plateCharacters,
        enquiryType,
        message,
        buyerUid,
        buyerEmail,
        sellerLCNumber: listing.lCNumber,
        sellerEmail: listing.lCEmail,
        submittedAt: serverTimestamp()
      }),
      addDoc(mailRef, {
        to: [listing.lCEmail],
        message: {
          subject: `New enquiry for your plate ${listing.plateCharacters.toUpperCase()}`,
          html: `
            <h2>You have a new enquiry!</h2>
            <p><strong>Plate:</strong> ${listing.plateCharacters.toUpperCase()}</p>
            <p><strong>Listed at:</strong> £${listing.askingPrice}</p>
            <p><strong>Enquiry type:</strong> ${enquiryType}</p>
            <p><strong>Message:</strong> ${message}</p>
            <p><strong>From:</strong> ${buyerEmail}</p>
            <p><strong>Sent:</strong> ${new Date().toLocaleString('en-GB')}</p>
          `
        }
      }),
      this.plateListingService.incrementViews(String(listing.id))
    ]);
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
}
