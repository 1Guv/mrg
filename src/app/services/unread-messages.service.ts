import { computed, inject, Injectable } from '@angular/core';
import { toObservable, toSignal } from '@angular/core/rxjs-interop';
import { combineLatest, of } from 'rxjs';
import { catchError, map, switchMap } from 'rxjs/operators';
import { AdminsService } from './admins.service';
import { AuthService } from './auth.service';
import { ADMIN_INBOX_EMAIL, isUnread, SellerEnquiry, SellerEnquiryService } from './seller-enquiry.service';

/**
 * How many conversations are waiting for the signed-in user: new enquiries
 * about their plates, and sellers' replies to theirs. Live, so the header's
 * messages icon updates as messages arrive.
 */
@Injectable({ providedIn: 'root' })
export class UnreadMessagesService {
  private enquiries = inject(SellerEnquiryService);
  private admins = inject(AdminsService);

  private readonly counts = toSignal(
    combineLatest([inject(AuthService).currentUser$, toObservable(this.admins.adminUids)]).pipe(
      switchMap(([user, adminUids]) => {
        const uid: string | undefined = (user as any)?.uid;
        const email: string | undefined = (user as any)?.email;
        if (!uid || !email) return of(0);
        // The same inbox the dashboard's Messages shows.
        const sellerEmail = adminUids.includes(uid) ? ADMIN_INBOX_EMAIL : email;
        const none = (err: unknown) => {
          console.error('Unread messages failed to load', err);
          return of([] as SellerEnquiry[]);
        };
        return combineLatest([
          this.enquiries.getEnquiriesForSeller(sellerEmail).pipe(catchError(none)),
          this.enquiries.getEnquiriesForBuyer(uid).pipe(catchError(none)),
        ]).pipe(map(([selling, buying]) =>
          selling.filter(e => isUnread(e, 'seller')).length +
          buying.filter(e => isUnread(e, 'buyer')).length));
      }),
    ),
    { initialValue: 0 },
  );

  readonly count = computed(() => this.counts());
}
