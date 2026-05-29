import { Injectable, inject } from '@angular/core';
import { Functions, httpsCallable } from '@angular/fire/functions';
import { from, Observable } from 'rxjs';
import { map } from 'rxjs/operators';

@Injectable({ providedIn: 'root' })
export class NudgeEmailsService {
  private functions = inject(Functions);

  getNudgeStatus(): Observable<boolean> {
    const fn = httpsCallable<object, { optedOut: boolean }>(this.functions, 'getNudgeStatus');
    return from(fn({})).pipe(map((r) => r.data.optedOut));
  }

  toggleNudgeEmails(optOut: boolean): Observable<void> {
    const fn = httpsCallable<{ optOut: boolean }, { success: boolean }>(
      this.functions, 'toggleNudgeEmails'
    );
    return from(fn({ optOut })).pipe(map(() => void 0));
  }
}
