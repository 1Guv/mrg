import { Component, inject } from '@angular/core';
import { CommonModule, UpperCasePipe } from '@angular/common';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { MAT_DIALOG_DATA, MatDialogRef, MatDialogModule } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { SellerEnquiryService, SellerEnquiry } from '../../services/seller-enquiry.service';

@Component({
  selector: 'app-reply-to-enquiry-dialog',
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    MatDialogModule,
    MatFormFieldModule,
    MatInputModule,
    MatButtonModule,
    MatIconModule,
    MatProgressSpinnerModule,
    UpperCasePipe
  ],
  templateUrl: './reply-to-enquiry-dialog.component.html',
  styleUrl: './reply-to-enquiry-dialog.component.scss'
})
export class ReplyToEnquiryDialogComponent {
  enquiry: SellerEnquiry = inject(MAT_DIALOG_DATA);
  private dialogRef = inject(MatDialogRef<ReplyToEnquiryDialogComponent>);
  private fb = inject(FormBuilder);
  private enquiryService = inject(SellerEnquiryService);

  form: FormGroup = this.fb.group({
    replyMessage: ['', [Validators.required, Validators.minLength(10)]]
  });

  loading = false;
  submitted = false;
  errorMessage = '';

  async onSubmit(): Promise<void> {
    if (this.form.invalid) return;
    this.loading = true;
    this.errorMessage = '';
    try {
      await this.enquiryService.sendReply(this.enquiry, this.form.value.replyMessage);
      this.submitted = true;
    } catch {
      this.errorMessage = 'Something went wrong. Please try again.';
    } finally {
      this.loading = false;
    }
  }
}
