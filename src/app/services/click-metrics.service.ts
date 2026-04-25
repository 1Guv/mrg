import { inject, Injectable } from '@angular/core';
import {
  Firestore,
  collection,
  collectionData,
  doc,
  increment,
  setDoc,
  serverTimestamp,
} from '@angular/fire/firestore';
import { Observable } from 'rxjs';

export interface ButtonMetric {
  id: string;
  label: string;
  count: number;
  lastClickedAt: any;
}

@Injectable({ providedIn: 'root' })
export class ClickMetricsService {
  private firestore = inject(Firestore);

  track(buttonId: string, label: string): void {
    const ref = doc(this.firestore, 'button_metrics', buttonId);
    setDoc(ref, {
      label,
      count: increment(1),
      lastClickedAt: serverTimestamp(),
    }, { merge: true }).catch(() => {});
  }

  getAll(): Observable<ButtonMetric[]> {
    const ref = collection(this.firestore, 'button_metrics');
    return collectionData(ref, { idField: 'id' }) as Observable<ButtonMetric[]>;
  }
}
