import { Injectable, inject } from '@angular/core';
import { AuthService } from './auth.service';
import {
  Firestore,
  collection,
  collectionData,
  query,
  orderBy,
  where
} from '@angular/fire/firestore';
import { Functions, httpsCallable } from '@angular/fire/functions';
import { from, Observable } from 'rxjs';
import { map } from 'rxjs/operators';

export interface UserProfile {
  uid: string;
  email: string;
  emailVerified: boolean;
  createdAt: string;
  lastSignIn: string | null;
  disabled: boolean;
}

export interface PlateSearch {
  id?: string;
  registration: string;
  type: string;
  badge: string;
  frontBack: boolean;
  searchedAt: any;
  userId?: string;
  firstName?: string;
  lastName?: string;
  email?: string;
  city?: string;
  plateMeaning?: string;
}

export interface PlateValuationMessage {
  id?: string;
  registration: string;
  valuation: number;
  plateMeaning: string;
  message: string;
  submittedAt: any;
  userId?: string;
}

export interface ValuationFeedback {
  id?: string;
  registration: string;
  valuation: number;
  agreed: boolean;
  popularityMultiplier: number;
  submittedAt: any;
  userId?: string;
}

export interface BuyerSearch {
  id?: string;
  term: string;
  resultsCount: number;
  searchedAt: any;
  userId?: string | null;
}

export interface NudgeQueueEntry {
  id?: string;
  email: string;
  registration: string;
  firstName?: string;
  valuationMin: number;
  valuationMax: number;
  firstValuationAt: any;
  nextSendAt: any;
  lastSentAt: any;
  sendCount: number;
  unsubscribed: boolean;
  unsubscribedAt: any;
  listed: boolean;
  emailValid?: boolean | null;
}

export interface AutoValuation {
  id?: string;
  registration: string;
  price: number;
  type: string;
  minPrice: number;
  maxPrice: number;
  savedAt: any;
  userId?: string;
  firstName?: string;
  lastName?: string;
  email?: string;
  city?: string;
  plateMeaning?: string;
}

@Injectable({
  providedIn: 'root'
})
export class AdminService {
  private authService = inject(AuthService);
  private firestore = inject(Firestore);
  private functions = inject(Functions);

  getAutoValuations(): Observable<AutoValuation[]> {
    const ref = collection(this.firestore, 'auto_valuations');
    const q = query(ref, orderBy('savedAt', 'desc'));
    return collectionData(q, { idField: 'id' }) as Observable<AutoValuation[]>;
  }

  getAuthUsers(): Observable<UserProfile[]> {
    const fn = httpsCallable<object, { users: UserProfile[] }>(this.functions, 'getUsers');
    return from(fn({})).pipe(map((result) => result.data.users));
  }

  getPlateSearches(): Observable<PlateSearch[]> {
    const ref = collection(this.firestore, 'plate_searches');
    const q = query(ref, orderBy('searchedAt', 'desc'));
    return collectionData(q, { idField: 'id' }) as Observable<PlateSearch[]>;
  }

  getPlateValuationMessages(): Observable<PlateValuationMessage[]> {
    const ref = collection(this.firestore, 'plate_valuation_message_feedback');
    const q = query(ref, orderBy('submittedAt', 'desc'));
    return collectionData(q, { idField: 'id' }) as Observable<PlateValuationMessage[]>;
  }

  getFeedback(): Observable<ValuationFeedback[]> {
    const ref = collection(this.firestore, 'valuation_feedback');
    const q = query(ref, orderBy('submittedAt', 'desc'));
    return collectionData(q, { idField: 'id' }) as Observable<ValuationFeedback[]>;
  }

  getNudgeQueue(): Observable<NudgeQueueEntry[]> {
    const ref = collection(this.firestore, 'listing_nudge_queue');
    const q = query(ref, where('listed', '==', false), orderBy('nextSendAt', 'asc'));
    return collectionData(q, { idField: 'id' }) as Observable<NudgeQueueEntry[]>;
  }

  getBuyerSearches(): Observable<BuyerSearch[]> {
    const ref = collection(this.firestore, 'buyer_searches');
    const q = query(ref, orderBy('searchedAt', 'desc'));
    return collectionData(q, { idField: 'id' }) as Observable<BuyerSearch[]>;
  }
}
