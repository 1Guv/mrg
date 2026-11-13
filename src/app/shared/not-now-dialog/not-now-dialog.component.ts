import { Component, inject, signal } from '@angular/core';
import { DecimalPipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MAT_DIALOG_DATA, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatButtonModule } from '@angular/material/button';
import { Router } from '@angular/router';
import { ConversionTrackingService } from '../../services/conversion-tracking.service';
import { ListNowService, NotNowReason, SellIntent } from '../../services/list-now.service';
import { NumberPlateFormService } from '../../services/number-plate-form.service';
import { SharedPlateDataService } from '../../services/shared-plate-data.service';

export interface NotNowDialogData {
  plate: string;
  plateType: string;
  askingPrice: number;
  fee: number;
}

/** Closes with a price when the visitor decides to publish after all. */
export interface NotNowDialogResult {
  publishAt: number;
}

/**
 * "Not now, just keep my valuation": one tap on why, then an answer that fits
 * the reason. The reason is recorded, so we learn what stops people listing.
 */
@Component({
  selector: 'app-not-now-dialog',
  standalone: true,
  imports: [DecimalPipe, FormsModule, MatDialogModule, MatButtonModule],
  templateUrl: './not-now-dialog.component.html',
  styleUrl: './not-now-dialog.component.scss'
})
export class NotNowDialogComponent {
  private dialogRef = inject(MatDialogRef<NotNowDialogComponent, NotNowDialogResult>);
  private listNow = inject(ListNowService);
  private tracking = inject(ConversionTrackingService);
  private router = inject(Router);
  private plateData = inject(SharedPlateDataService);
  private plateForm = inject(NumberPlateFormService);
  readonly data = inject<NotNowDialogData>(MAT_DIALOG_DATA);

  readonly reasons: { value: NotNowReason; icon: string; label: string }[] = [
    { value: 'price', icon: '💷', label: "I think it's worth more (or less)" },
    { value: 'not_ready', icon: '⏳', label: 'Not ready to sell yet' },
    { value: 'curious', icon: '🤔', label: "Just curious what it's worth" },
    { value: 'fee', icon: '💳', label: `Not sure about the £${this.data.fee}` },
    { value: 'other', icon: '✏️', label: 'Something else…' },
  ];

  readonly reason = signal<NotNowReason | null>(null);
  price = this.data.askingPrice;
  otherText = '';
  otherSent = signal(false);

  choose(reason: NotNowReason): void {
    this.reason.set(reason);
    // "Other" is recorded once they've had the chance to say what it is.
    if (reason !== 'other') this.record(reason);
  }

  sendOther(): void {
    this.record('other', this.otherText.trim());
    this.otherSent.set(true);
  }

  skip(): void {
    this.record();
    this.dialogRef.close();
  }

  publish(): void {
    const price = Math.round(Number(this.price));
    if (!Number.isFinite(price) || price < 1) return;
    this.dialogRef.close({ publishAt: price });
  }

  /** Back to an empty valuation form at the top of the home page. */
  valueAnother(): void {
    this.dialogRef.close();
    this.plateData.setCurrentPlatePending(null);
    this.plateData.setPrefixPlatePending(null);
    this.plateData.setSuffixPlatePending(null);
    this.plateForm.triggerReset();
    this.router.navigate(['/']).then(() => window.scrollTo({ top: 0, behavior: 'smooth' }));
  }

  close(): void {
    if (this.reason() === 'other' && !this.otherSent()) this.record('other');
    this.dialogRef.close();
  }

  private record(reason?: NotNowReason, text?: string): void {
    // Just curious stops the selling emails; every other reason keeps the weekly check-in.
    const answer: SellIntent = reason === 'curious' ? 'curious' : 'later';
    this.tracking.sellIntentAnswered(answer, this.data.plateType, reason);
    this.listNow.recordAnswer(this.data.plate, answer, reason, text);
  }
}
