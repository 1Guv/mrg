import { inject, Injectable } from '@angular/core';
import { MatDialog } from '@angular/material/dialog';
import { firstValueFrom } from 'rxjs';
import { AuthService } from './auth.service';
import { ValuationService } from './valuation.service';
import { UserDetailsDialogComponent } from '../core/dialogs/user-details-dialog/user-details-dialog.component';

/**
 * Opens the user-details dialog once per session, 1.5 s after a valuation
 * result is shown, but only when the visitor is not already logged in.
 */
@Injectable({ providedIn: 'root' })
export class PostValuationPromptService {
  private dialog = inject(MatDialog);
  private authService = inject(AuthService);
  private valuationService = inject(ValuationService);
  private shown = false;

  async promptIfNeeded(): Promise<void> {
    if (this.shown) return;
    const user = await firstValueFrom(this.authService.currentUser$);
    if (user) return;
    this.shown = true;
    setTimeout(() => {
      const ref = this.dialog.open(UserDetailsDialogComponent, { width: '520px' });
      ref.afterClosed().subscribe((details) => {
        if (details) this.valuationService.setUserDetails(details);
      });
    }, 1500);
  }
}
