import { Component, computed, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { toSignal } from '@angular/core/rxjs-interop';
import { VoucherService } from '../../services/voucher.service';

const DISMISSED_KEY = 'voucherBannerDismissedCode';

@Component({
  selector: 'app-voucher-banner',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './voucher-banner.component.html',
  styleUrl: './voucher-banner.component.scss'
})
export class VoucherBannerComponent {
  private voucherService = inject(VoucherService);

  private vouchers = toSignal(this.voucherService.getActivePublicVouchers(), { initialValue: [] });
  private dismissedCode = signal(localStorage.getItem(DISMISSED_KEY));

  activeVoucher = computed(() => {
    const now = Date.now();
    const candidates = this.vouchers().filter(v => {
      if (!v.expiresAt) return true;
      const expiresAtMs = v.expiresAt?.toDate ? v.expiresAt.toDate().getTime() : new Date(v.expiresAt).getTime();
      return expiresAtMs > now;
    });
    return candidates[0] ?? null;
  });

  visible = computed(() => {
    const voucher = this.activeVoucher();
    return !!voucher && voucher.code !== this.dismissedCode();
  });

  dismiss(): void {
    const voucher = this.activeVoucher();
    if (!voucher) return;
    this.dismissedCode.set(voucher.code);
    localStorage.setItem(DISMISSED_KEY, voucher.code);
  }
}
