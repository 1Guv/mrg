import { Component, inject, signal } from '@angular/core';
import { FormControl, ReactiveFormsModule, Validators } from '@angular/forms';
import { MatDialogRef, MatDialogModule, MAT_DIALOG_DATA } from '@angular/material/dialog';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { Router } from '@angular/router';
import { EmailLinkSignInService } from '../../services/email-link-sign-in.service';

export interface AuthPromptDialogData {
  title?: string;
  message?: string;
  /** Offer "Email me a sign-in link" that returns to the current page. */
  offerEmailLink?: boolean;
}

@Component({
  selector: 'app-auth-prompt-dialog',
  standalone: true,
  imports: [MatDialogModule, MatButtonModule, MatFormFieldModule, MatInputModule, ReactiveFormsModule],
  templateUrl: './auth-prompt-dialog.component.html',
  styleUrl: './auth-prompt-dialog.component.scss'
})
export class AuthPromptDialogComponent {
  private dialogRef = inject(MatDialogRef<AuthPromptDialogComponent>);
  private router = inject(Router);
  private emailLink = inject(EmailLinkSignInService);
  private data: AuthPromptDialogData = inject(MAT_DIALOG_DATA, { optional: true }) ?? {};

  title = this.data.title ?? 'Sign in to message the seller';
  message = this.data.message ?? 'You need to be logged in to message a seller. Please log in or create a free account to continue.';
  offerEmailLink = !!this.data.offerEmailLink;

  linkEmail = new FormControl('', { nonNullable: true, validators: [Validators.required, Validators.email] });
  linkSent = signal(false);
  linkError = signal('');

  async sendLink(): Promise<void> {
    if (this.linkEmail.invalid) return;
    this.linkError.set('');
    try {
      await this.emailLink.sendLink(this.linkEmail.value.trim());
      this.linkSent.set(true);
    } catch {
      this.linkError.set('Could not send the link. Please check the address and try again.');
    }
  }

  goToLogin(): void {
    this.dialogRef.close();
    // Come back to this page, e.g. the listing form with the plate filled in.
    this.router.navigate(['/login'], { queryParams: { returnUrl: this.router.url } });
  }

  goToRegister(): void {
    this.dialogRef.close();
    this.router.navigate(['/register'], { queryParams: { returnUrl: this.router.url } });
  }
}
