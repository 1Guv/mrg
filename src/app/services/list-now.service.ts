import { inject, Injectable } from '@angular/core';
import { Functions, httpsCallable } from '@angular/fire/functions';
import { ValuationGateService } from './valuation-gate.service';

export type SellIntent = 'yes' | 'later' | 'curious';

/** Why a visitor chose "Not now" instead of publishing. */
export type NotNowReason = 'price' | 'not_ready' | 'curious' | 'fee' | 'other';

export type MeaningCategory = 'name' | 'word' | 'car' | 'business' | 'date' | 'other';

export interface PlateMeaning {
  category: MeaningCategory;
  text: string;
}

export interface ResultVoucher {
  code: string;
  percentOff: number;
  /** Epoch ms. */
  expiresAt: number;
}

/**
 * Server calls behind the "Would you sell?" block on a revealed valuation:
 * real buyer demand, recording the answer, and the 48-hour 10% voucher.
 * Results are cached per plate for the session, so changing answers and
 * recalculating doesn't call again or mint a second voucher.
 */
@Injectable({ providedIn: 'root' })
export class ListNowService {
  private functions = inject(Functions);
  private gate = inject(ValuationGateService);

  private demand = new Map<string, Promise<number>>();
  private vouchers = new Map<string, Promise<ResultVoucher | null>>();
  private intents = new Map<string, SellIntent>();
  private meanings = new Map<string, PlateMeaning>();

  /** Matching buyer searches in the last 30 days; 0 when too few to show. */
  buyerDemand(registration: string): Promise<number> {
    const reg = this.key(registration);
    if (!this.demand.has(reg)) {
      const fn = httpsCallable<{ registration: string }, { count: number }>(this.functions, 'getBuyerDemand');
      this.demand.set(reg, fn({ registration: reg }).then(r => r.data.count).catch(() => 0));
    }
    return this.demand.get(reg)!;
  }

  /** The visitor's 10% voucher for this plate, or null if there isn't one. */
  voucher(registration: string): Promise<ResultVoucher | null> {
    const reg = this.key(registration);
    if (!this.vouchers.has(reg)) {
      const fn = httpsCallable<{ registration: string; email?: string }, ResultVoucher | null>(
        this.functions, 'getResultVoucher');
      this.vouchers.set(reg, fn({ registration: reg, ...this.email() })
        .then(r => r.data)
        .catch(() => null));
    }
    return this.vouchers.get(reg)!.then(v => (v && v.expiresAt > Date.now() ? v : null));
  }

  answer(registration: string): SellIntent | null {
    return this.intents.get(this.key(registration)) ?? null;
  }

  async recordAnswer(registration: string, answer: SellIntent, reason?: NotNowReason, reasonText?: string): Promise<void> {
    const reg = this.key(registration);
    this.intents.set(reg, answer);
    type Request = { registration: string; answer: SellIntent; reason?: NotNowReason; reasonText?: string; email?: string };
    const fn = httpsCallable<Request, { recorded: boolean }>(this.functions, 'recordSellIntent');
    try {
      await fn({
        registration: reg, answer,
        ...(reason ? { reason } : {}),
        ...(reasonText ? { reasonText } : {}),
        ...this.email(),
      });
    } catch {
      // The answer still shapes this page; the nudge schedule just stays as is.
    }
  }

  meaning(registration: string): PlateMeaning | null {
    return this.meanings.get(this.key(registration)) ?? null;
  }

  async recordMeaning(registration: string, meaning: PlateMeaning): Promise<void> {
    const reg = this.key(registration);
    this.meanings.set(reg, meaning);
    const fn = httpsCallable<{ registration: string; category: MeaningCategory; text: string; email?: string },
      { recorded: boolean }>(this.functions, 'recordPlateMeaning');
    try {
      await fn({ registration: reg, ...meaning, ...this.email() });
    } catch {
      // The meaning still pre-fills their listing; we just don't keep a copy.
    }
  }

  /** Query params that carry a live voucher through to /list-plate. */
  voucherParams(voucher: ResultVoucher | null): Record<string, string> {
    return voucher && voucher.expiresAt > Date.now() ?
      { voucher: voucher.code, voucherExpires: String(voucher.expiresAt), from: 'result' } :
      { from: 'result' };
  }

  private email(): { email?: string } {
    const email = this.gate.givenEmail();
    return email ? { email } : {};
  }

  private key(registration: string): string {
    return registration.replace(/\s/g, '').toUpperCase();
  }
}
