import { inject, Injectable, signal } from '@angular/core';
import { RegValuation, UserDetails } from '../models/reg.model';
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
  userDetails = signal<UserDetails | null>(null);

  setUserDetails(details: UserDetails | null) {
    this.userDetails.set(details);
  }

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
    const details = this.userDetails();
    const payload: any = { type, registration, requestedAt: new Date() };
    if (details) {
      payload['firstName'] = details.firstName;
      payload['lastName'] = details.lastName;
      payload['email'] = details.email;
      payload['city'] = details.city;
      payload['plateMeaning'] = details.plateMeaning;
    }
    return addDoc(ref, payload);
  }

  autoSaveValuation(registration: string, price: number, type: string, minPrice: number, maxPrice: number) {
    const ref = collection(this.firestore, 'auto_valuations');
    const mailRef = collection(this.firestore, 'mail');
    const details = this.userDetails();
    const payload: any = { registration, price, type, minPrice, maxPrice, savedAt: new Date() };
    if (details) {
      payload['firstName'] = details.firstName;
      payload['lastName'] = details.lastName;
      payload['email'] = details.email;
      payload['city'] = details.city;
      payload['plateMeaning'] = details.plateMeaning;
    }
    return this.authService.currentUser$.pipe(
      take(1),
      switchMap((user) => {
        if (user) payload['userId'] = user.uid;
        const displayEmail = user?.email ?? details?.email ?? 'Guest';
        const displayName = details ? `${details.firstName} ${details.lastName}` : (user ? user.email ?? user.uid : 'Guest');
        addDoc(mailRef, {
          to: ['guv.mr.valuations@gmail.com'],
          message: {
            subject: `New Valuation: ${registration}`,
            html: `
              <h2>New valuation on MRG</h2>
              <p><strong>Plate:</strong> ${registration}</p>
              <p><strong>Type:</strong> ${type}</p>
              <p><strong>Valuation:</strong> £${price.toLocaleString('en-GB', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</p>
              <p><strong>Min:</strong> £${minPrice.toLocaleString('en-GB', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} &nbsp; <strong>Max:</strong> £${maxPrice.toLocaleString('en-GB', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</p>
              ${details ? `<p><strong>Name:</strong> ${details.firstName} ${details.lastName}</p>
              <p><strong>City:</strong> ${details.city}</p>
              <p><strong>Plate Meaning:</strong> ${details.plateMeaning}</p>` : ''}
              <p><strong>User:</strong> ${displayEmail}</p>
              <p><strong>Time:</strong> ${new Date().toLocaleString('en-GB')}</p>
            `
          }
        });
        return addDoc(ref, payload);
      })
    );
  }

  savePlateValuationMessage(registration: string, valuation: number, plateMeaning: string, message: string) {
    const ref = collection(this.firestore, 'plate_valuation_message_feedback');
    return this.authService.currentUser$.pipe(
      take(1),
      switchMap((user) => {
        const payload: any = {
          registration,
          valuation,
          plateMeaning,
          message,
          submittedAt: new Date(),
        };
        if (user) payload['userId'] = user.uid;
        return addDoc(ref, payload);
      })
    );
  }

  savePlateSearch(registration: string, type: string, badge: string, frontBack: boolean, sendEmail = true) {
    const searchesRef = collection(this.firestore, 'plate_searches');
    const mailRef = collection(this.firestore, 'mail');
    const details = this.userDetails();
    const payload: any = {
      registration,
      type,
      badge,
      frontBack,
      searchedAt: new Date()
    };
    if (details) {
      payload['firstName'] = details.firstName;
      payload['lastName'] = details.lastName;
      payload['email'] = details.email;
      payload['city'] = details.city;
      payload['plateMeaning'] = details.plateMeaning;
    }

    return this.authService.currentUser$.pipe(
      take(1),
      switchMap((user) => {
        if (user) payload['userId'] = user.uid;
        const displayEmail = user?.email ?? details?.email ?? 'Guest';
        if (sendEmail) {
          addDoc(mailRef, {
            to: ['guv.mr.valuations@gmail.com'],
            message: {
              subject: `New Plate Search: ${registration}`,
              html: `
                <h2>New plate search on MRG</h2>
                <p><strong>Plate:</strong> ${registration}</p>
                <p><strong>Type:</strong> ${type}</p>
                <p><strong>Badge:</strong> ${badge}</p>
                ${details ? `<p><strong>Name:</strong> ${details.firstName} ${details.lastName}</p>
                <p><strong>City:</strong> ${details.city}</p>
                <p><strong>Plate Meaning:</strong> ${details.plateMeaning}</p>` : ''}
                <p><strong>User:</strong> ${displayEmail}</p>
                <p><strong>Time:</strong> ${new Date().toLocaleString('en-GB')}</p>
              `
            }
          });
        }
        return addDoc(searchesRef, payload);
      })
    );
  }
}
