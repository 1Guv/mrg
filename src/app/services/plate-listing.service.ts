import { inject, Injectable } from '@angular/core';
import {
  Firestore,
  collection,
  collectionData,
  query,
  orderBy,
  where,
  doc,
  getDoc,
  runTransaction
} from '@angular/fire/firestore';
import { Observable } from 'rxjs';
import { PlateListing } from '../models/plate-listing.model';

@Injectable({
  providedIn: 'root'
})
export class PlateListingService {

  private firestore = inject(Firestore);
  private readonly COLLECTION = 'plate-listings';
  readonly listingFee = 6;

  getAll(): Observable<PlateListing[]> {
    const ref = collection(this.firestore, this.COLLECTION);
    const q = query(ref, orderBy('createdDate', 'asc'));
    return collectionData(q, { idField: 'id' }) as Observable<PlateListing[]>;
  }

  getSold(): Observable<PlateListing[]> {
    const ref = collection(this.firestore, this.COLLECTION);
    const q = query(ref, where('isSold', '==', true));
    return collectionData(q, { idField: 'id' }) as Observable<PlateListing[]>;
  }

  async getById(id: string): Promise<PlateListing | null> {
    const ref = doc(this.firestore, `${this.COLLECTION}/${id}`);
    const snap = await getDoc(ref);
    return snap.exists() ? ({ id: snap.id, ...snap.data() } as unknown as PlateListing) : null;
  }

  incrementViews(plateId: string): Promise<void> {
    const ref = doc(this.firestore, `${this.COLLECTION}/${plateId}`);
    return runTransaction(this.firestore, async (transaction) => {
      const snap = await transaction.get(ref);
      const current = Number(snap.data()?.['viewsPlaceholder'] ?? 0);
      transaction.update(ref, { viewsPlaceholder: current + 1 });
    });
  }
}
