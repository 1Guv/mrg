import { Component, inject, input } from '@angular/core';
import { MatIconModule } from '@angular/material/icon';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';

@Component({
  selector: 'app-share-buttons',
  standalone: true,
  imports: [MatIconModule, MatSnackBarModule],
  templateUrl: './share-buttons.component.html',
  styleUrl: './share-buttons.component.scss'
})
export class ShareButtonsComponent {
  shareText = input.required<string>();

  private snackBar = inject(MatSnackBar);

  get whatsappShareUrl(): string {
    return `https://wa.me/?text=${encodeURIComponent(this.shareText())}`;
  }

  get facebookShareUrl(): string {
    return `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(window.location.href)}&quote=${encodeURIComponent(this.shareText())}`;
  }

  onShare() {
    if (navigator.share) {
      navigator.share({ title: 'MR Valuations', text: this.shareText(), url: window.location.href });
    } else {
      this.onCopyToClipboard();
    }
  }

  onCopyToClipboard() {
    navigator.clipboard.writeText(this.shareText());
    this.snackBar.open('Valuation copied to clipboard!', 'Close', { duration: 3000 });
  }
}
