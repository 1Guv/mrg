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
import { Observable, of, switchMap, take } from 'rxjs';
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

  saveFeedback(registration: string, valuation: number, agreed: boolean, popularityMultiplier: number) {
    const ref = collection(this.firestore, 'valuation_feedback');
    const mailRef = collection(this.firestore, 'mail');
    const payload: any = { registration, valuation, agreed, popularityMultiplier, submittedAt: new Date() };
    return this.authService.currentUser$.pipe(
      take(1),
      switchMap((user) => {
        if (user) payload['userId'] = user.uid;
        addDoc(mailRef, {
          to: ['guv.mr.valuations@gmail.com'],
          message: {
            subject: `Valuation Feedback: ${registration}`,
            html: `
              <h2>New valuation feedback on MRG</h2>
              <p><strong>Plate:</strong> ${registration}</p>
              <p><strong>Valuation:</strong> £${valuation.toFixed(2)}</p>
              <p><strong>Popularity Multiplier:</strong> ${popularityMultiplier}x</p>
              <p><strong>Agreed:</strong> ${agreed ? '👍 Yes' : '👎 No'}</p>
              <p><strong>User:</strong> ${user ? user.email ?? user.uid : 'Guest'}</p>
              <p><strong>Time:</strong> ${new Date().toLocaleString('en-GB')}</p>
            `
          }
        });
        return addDoc(ref, payload);
      })
    );
  }

  saveFeatureRequest(type: string, registration: string) {
    const ref = collection(this.firestore, 'feature_requests');
    return addDoc(ref, { type, registration, requestedAt: new Date() });
  }

  savePlateSearch(registration: string, type: string, badge: string, frontBack: boolean) {
    const searchesRef = collection(this.firestore, 'plate_searches');
    const mailRef = collection(this.firestore, 'mail');
    const payload: any = {
      registration,
      type,
      badge,
      frontBack,
      searchedAt: new Date()
    };

    return this.authService.currentUser$.pipe(
      take(1),
      switchMap((user) => {
        if (user) payload['userId'] = user.uid;
        addDoc(mailRef, {
          to: ['guv.mr.valuations@gmail.com'],
          message: {
            subject: `New Plate Search: ${registration}`,
            html: `
              <h2>New plate search on MRG</h2>
              <p><strong>Plate:</strong> ${registration}</p>
              <p><strong>Type:</strong> ${type}</p>
              <p><strong>Badge:</strong> ${badge}</p>
              <p><strong>User:</strong> ${user ? user.email ?? user.uid : 'Guest'}</p>
              <p><strong>Time:</strong> ${new Date().toLocaleString('en-GB')}</p>
            `
          }
        });
        return addDoc(searchesRef, payload);
      })
    );
  }
}
