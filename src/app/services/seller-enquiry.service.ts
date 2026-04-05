import { inject, Injectable } from '@angular/core';
import {
  Firestore,
  collection,
  addDoc,
  serverTimestamp
} from '@angular/fire/firestore';

export interface SellerEnquiry {
  plateId: number;
  plateCharacters: string;
  enquiryType: string;
  message: string;
  buyerUid: string;
  buyerEmail: string;
  sellerLCNumber: string;
}

@Injectable({ providedIn: 'root' })
export class SellerEnquiryService {
  private firestore = inject(Firestore);

  saveEnquiry(data: SellerEnquiry): Promise<void> {
    const ref = collection(this.firestore, 'seller_enquiries');
    return addDoc(ref, { ...data, submittedAt: serverTimestamp() }).then(() => {});
  }
}
