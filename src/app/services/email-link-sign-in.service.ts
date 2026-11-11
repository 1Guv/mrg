import { inject, Injectable } from '@angular/core';
import { Auth, isSignInWithEmailLink, signInWithCustomToken, signInWithEmailLink } from '@angular/fire/auth';
import { Functions, httpsCallable } from '@angular/fire/functions';
import { MatDialog } from '@angular/material/dialog';
import { MatSnackBar } from '@angular/material/snack-bar';
import { Router } from '@angular/router';
import { firstValueFrom } from 'rxjs';
import { ConfirmEmailDialogComponent } from '../shared/confirm-email-dialog/confirm-email-dialog.component';

const EMAIL_STORAGE_KEY = 'emailForSignIn';
const LINK_PARAMS = ['signin', 'apiKey', 'oobCode', 'mode', 'lang', 'continueUrl', 'tenantId'];

/**
 * Passwordless sign-in from emailed links.
 *
 * Links come from two places: the valuation email (captureValuationEmail)
 * and "Email me a sign-in link" (sendSignInLink). Both land on a page whose
 * URL carries a ?signin= token; completeIfPresent() swaps it for a custom
 * token, which works on any device without asking for the email again, and
 * strips it so the page keeps its own params. Firebase email links (oobCode)
 * sent before the switch are still handled the old way.
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
    return this.tokenInUrl() !== null || isSignInWithEmailLink(this.auth, window.location.href);
  }

  private tokenInUrl(): string | null {
    return new URL(window.location.href).searchParams.get('signin');
  }

  private async completeIfPresent(): Promise<void> {
    const href = window.location.href;
    const token = this.tokenInUrl();
    if (token !== null) {
      await this.signInWithToken(token);
    } else if (isSignInWithEmailLink(this.auth, href)) {
      await this.signInWithFirebaseLink(href);
    } else {
      return;
    }

    // GitHub Pages redirects /list-plate to /list-plate/, and the router
    // doesn't match a trailing slash, so drop it.
    const clean = new URL(this.stripLinkParams(href));
    const path = clean.pathname.replace(/\/+$/, '') || '/';
    await this.router.navigateByUrl(path + clean.search, { replaceUrl: true });
  }

  private async signInWithToken(token: string): Promise<void> {
    try {
      const fn = httpsCallable<{ token: string }, { customToken: string }>(this.functions, 'redeemSignInLink');
      await signInWithCustomToken(this.auth, (await fn({ token })).data.customToken);
      this.snackBar.open('You are signed in', 'OK', { duration: 4000 });
    } catch (err) {
      const code = (err as { code?: string }).code;
      console.error('Sign-in link failed', code, err);
      this.snackBar.open(
        code === 'functions/deadline-exceeded'
          ? 'That sign-in link has expired. Request a new one from the login page.'
          : "That sign-in link didn't work. Request a new one from the login page.",
        'OK'
      );
    }
  }

  private async signInWithFirebaseLink(href: string): Promise<void> {
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
  }

  private stripLinkParams(href: string): string {
    const url = new URL(href);
    LINK_PARAMS.forEach((p) => url.searchParams.delete(p));
    return url.toString();
  }
}
