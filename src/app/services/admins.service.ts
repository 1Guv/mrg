import { Injectable, inject, computed, InjectionToken } from '@angular/core';
import { Firestore, collection, collectionData } from '@angular/fire/firestore';
import { toSignal } from '@angular/core/rxjs-interop';
import { catchError, Observable, of, switchMap } from 'rxjs';
import { AuthService } from './auth.service';

export interface Admin {
  uid: string;
  email?: string;
}

export const ADMINS_DATA = new InjectionToken<Observable<Admin[]>>('admins.data');

// The admins collection is only readable when signed in, so the listener is
// re-created on every auth change. A denied read (e.g. on sign-out) must not
// error the stream: toSignal would then throw on every read until a reload.
function adminsDataFactory(firestore: Firestore, authService: AuthService): Observable<Admin[]> {
  return authService.currentUser$.pipe(
    switchMap(user => user
      ? (collectionData(collection(firestore, 'admins'), { idField: 'uid' }) as Observable<Admin[]>).pipe(
          catchError((err) => { console.error('Firestore error loading admins:', err); return of([] as Admin[]); })
        )
      : of([] as Admin[]))
  );
}

@Injectable({ providedIn: 'root' })
export class AdminsService {
  private firestore = inject(Firestore);

  private adminsData: Observable<Admin[]> = (() => {
    const override = inject(ADMINS_DATA, { optional: true });
    return override ?? adminsDataFactory(this.firestore, inject(AuthService));
  })();

  private admins = toSignal(this.adminsData, { initialValue: [] as Admin[] });

  readonly adminUids = computed(() => this.admins().map((a: Admin) => a.uid));

  isAdmin(uid: string | undefined): boolean {
    if (!uid) return false;
    return this.adminUids().includes(uid);
  }
}
