import { Component, inject, signal } from '@angular/core';
import { DecimalPipe } from '@angular/common';
import { MAT_DIALOG_DATA, MatDialogModule } from '@angular/material/dialog';
import { MatButtonModule } from '@angular/material/button';
import { PayPerEnquiryService } from '../../services/pay-per-enquiry.service';

export interface ListingCheckInboxData {
  email: string;
  plate: string;
  askingPrice: number;
  pendingId: string;
}

/** Webmail inboxes we can open straight from the dialog, by email domain. */
const INBOXES: Record<string, { name: string; url: string }> = {
  'gmail.com': { name: 'Gmail', url: 'https://mail.google.com/mail/u/0/#inbox' },
  'googlemail.com': { name: 'Gmail', url: 'https://mail.google.com/mail/u/0/#inbox' },
  'outlook.com': { name: 'Outlook', url: 'https://outlook.live.com/mail/0/inbox' },
  'hotmail.com': { name: 'Outlook', url: 'https://outlook.live.com/mail/0/inbox' },
  'hotmail.co.uk': { name: 'Outlook', url: 'https://outlook.live.com/mail/0/inbox' },
  'live.com': { name: 'Outlook', url: 'https://outlook.live.com/mail/0/inbox' },
  'live.co.uk': { name: 'Outlook', url: 'https://outlook.live.com/mail/0/inbox' },
  'yahoo.com': { name: 'Yahoo Mail', url: 'https://mail.yahoo.com/' },
  'yahoo.co.uk': { name: 'Yahoo Mail', url: 'https://mail.yahoo.com/' },
  'icloud.com': { name: 'iCloud Mail', url: 'https://www.icloud.com/mail' },
};

/**
 * After a signed-out visitor taps Publish: their listing waits for the
 * emailed link, so say so where they can't miss it.
 */
@Component({
  selector: 'app-listing-check-inbox-dialog',
  standalone: true,
  imports: [DecimalPipe, MatDialogModule, MatButtonModule],
  templateUrl: './listing-check-inbox-dialog.component.html',
  styleUrl: './listing-check-inbox-dialog.component.scss'
})
export class ListingCheckInboxDialogComponent {
  private payPerEnquiry = inject(PayPerEnquiryService);
  readonly data = inject<ListingCheckInboxData>(MAT_DIALOG_DATA);

  readonly inbox = INBOXES[this.data.email.split('@')[1]?.toLowerCase() ?? ''] ?? null;
  readonly resent = signal(false);
  readonly resending = signal(false);
  readonly errorMessage = signal('');

  async resend(): Promise<void> {
    this.resending.set(true);
    this.errorMessage.set('');
    try {
      await this.payPerEnquiry.resendPendingListing(this.data.pendingId);
      this.resent.set(true);
    } catch (err) {
      const code = (err as { code?: string }).code ?? '';
      this.errorMessage.set(code.endsWith('resource-exhausted') ?
        "We've sent it a few times already. Please check your spam folder." :
        'Something went wrong. Please try again.');
    } finally {
      this.resending.set(false);
    }
  }
}
