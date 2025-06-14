import { Injectable, signal } from '@angular/core';

@Injectable({
  providedIn: 'root'
})
export class NumberPlateFormService {

  resetSignal = signal(false);

  triggerReset() {
    this.resetSignal.set(true);
  }

  reset() {
    this.resetSignal.set(false);
  }
}
