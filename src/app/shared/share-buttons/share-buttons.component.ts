import { Component, inject, input } from '@angular/core';
import { RouterLink } from '@angular/router';
import { MatIconModule } from '@angular/material/icon';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { ConversionTrackingService } from '../../services/conversion-tracking.service';

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

  onCopyToClipboard() {
    this.tracking.shared('copy');
    navigator.clipboard.writeText(this.shareText());
    this.snackBar.open('Valuation copied to clipboard!', 'Close', { duration: 3000 });
  }
}
