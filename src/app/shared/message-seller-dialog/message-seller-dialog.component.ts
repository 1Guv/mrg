import { Component, inject } from '@angular/core';
import { CommonModule, UpperCasePipe } from '@angular/common';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { MAT_DIALOG_DATA, MatDialogRef, MatDialogModule } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { SellerEnquiryService } from '../../services/seller-enquiry.service';
import { ConversionTrackingService } from '../../services/conversion-tracking.service';
import { PlateListing } from '../../models/plate-listing.model';

@Component({
  selector: 'app-message-seller-dialog',
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    MatDialogModule,
    MatFormFieldModule,
    MatInputModule,
    MatSelectModule,
    MatButtonModule,
    MatIconModule,
    MatProgressSpinnerModule,
    UpperCasePipe
  ],
  templateUrl: './message-seller-dialog.component.html',
  styleUrl: './message-seller-dialog.component.scss'
})
export class MessageSellerDialogComponent {
  listing: PlateListing = inject(MAT_DIALOG_DATA);
  private dialogRef = inject(MatDialogRef<MessageSellerDialogComponent>);
  private fb = inject(FormBuilder);
  private enquiryService = inject(SellerEnquiryService);
  private tracking = inject(ConversionTrackingService);

  readonly enquiryTypes = [
    'I love this plate, I want to buy it',
    "I'm interested, I want to provide an offer",
    'Other'
  ];

  form: FormGroup = this.fb.group({
    enquiryType: ['', Validators.required],
    message: ['', [Validators.required, Validators.minLength(10)]]
  });

  loading = false;
  submitted = false;
  errorMessage = '';
  /** The seller's number, returned once the enquiry is sent. */
  whatsappNumber: string | null = null;

  get whatsappUrl(): string {
    const enquiryType = this.form.value.enquiryType ?? '';
    const message = this.form.value.message ?? '';
    const text = encodeURIComponent(
      `Hi, I'm enquiring about ${this.listing.plateCharacters.toUpperCase()} listed at £${this.listing.askingPrice}. ${enquiryType}. ${message}`
    );
    return `https://wa.me/${this.whatsappNumber}?text=${text}`;
  }

  async onSubmit(): Promise<void> {
    if (this.form.invalid) return;
    this.loading = true;
    this.errorMessage = '';

    try {
      this.whatsappNumber = await this.enquiryService.sendEnquiry(
        this.listing,
        this.form.value.enquiryType,
        this.form.value.message
      );
      this.tracking.enquirySent(this.form.value.enquiryType);
      this.submitted = true;
    } catch {
      this.errorMessage = 'Something went wrong. Please try again.';
    } finally {
      this.loading = false;
    }
  }
}
