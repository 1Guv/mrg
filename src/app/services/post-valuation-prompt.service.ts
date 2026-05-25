import { inject, Injectable } from '@angular/core';
import { Auth } from '@angular/fire/auth';
import { MatDialog } from '@angular/material/dialog';
import { ValuationService } from './valuation.service';
import { UserDetailsDialogComponent } from '../core/dialogs/user-details-dialog/user-details-dialog.component';

/**
 * Opens the user-details dialog once per session, 1.5 s after a valuation
 * result is shown, but only when the visitor is not already logged in.
 *
 * Uses auth.currentUser (synchronous) rather than the observable — by the
 * time the user completes a valuation, Firebase has long since resolved its
 * auth state from persistence.
 */
@Injectable({ providedIn: 'root' })
export class PostValuationPromptService {
  private dialog = inject(MatDialog);
  private auth = inject(Auth);
  private valuationService = inject(ValuationService);
  private shown = false;

  promptIfNeeded(): void {
    if (this.shown) return;
    if (this.auth.currentUser) return;
    this.shown = true;
    setTimeout(() => {
      const ref = this.dialog.open(UserDetailsDialogComponent, { width: '520px', disableClose: true });
      ref.afterClosed().subscribe((details) => {
        if (details) this.valuationService.setUserDetails(details);
      });
    }, 1500);
  }
}
