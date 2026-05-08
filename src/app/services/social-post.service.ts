import { inject, Injectable } from '@angular/core';
import { Functions, httpsCallable } from '@angular/fire/functions';
import { Auth } from '@angular/fire/auth';

interface ManualSocialPostResult {
  success: boolean;
  processed: number;
}

const ARTICLE_GEN_URL =
  'https://us-central1-code-g-b8b6f.cloudfunctions.net/triggerArticleGeneration';

@Injectable({ providedIn: 'root' })
export class SocialPostService {
  private functions = inject(Functions);
  private auth = inject(Auth);

  async processQueue(): Promise<ManualSocialPostResult> {
    const fn = httpsCallable<void, ManualSocialPostResult>(
      this.functions,
      'manualSocialPost'
    );
    const result = await fn();
    return result.data;
  }

  async processQueueFullVideos(): Promise<ManualSocialPostResult> {
    const fn = httpsCallable<void, ManualSocialPostResult>(
      this.functions,
      'manualSocialPostFullVideos',
      { timeout: 600000 }
    );
    const result = await fn();
    return result.data;
  }

  async generateArticle(): Promise<{ success: boolean }> {
    const user = this.auth.currentUser;
    if (!user) throw new Error('Not authenticated');
    const token = await user.getIdToken();

    const res = await fetch(ARTICLE_GEN_URL, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
    });

    if (!res.ok) {
      const body = await res.json().catch(() => ({})) as { error?: string };
      throw new Error(body.error ?? `HTTP ${res.status}`);
    }

    return res.json() as Promise<{ success: boolean }>;
  }
}
