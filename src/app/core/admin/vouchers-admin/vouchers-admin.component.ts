import { Component, inject, signal } from '@angular/core';
import { CommonModule, DatePipe } from '@angular/common';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatButtonModule } from '@angular/material/button';
import { MatTableModule } from '@angular/material/table';
import { toSignal } from '@angular/core/rxjs-interop';
import { VoucherService } from '../../../services/voucher.service';

@Component({
  selector: 'app-vouchers-admin',
  standalone: true,
  imports: [
    CommonModule,
    DatePipe,
    ReactiveFormsModule,
    MatFormFieldModule,
    MatInputModule,
    MatButtonModule,
    MatTableModule,
  ],
  templateUrl: './vouchers-admin.component.html',
  styleUrl: './vouchers-admin.component.scss'
})
export class VouchersAdminComponent {
  private fb = inject(FormBuilder);
  private voucherService = inject(VoucherService);

  vouchers = toSignal(this.voucherService.getAllPublicVouchers(), { initialValue: [] });
  columns = ['code', 'percentOff', 'description', 'expiresAt', 'active', 'actions'];

  creating = signal(false);
  createError = signal('');
  deactivatingId = signal<string | null>(null);

  form: FormGroup = this.fb.group({
    code: ['', [Validators.required, Validators.minLength(3)]],
    percentOff: ['', [Validators.required, Validators.min(1), Validators.max(100)]],
    description: ['', Validators.required],
    expiresAt: [''],
    maxRedemptions: [''],
  });

  async onSubmit(): Promise<void> {
    if (this.form.invalid) return;
    this.creating.set(true);
    this.createError.set('');
    try {
      await this.voucherService.createVoucher({
        code: this.form.value.code.toUpperCase(),
        percentOff: Number(this.form.value.percentOff),
        description: this.form.value.description,
        expiresAt: this.form.value.expiresAt || null,
        maxRedemptions: this.form.value.maxRedemptions ? Number(this.form.value.maxRedemptions) : null,
      });
      this.form.reset();
    } catch {
      this.createError.set('Failed to create voucher. Please try again.');
    } finally {
      this.creating.set(false);
    }
  }

  async deactivate(voucherId: string): Promise<void> {
    this.deactivatingId.set(voucherId);
    try {
      await this.voucherService.deactivateVoucher(voucherId);
    } finally {
      this.deactivatingId.set(null);
    }
  }
}
