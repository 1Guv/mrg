import { Injectable, inject } from '@angular/core';
import { DOCUMENT } from '@angular/common';

interface PrerenderData {
  kind: string;
  key: string;
  record: unknown;
}

/**
 * Reads the record that scripts/prerender-pages.mjs embeds in a plate or
 * article page, so the page renders its content straight away instead of a
 * loading state while Firestore answers. Google indexes what the app renders,
 * and a loading or "not found" state there is reported as a soft 404.
 *
 * Firestore still loads afterwards and replaces the record with live data.
 */
@Injectable({ providedIn: 'root' })
export class PrerenderDataService {
  private data = this.read(inject(DOCUMENT));

  /** The embedded record when this page load was for `kind`/`key`, else null. */
  get<T>(kind: string, key: string): T | null {
    return this.data?.kind === kind && this.data.key === key ? this.data.record as T : null;
  }

  private read(document: Document): PrerenderData | null {
    const text = document.getElementById('prerender-data')?.textContent;
    if (!text) return null;
    try {
      return JSON.parse(text) as PrerenderData;
    } catch {
      return null;
    }
  }
}
