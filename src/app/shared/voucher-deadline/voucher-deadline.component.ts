import { Component, effect, inject, input, signal } from '@angular/core';
import { DatePipe } from '@angular/common';
import { ListNowService, ResultVoucher } from '../../services/list-now.service';

/** "10% off until Wed 5 Nov, 3:30 PM" for the visitor's voucher on a plate; nothing if there isn't one. */
@Component({
  selector: 'app-voucher-deadline',
  standalone: true,
  imports: [DatePipe],
  template: `
    @if (voucher(); as v) {
      <p class="voucher-deadline">{{ v.percentOff }}% off until {{ v.expiresAt | date: 'EEE d MMM, h:mm a' }}</p>
    }
  `,
  styles: [`
    .voucher-deadline { margin: 0; font-size: 0.875rem; font-weight: 600; color: #2e7d32; text-align: center; }
  `]
})
export class VoucherDeadlineComponent {
  private listNow = inject(ListNowService);

  readonly registration = input.required<string>();
  readonly voucher = signal<ResultVoucher | null>(null);

  constructor() {
    effect(() => {
      const reg = this.registration();
      this.voucher.set(null);
      this.listNow.voucher(reg).then(v => {
        if (reg === this.registration()) this.voucher.set(v);
      });
    });
  }
}
