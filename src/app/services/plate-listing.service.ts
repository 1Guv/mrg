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
  updateDoc,
  runTransaction
} from '@angular/fire/firestore';
import { combineLatest, map, Observable } from 'rxjs';
import { PlateListing } from '../models/plate-listing.model';

@Injectable({
  providedIn: 'root'
})
export class PlateListingService {

  private firestore = inject(Firestore);
  private readonly COLLECTION = 'plate-listings';
  private readonly COLLECTION_NEW = 'plate-listings-new';
  readonly listingFee = 6;

  getAll(): Observable<PlateListing[]> {
    const oldRef = collection(this.firestore, this.COLLECTION);
    const newRef = collection(this.firestore, this.COLLECTION_NEW);
    const old$ = collectionData(
      query(oldRef, orderBy('createdDate', 'asc')), { idField: 'id' }
    ) as Observable<PlateListing[]>;
    const new$ = collectionData(
      query(newRef, orderBy('createdDate', 'asc')), { idField: 'id' }
    ) as Observable<PlateListing[]>;
    return combineLatest([new$, old$]).pipe(
      map(([newListings, oldListings]) => [
        ...newListings.map(l => ({ ...l, _collection: this.COLLECTION_NEW })),
        ...oldListings.map(l => ({ ...l, _collection: this.COLLECTION })),
      ])
    );
  }

  getSold(): Observable<PlateListing[]> {
    const oldRef = collection(this.firestore, this.COLLECTION);
    const newRef = collection(this.firestore, this.COLLECTION_NEW);
    const old$ = collectionData(
      query(oldRef, where('isSold', '==', true)), { idField: 'id' }
    ) as Observable<PlateListing[]>;
    const new$ = collectionData(
      query(newRef, where('isSold', '==', true)), { idField: 'id' }
    ) as Observable<PlateListing[]>;
    return combineLatest([new$, old$]).pipe(
      map(([newListings, oldListings]) => [...newListings, ...oldListings])
    );
  }

  async getById(id: string): Promise<PlateListing | null> {
    const ref = doc(this.firestore, `${this.COLLECTION}/${id}`);
    const snap = await getDoc(ref);
    return snap.exists() ? ({ id: snap.id, ...snap.data() } as unknown as PlateListing) : null;
  }

  incrementViews(plateId: string, sourceCollection = this.COLLECTION): Promise<void> {
    const ref = doc(this.firestore, `${sourceCollection}/${plateId}`);
    return runTransaction(this.firestore, async (transaction) => {
      const snap = await transaction.get(ref);
      const current = Number(snap.data()?.['viewsPlaceholder'] ?? 0);
      transaction.update(ref, { viewsPlaceholder: current + 1 });
    });
  }

  getMyListings(uid: string): Observable<PlateListing[]> {
    const ref = collection(this.firestore, this.COLLECTION_NEW);
    const q = query(ref, where('sellerUid', '==', uid));
    return collectionData(q, { idField: 'id' }) as Observable<PlateListing[]>;
  }

  updateListing(id: string, data: { askingPrice: string; meanings: string }): Promise<void> {
    const ref = doc(this.firestore, `${this.COLLECTION_NEW}/${id}`);
    return updateDoc(ref, data);
  }
}
