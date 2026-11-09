import { Component, inject, input } from '@angular/core';
import { RouterLink } from '@angular/router';
import { MatIconModule } from '@angular/material/icon';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { AdminsService } from '../../services/admins.service';
import { ConversionTrackingService } from '../../services/conversion-tracking.service';

/** Tagged so Google Analytics shows the visits admin Facebook posts bring in. */
const FACEBOOK_GROUP_URL =
  'https://mrvaluations.co.uk/?utm_source=facebook&utm_medium=group&utm_campaign=admin_valuation';

@Component({
  selector: 'app-share-buttons',
  standalone: true,
  imports: [MatIconModule, MatSnackBarModule, RouterLink],
  templateUrl: './share-buttons.component.html',
  styleUrl: './share-buttons.component.scss'
})
export class ShareButtonsComponent {
  shareText = input.required<string>();
  viewListingLink = input<string[] | null>(null);

  private snackBar = inject(MatSnackBar);
  private tracking = inject(ConversionTrackingService);
  readonly isAdmin = inject(AdminsService).currentUserIsAdmin;

  get whatsappShareUrl(): string {
    return `https://wa.me/?text=${encodeURIComponent(this.shareText())}`;
  }

  get facebookShareUrl(): string {
    return `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(window.location.href)}&quote=${encodeURIComponent(this.shareText())}`;
  }

  onShare() {
    if (navigator.share) {
      this.tracking.shared('native');
      navigator.share({ title: 'MR Valuations', text: this.shareText(), url: window.location.href });
    } else {
      this.onCopyToClipboard();
    }
  }

  onShareLink(method: 'whatsapp' | 'facebook') {
    this.tracking.shared(method);
  }

  /** Admin only: the valuation and a tracked link, ready to paste in a Facebook group. */
  onCopyForFacebookGroup() {
    navigator.clipboard.writeText(`${this.shareText()} Value yours free: ${FACEBOOK_GROUP_URL}`);
    this.snackBar.open('Copied for Facebook, with a tracked link', 'Close', { duration: 3000 });
  }

  onCopyToClipboard() {
    this.tracking.shared('copy');
    navigator.clipboard.writeText(this.shareText());
    this.snackBar.open('Valuation copied to clipboard!', 'Close', { duration: 3000 });
  }
}
