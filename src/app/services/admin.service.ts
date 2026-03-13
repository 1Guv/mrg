import { Injectable, inject } from '@angular/core';
import { AuthService } from './auth.service';
import {
  Firestore,
  collection,
  collectionData,
  query,
  orderBy
} from '@angular/fire/firestore';
import { Observable } from 'rxjs';

export interface PlateSearch {
  id?: string;
  registration: string;
  type: string;
  badge: string;
  frontBack: boolean;
  searchedAt: any;
  userId?: string;
}

@Injectable({
  providedIn: 'root'
})
export class AdminService {
  private authService = inject(AuthService);
  private firestore = inject(Firestore);

  getPlateSearches(): Observable<PlateSearch[]> {
    const ref = collection(this.firestore, 'plate_searches');
    const q = query(ref, orderBy('searchedAt', 'desc'));
    return collectionData(q, { idField: 'id' }) as Observable<PlateSearch[]>;
  }
}
