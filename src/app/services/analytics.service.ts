import { inject, Injectable } from '@angular/core';
import { Functions, httpsCallable } from '@angular/fire/functions';
import { AnalyticsData } from './analytics.types';

@Injectable({ providedIn: 'root' })
export class AnalyticsService {
  private functions = inject(Functions);

  async getAnalytics(): Promise<AnalyticsData> {
    const fn = httpsCallable<void, AnalyticsData>(this.functions, 'getAnalytics');
    const result = await fn();
    return result.data;
  }
}
