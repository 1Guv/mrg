import { inject, Injectable } from '@angular/core';
import { Functions, httpsCallable } from '@angular/fire/functions';
import { environment } from '../../environments/environment';

@Injectable({ providedIn: 'root' })
export class StripeService {
  private functions = inject(Functions);

  async createCheckoutSession(data: {
    plateCharacters: string;
    askingPrice: string;
    phone: string;
    email: string;
    meanings: string;
    negotiable: boolean;
  }): Promise<string> {
    const fn = httpsCallable<typeof data & { appBaseUrl: string }, { url: string }>(
      this.functions,
      'createCheckoutSession'
    );
    const result = await fn({ ...data, appBaseUrl: environment.appBaseUrl });
    return result.data.url;
  }
}
