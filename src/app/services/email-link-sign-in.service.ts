import { inject, Injectable } from '@angular/core';
import { Auth, isSignInWithEmailLink, signInWithEmailLink } from '@angular/fire/auth';
import { Functions, httpsCallable } from '@angular/fire/functions';
import { MatDialog } from '@angular/material/dialog';
import { MatSnackBar } from '@angular/material/snack-bar';
import { Router } from '@angular/router';
import { firstValueFrom } from 'rxjs';
import { ConfirmEmailDialogComponent } from '../shared/confirm-email-dialog/confirm-email-dialog.component';

const EMAIL_STORAGE_KEY = 'emailForSignIn';
const LINK_PARAMS = ['apiKey', 'oobCode', 'mode', 'lang', 'continueUrl', 'tenantId'];

/**
 * Passwordless sign-in with Firebase email links.
 *
 * Links come from two places: the valuation email (captureValuationEmail)
 * and "Email me a sign-in link" (sendSignInLink). Both are generated and sent
 * server-side, from our own mail sender rather than Firebase's. Both
 * land on a page whose URL carries the link's oobCode; completeIfPresent()
 * signs the visitor in and strips those params so the page keeps its own.
 */
@Injectable({ providedIn: 'root' })
export class EmailLinkSignInService {
  private auth = inject(Auth);
  private functions = inject(Functions);
  private dialog = inject(MatDialog);
  private snackBar = inject(MatSnackBar);
  private router = inject(Router);

  /** Resolves once any sign-in link in the current URL has been handled. */
  readonly ready: Promise<void> = this.completeIfPresent();

  /** Firebase asks for the email again when a link is opened on another device. */
  rememberEmail(email: string): void {
    try {
      localStorage.setItem(EMAIL_STORAGE_KEY, email);
    } catch {
      // Storage can be blocked; the visitor will be asked to confirm instead.
    }
  }

  async sendLink(email: string, returnUrl: string = window.location.href): Promise<void> {
    const fn = httpsCallable<{ email: string; returnUrl: string }, { sent: boolean }>(this.functions, 'sendSignInLink');
    await fn({ email, returnUrl: this.stripLinkParams(returnUrl) });
    this.rememberEmail(email);
  }

  hasLinkInUrl(): boolean {
    return isSignInWithEmailLink(this.auth, window.location.href);
  }

  private async completeIfPresent(): Promise<void> {
    const href = window.location.href;
    if (!isSignInWithEmailLink(this.auth, href)) {
      if (/[?&]pending=/.test(href)) console.warn('Listing link opened without a sign-in code', href);
      return;
    }

    let email: string | null = null;
    try {
      email = localStorage.getItem(EMAIL_STORAGE_KEY);
    } catch {
      // Fall through to asking.
    }
    if (!email) {
      const ref = this.dialog.open(ConfirmEmailDialogComponent, { width: '380px', disableClose: true });
      email = (await firstValueFrom(ref.afterClosed())) ?? null;
    }

    if (email) {
      try {
        await signInWithEmailLink(this.auth, email, href);
        try {
          localStorage.removeItem(EMAIL_STORAGE_KEY);
        } catch {
          // Nothing to clean up.
        }
        this.snackBar.open('You are signed in', 'OK', { duration: 4000 });
      } catch (err) {
        console.error('Email link sign-in failed', (err as { code?: string }).code, err);
        this.snackBar.open('That sign-in link has expired or was already used. Request a new one from the login page.', 'OK');
      }
    }

    const clean = new URL(this.stripLinkParams(href));
    await this.router.navigateByUrl(clean.pathname + clean.search, { replaceUrl: true });
  }

  private stripLinkParams(href: string): string {
    const url = new URL(href);
    LINK_PARAMS.forEach((p) => url.searchParams.delete(p));
    return url.toString();
  }
}
