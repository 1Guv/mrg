import { inject, Injectable } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { Firestore, doc, docData } from '@angular/fire/firestore';
import { catchError, map, of, shareReplay } from 'rxjs';

export interface PublicStats {
  platesForSale: number;
  platesValued: number;
  members: number;
}

/**
 * The real numbers behind the trust strip, recounted daily by the
 * refreshPublicStats function. Null until loaded, or if they can't be read.
 */
@Injectable({ providedIn: 'root' })
export class PublicStatsService {
  private firestore = inject(Firestore);

  readonly stats = toSignal(
    docData(doc(this.firestore, 'public_stats', 'summary')).pipe(
      map(d => (d && d['platesValued'] ? (d as PublicStats) : null)),
      catchError(() => of(null)),
      shareReplay(1),
    ),
    { initialValue: null },
  );
}
