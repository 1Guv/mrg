import { Injectable } from '@angular/core';
import { BehaviorSubject } from 'rxjs/internal/BehaviorSubject';

@Injectable({
  providedIn: 'root'
})
export class SharedPlateDataService {

  currentPlateData: BehaviorSubject<any> = new BehaviorSubject(null);
  currentPlatePending: BehaviorSubject<string | null> = new BehaviorSubject<string | null>(null);

  setCurrentPlateData(data: any) {
    this.currentPlateData.next(data);
  }

  getCurrentPlateData() {
    return this.currentPlateData.asObservable();
  }

  setCurrentPlatePending(registration: string | null) {
    this.currentPlatePending.next(registration);
  }

  getCurrentPlatePending() {
    return this.currentPlatePending.asObservable();
  }
}
