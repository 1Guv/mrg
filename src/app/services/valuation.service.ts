import { inject, Injectable, signal } from '@angular/core';
import { RegValuation } from '../models/reg.model';
import {
  Firestore,
  collection,
  collectionData,
  query,
  where,
  orderBy,
  addDoc,
  doc,
  deleteDoc,
  updateDoc
} from '@angular/fire/firestore';
import { Observable, of, switchMap } from 'rxjs';
import { AuthService } from './auth.service';

@Injectable({
  providedIn: 'root'
})
export class ValuationService {
  // Firestore will only work if I install @angular/fire@17.1.0
  // npm i @angular/fire@17.1.0 --legacy-peer-deps
  
  private firestore = inject(Firestore);
  private authService = inject(AuthService);

  valuation = signal<Partial<RegValuation>>({});

  setValuation(valuation: RegValuation) {
    this.valuation.set(valuation);
  }

  getValuation() {
    return this.valuation;
  }

  resetValuation() {
    this.valuation.set({});
  }

  addValuation(valuation: RegValuation) {
    return this.authService.currentUser$
      .pipe(
        switchMap((user) => {
          if (!user) return Promise.reject('No user logged in');
          const valuationRef = collection(this.firestore, 'valuations');
          valuation.userId = user.uid;
          valuation.createdAt = new Date();
          valuation.updatedAt = new Date();
          return addDoc(valuationRef, valuation);
        })
      );
  }

  getValuations(): Observable<RegValuation[]> {
    return this.authService.currentUser$
      .pipe(
        switchMap((user) => {
          if (!user) return of([]);
          const valuationsRef = collection(this.firestore, 'valuations');
          const q = query(
            valuationsRef,
            where('userId', '==', user.uid),
            orderBy('createdAt', 'asc')
          );
          return collectionData(q, { idField: 'id' }) as Observable<RegValuation[]>;
        })
      );
  }

  deleteValuation(valuationId: string) {
    const valuationRef = doc(this.firestore, `valuations/${valuationId}`);
    return deleteDoc(valuationRef);
  }

  updateValuation(updatedValuation: Partial<RegValuation>, valuationId: string) {
    return this.authService.currentUser$
      .pipe(
        switchMap((user) => {
          if (!user) return Promise.reject('No user logged in');
          const valuationRef = doc(this.firestore, `valuations/${valuationId}`);
          updatedValuation.userId = user.uid;
          updatedValuation.updatedAt = new Date();
          return updateDoc(valuationRef, updatedValuation);
        })
      )
      .subscribe();
  }
}
