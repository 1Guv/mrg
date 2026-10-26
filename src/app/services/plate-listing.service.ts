import { inject, Injectable } from '@angular/core';
import {
  Firestore,
  collection,
  collectionData,
  query,
  orderBy,
  where,
  doc,
  docData,
  getDoc,
  updateDoc,
  runTransaction
} from '@angular/fire/firestore';
import { combineLatest, map, Observable } from 'rxjs';
import { PlateListing } from '../models/plate-listing.model';
import { LISTING_FEE } from '../constants/listing-fee';
import { normalisePlate } from '../utils/normalise-plate';
import { plateFormat } from '../utils/plate-format';

/** Distinct words of 3+ letters in a listing's meanings, upper case. */
function meaningWords(meanings: string | undefined): string[] {
  return [...new Set((meanings ?? '').toUpperCase().split(/[^A-Z]+/).filter(w => w.length >= 3))];
}

@Injectable({
  providedIn: 'root'
})
export class PlateListingService {

  private firestore = inject(Firestore);
  private readonly COLLECTION = 'plate-listings';
  private readonly COLLECTION_NEW = 'plate-listings-new';
  readonly listingFee = LISTING_FEE;

  getAll(): Observable<PlateListing[]> {
    const oldRef = collection(this.firestore, this.COLLECTION);
    const newRef = collection(this.firestore, this.COLLECTION_NEW);
    const old$ = collectionData(
      query(oldRef, orderBy('createdDate', 'desc')), { idField: 'id' }
    ) as Observable<PlateListing[]>;
    const new$ = collectionData(
      query(newRef, orderBy('createdDate', 'desc')), { idField: 'id' }
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

  /** AI-written description of what a plate spells (functions/src/plate-meanings.ts). */
  getMeaningDescription(plateChars: string): Observable<string | null> {
    const ref = doc(this.firestore, 'plate_meanings', normalisePlate(plateChars));
    return docData(ref).pipe(map(d => (d?.['description'] as string | undefined) ?? null));
  }

  /**
   * Up to `max` other unsold plates that share a word in their meanings,
   * topped up with plates of the same format, newest first within each.
   */
  getSimilar(listing: PlateListing, max = 6): Observable<PlateListing[]> {
    const words = meaningWords(listing.meanings);
    const plate = normalisePlate(listing.plateCharacters);
    const format = plateFormat(listing.plateCharacters);
    return this.getAll().pipe(
      map(all => {
        const seen = new Set([plate]);
        const others = all.filter(l => {
          const p = normalisePlate(l.plateCharacters ?? '');
          if (l.isSold || !p || seen.has(p)) return false;
          seen.add(p);
          return true;
        });
        const sharing = others.filter(l => meaningWords(l.meanings).some(w => words.includes(w)));
        const sameFormat = others.filter(l => !sharing.includes(l) && plateFormat(l.plateCharacters) === format);
        return [...sharing, ...sameFormat].slice(0, max);
      })
    );
  }

  getByPlate(plateChars: string): Observable<PlateListing | null> {
    const normalised = normalisePlate(plateChars);
    return this.getAll().pipe(
      map(listings =>
        listings.find(l => normalisePlate(l.plateCharacters) === normalised) ?? null
      )
    );
  }
}
