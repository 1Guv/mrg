import { Injectable, inject } from '@angular/core';
import { Firestore, collection, collectionData, query, where } from '@angular/fire/firestore';
import { Functions, httpsCallable } from '@angular/fire/functions';
import { Observable, catchError, of } from 'rxjs';

export interface Voucher {
  id?: string;
  code: string;
  stripeCouponId: string;
  stripePromotionCodeId: string;
  percentOff: number;
  description: string;
  audience: 'public' | 'nudge';
  expiresAt: any;
  active: boolean;
  createdAt: any;
  createdBy: 'admin' | 'nudge-system';
}

export interface CreateVoucherInput {
  code: string;
  percentOff: number;
  description: string;
  expiresAt: string | null;
  maxRedemptions: number | null;
}

@Injectable({ providedIn: 'root' })
export class VoucherService {
  private firestore = inject(Firestore);
  private functions = inject(Functions);

  /** Active, publicly displayable vouchers (for the site-wide banner). */
  getActivePublicVouchers(): Observable<Voucher[]> {
    const ref = collection(this.firestore, 'vouchers');
    const q = query(ref, where('audience', '==', 'public'), where('active', '==', true));
    return (collectionData(q, { idField: 'id' }) as Observable<Voucher[]>).pipe(
      catchError((err) => { console.error('Firestore error loading public vouchers:', err); return of([] as Voucher[]); })
    );
  }

  /** All public vouchers, active or not (for the admin management table). */
  getAllPublicVouchers(): Observable<Voucher[]> {
    const ref = collection(this.firestore, 'vouchers');
    const q = query(ref, where('audience', '==', 'public'));
    return (collectionData(q, { idField: 'id' }) as Observable<Voucher[]>).pipe(
      catchError((err) => { console.error('Firestore error loading vouchers:', err); return of([] as Voucher[]); })
    );
  }

  async createVoucher(input: CreateVoucherInput): Promise<{ success: boolean; id: string }> {
    const fn = httpsCallable<CreateVoucherInput & { action: string }, { success: boolean; id: string }>(
      this.functions,
      'manageVoucher'
    );
    const result = await fn({ ...input, action: 'create' });
    return result.data;
  }

  async deactivateVoucher(voucherId: string): Promise<{ success: boolean }> {
    const fn = httpsCallable<{ action: string; voucherId: string }, { success: boolean }>(
      this.functions,
      'manageVoucher'
    );
    const result = await fn({ action: 'deactivate', voucherId });
    return result.data;
  }
}
