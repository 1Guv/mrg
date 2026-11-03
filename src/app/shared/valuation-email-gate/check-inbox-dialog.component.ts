import { Component, inject, signal } from '@angular/core';
import { MAT_DIALOG_DATA, MatDialogModule } from '@angular/material/dialog';
import { MatButtonModule } from '@angular/material/button';
import { EmailLinkSignInService } from '../../services/email-link-sign-in.service';

export interface CheckInboxDialogData {
  email: string;
  registration: string;
  /** Path and query of the pre-filled /list-plate page the link returns to. */
  listPath: string;
}

/** Shown when "List it" can't sign the visitor in here, e.g. the email already has an account. */
@Component({
  selector: 'app-check-inbox-dialog',
  standalone: true,
  imports: [MatDialogModule, MatButtonModule],
  template: `
    <h2 mat-dialog-title>Check your inbox</h2>
    <mat-dialog-content>
      <p class="prompt-message">
        We've emailed <strong>{{ data.email }}</strong> a link to finish
        listing <strong>{{ data.registration }}</strong>. It signs you in and fills in the details for you.
      </p>
      @if (resent()) {
        <p class="prompt-message">Sent again. Check your spam folder if it hasn't arrived.</p>
      }
    </mat-dialog-content>
    <mat-dialog-actions align="end">
      <button mat-button [disabled]="resent()" (click)="resend()">Resend</button>
      <button mat-raised-button color="primary" mat-dialog-close>OK</button>
    </mat-dialog-actions>
  `,
  styleUrl: '../auth-prompt-dialog/auth-prompt-dialog.component.scss'
})
export class CheckInboxDialogComponent {
  data: CheckInboxDialogData = inject(MAT_DIALOG_DATA);
  private emailLink = inject(EmailLinkSignInService);
  resent = signal(false);

  async resend(): Promise<void> {
    await this.emailLink.sendLink(this.data.email, window.location.origin + this.data.listPath);
    this.resent.set(true);
  }
}
