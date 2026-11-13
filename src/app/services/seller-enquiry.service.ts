import { inject, Injectable } from '@angular/core';
import {
  Firestore,
  collection,
  collectionData,
  doc,
  orderBy,
  query,
  serverTimestamp,
  updateDoc,
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
  /** Null until the seller unlocks a locked enquiry. */
  message: string | null;
  buyerUid: string | null;
  buyerEmail: string | null;
  /** Set on free listings until the seller pays to read it. */
  locked?: boolean;
  /** First few words, with contact details masked, shown while locked. */
  preview?: string;
  sellerLCNumber: string;
  sellerEmail: string;
  submittedAt?: any;
  lastMessageAt?: any;
  lastMessageFrom?: 'buyer' | 'seller';
  /** Null while locked, so the seller can't read it before paying. */
  lastMessageText?: string | null;
  /** When each side last opened the conversation. */
  sellerReadAt?: any;
  buyerReadAt?: any;
}

/** Admins read enquiries about the legacy listings, which all use this address. */
export const ADMIN_INBOX_EMAIL = 'guv.mr.valuations+apnaplates@gmail.com';

/** The side of a conversation the user is on. */
export type EnquirySide = 'seller' | 'buyer';

/**
 * Whether the other side has said something since this side last opened the
 * conversation. Enquiries from before conversations were saved count as the
 * buyer's message.
 */
export function isUnread(enquiry: SellerEnquiry, side: EnquirySide): boolean {
  if ((enquiry.lastMessageFrom ?? 'buyer') === side) return false;
  const lastAt = (enquiry.lastMessageAt ?? enquiry.submittedAt)?.toMillis?.() ?? 0;
  const readAt = (side === 'seller' ? enquiry.sellerReadAt : enquiry.buyerReadAt)?.toMillis?.() ?? 0;
  return readAt < lastAt;
}

/** One message in an enquiry's conversation. */
export interface EnquiryMessage {
  id?: string;
  from: 'buyer' | 'seller';
  text: string;
  sentAt?: any;
}

/** Most recent activity first; older enquiries have no lastMessageAt. */
function byLatest(enquiries: SellerEnquiry[]): SellerEnquiry[] {
  const at = (e: SellerEnquiry) => (e.lastMessageAt ?? e.submittedAt)?.toMillis?.() ?? 0;
  return [...enquiries].sort((a, b) => at(b) - at(a));
}

export interface SendEnquiryResult {
  whatsappNumber: string | null;
  sellerNotified?: boolean;
}

@Injectable({ providedIn: 'root' })
export class SellerEnquiryService {
  private firestore = inject(Firestore);
  private functions = inject(Functions);

  /**
   * Sends the enquiry to the seller. Resolves to their WhatsApp number, if
   * any; sellerNotified means it waits for the seller to unlock it.
   */
  async sendEnquiry(listing: PlateListing, enquiryType: string, message: string): Promise<SendEnquiryResult> {
    const fn = httpsCallable<object, SendEnquiryResult>(this.functions, 'sendEnquiry');
    const result = await fn({
      listingId: String(listing.id),
      collection: listing._collection,
      enquiryType,
      message
    });
    return result.data;
  }

  getEnquiriesForSeller(email: string): Observable<SellerEnquiry[]> {
    const ref = collection(this.firestore, 'seller_enquiries');
    const q = query(ref, where('sellerEmail', '==', email));
    return (collectionData(q, { idField: 'id' }) as Observable<SellerEnquiry[]>).pipe(map(byLatest));
  }

  /** Enquiries this user has sent about other people's plates. */
  getEnquiriesForBuyer(uid: string): Observable<SellerEnquiry[]> {
    const ref = collection(this.firestore, 'seller_enquiries');
    const q = query(ref, where('buyerUid', '==', uid));
    return (collectionData(q, { idField: 'id' }) as Observable<SellerEnquiry[]>).pipe(map(byLatest));
  }

  getMessages(enquiryId: string): Observable<EnquiryMessage[]> {
    const ref = collection(this.firestore, 'seller_enquiries', enquiryId, 'messages');
    return collectionData(query(ref, orderBy('sentAt')), { idField: 'id' }) as Observable<EnquiryMessage[]>;
  }

  /** Records that this side has opened the conversation, which clears its unread count. */
  async markRead(enquiryId: string, side: EnquirySide): Promise<void> {
    const field = side === 'seller' ? 'sellerReadAt' : 'buyerReadAt';
    await updateDoc(doc(this.firestore, 'seller_enquiries', enquiryId), { [field]: serverTimestamp() });
  }

  /** Adds a message to the conversation; the other side is emailed it. */
  async sendMessage(enquiryId: string, text: string): Promise<void> {
    const fn = httpsCallable<object, { success: boolean }>(this.functions, 'replyToEnquiry');
    await fn({ enquiryId, replyMessage: text });
  }
}
