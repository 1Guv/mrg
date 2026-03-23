import { Injectable, inject } from '@angular/core';
import { AuthService } from './auth.service';
import {
  Firestore,
  collection,
  collectionData,
  query,
  orderBy
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
}
