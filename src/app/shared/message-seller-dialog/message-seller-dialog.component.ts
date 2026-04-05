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
import { take } from 'rxjs';
import { AuthService } from '../../../services/auth.service';
import { SellerEnquiryService } from '../../../services/seller-enquiry.service';
import { PlateListing } from '../../../models/plate-listing.model';

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
  private authService = inject(AuthService);
  private enquiryService = inject(SellerEnquiryService);

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

  get whatsappUrl(): string {
    const number = this.listing.lCNumber.replace(/\D/g, '');
    const enquiryType = this.form.value.enquiryType ?? '';
    const message = this.form.value.message ?? '';
    const text = encodeURIComponent(
      `Hi, I'm enquiring about ${this.listing.plateCharacters.toUpperCase()} listed at £${this.listing.askingPrice}. ${enquiryType}. ${message}`
    );
    return `https://wa.me/${number}?text=${text}`;
  }

  async onSubmit(): Promise<void> {
    if (this.form.invalid) return;
    this.loading = true;
    this.errorMessage = '';

    this.authService.currentUser$.pipe(take(1)).subscribe(async user => {
      try {
        await this.enquiryService.saveEnquiry({
          plateId: this.listing.id,
          plateCharacters: this.listing.plateCharacters,
          enquiryType: this.form.value.enquiryType,
          message: this.form.value.message,
          buyerUid: user!.uid,
          buyerEmail: user!.email ?? '',
          sellerLCNumber: this.listing.lCNumber
        });
        this.submitted = true;
      } catch {
        this.errorMessage = 'Something went wrong. Please try again.';
      } finally {
        this.loading = false;
      }
    });
  }
}
