import { inject, Injectable } from '@angular/core';
import { Functions, httpsCallable } from '@angular/fire/functions';

interface ManualSocialPostResult {
  success: boolean;
  processed: number;
}

@Injectable({ providedIn: 'root' })
export class SocialPostService {
  private functions = inject(Functions);

  async processQueue(): Promise<ManualSocialPostResult> {
    const fn = httpsCallable<void, ManualSocialPostResult>(
      this.functions,
      'manualSocialPost'
    );
    const result = await fn();
    return result.data;
  }
}
