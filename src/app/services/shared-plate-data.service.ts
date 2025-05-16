import { Injectable } from '@angular/core';
import { BehaviorSubject } from 'rxjs/internal/BehaviorSubject';

@Injectable({
  providedIn: 'root'
})
export class SharedPlateDataService {

  currentPlateData: BehaviorSubject<any> = new BehaviorSubject(null);

  setCurrentPlateData(data: any) {
    this.currentPlateData.next(data);
  }

  getCurrentPlateData() {
    return this.currentPlateData.asObservable();
  }
}
