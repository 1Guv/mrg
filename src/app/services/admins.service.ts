import { Injectable, inject, computed, InjectionToken } from '@angular/core';
import { Firestore, collection, collectionData } from '@angular/fire/firestore';
import { toSignal } from '@angular/core/rxjs-interop';
import { Observable } from 'rxjs';

export interface Admin {
  uid: string;
  email: string;
}

export const ADMINS_DATA = new InjectionToken<Observable<Admin[]>>('admins.data');

function adminsDataFactory(firestore: Firestore): Observable<Admin[]> {
  return collectionData(
    collection(firestore, 'admins'),
    { idField: 'uid' }
  ) as Observable<Admin[]>;
}

@Injectable({ providedIn: 'root' })
export class AdminsService {
  private firestore = inject(Firestore);

  private adminsData: Observable<Admin[]> = (() => {
    const override = inject(ADMINS_DATA, { optional: true });
    return override ?? adminsDataFactory(this.firestore);
  })();

  private admins = toSignal(this.adminsData, { initialValue: [] as Admin[] });

  adminUids = computed(() => this.admins().map((a: Admin) => a.uid));

  isAdmin(uid: string | undefined): boolean {
    if (!uid) return false;
    return this.adminUids().includes(uid);
  }
}
