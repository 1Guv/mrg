import { Component, inject } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
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
import { AuthService } from '../../services/auth.service';
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
  /** undefined while auth loads, null when signed out. */
  private readonly user = toSignal(inject(AuthService).currentUser$);

  private readonly plate = this.listing.plateCharacters.toUpperCase();

  /** Most asked first. Picking one fills in a message they can send as is. */
  readonly enquiryTypes: { label: string; message: string }[] = [
    { label: 'Is it still available?', message: `Hi, is ${this.plate} still available?` },
    {
      label: 'I want to buy it at the asking price',
      message: `Hi, I'd like to buy ${this.plate} at the asking price of £${this.listing.askingPrice}. How do we proceed?`
    },
    { label: "I'd like to make an offer", message: `Hi, I'm interested in ${this.plate}. Would you accept an offer of £` },
    { label: 'Is the price negotiable?', message: `Hi, is the price of ${this.plate} negotiable? What's the best you can do?` },
    {
      label: 'Is it on retention or on a vehicle?',
      message: `Hi, is ${this.plate} on a retention certificate or on a vehicle?`
    },
    { label: 'Can it go on my car?', message: `Hi, can ${this.plate} go on my car? It's a ` },
    {
      label: "I'd like to swap or part-exchange a plate",
      message: `Hi, would you consider swapping or part-exchanging ${this.plate} for my plate, `
    },
    { label: 'Other', message: '' }
  ];

  form: FormGroup = this.fb.group({
    enquiryType: ['', Validators.required],
    message: ['', [Validators.required, Validators.minLength(10)]],
    // Only asked for when signed out; see isGuest.
    email: ['', [Validators.email, Validators.maxLength(254)]],
    // Hidden from people; bots fill it in.
    website: ['']
  });

  /** The message we last filled in, so we never replace one they typed. */
  private prefilled = '';

  constructor() {
    this.form.get('enquiryType')!.valueChanges.subscribe((label: string) => {
      const message = this.form.get('message')!;
      const current = (message.value ?? '').trim();
      if (current && current !== this.prefilled.trim()) return;
      this.prefilled = this.enquiryTypes.find(t => t.label === label)?.message ?? '';
      message.setValue(this.prefilled);
    });
  }

  /** Signed out: they give an email instead of logging in. */
  get isGuest(): boolean {
    return this.user() === null;
  }

  get canSend(): boolean {
    return this.form.valid && (!this.isGuest || !!this.form.value.email?.trim());
  }

  loading = false;
  submitted = false;
  errorMessage = '';
  /** The seller's number, returned once the enquiry is sent. */
  whatsappNumber: string | null = null;
  /** The seller has been emailed and must unlock the enquiry to reply. */
  sellerNotified = false;
  /** Sent without an account: replies and a sign-in link go to their email. */
  sentAsGuest = false;

  get whatsappUrl(): string {
    const enquiryType = this.form.value.enquiryType ?? '';
    const message = this.form.value.message ?? '';
    const text = encodeURIComponent(
      `Hi, I'm enquiring about ${this.listing.plateCharacters.toUpperCase()} listed at £${this.listing.askingPrice}. ${enquiryType}. ${message}`
    );
    return `https://wa.me/${this.whatsappNumber}?text=${text}`;
  }

  async onSubmit(): Promise<void> {
    if (!this.canSend) return;
    this.loading = true;
    this.errorMessage = '';
    const { enquiryType, message, email, website } = this.form.value;
    const guest = this.isGuest;

    try {
      const result = guest ?
        await this.enquiryService.sendGuestEnquiry(this.listing, enquiryType, message, email.trim(), website) :
        await this.enquiryService.sendEnquiry(this.listing, enquiryType, message);
      this.whatsappNumber = result.whatsappNumber;
      this.sellerNotified = !!result.sellerNotified;
      this.sentAsGuest = guest;
      this.tracking.enquirySent(enquiryType, guest);
      this.submitted = true;
    } catch (err) {
      const code = (err as { code?: string }).code ?? '';
      this.errorMessage =
        code.endsWith('resource-exhausted') ? "You've sent a few messages already. Please try again in an hour." :
        code.endsWith('invalid-argument') ? 'Please check your email address and message.' :
        'Something went wrong. Please try again.';
    } finally {
      this.loading = false;
    }
  }
}
