import { Component, inject, OnInit } from '@angular/core';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import { MatCardModule } from '@angular/material/card';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatDialogContent, MatDialogTitle } from '@angular/material/dialog';

@Component({
  selector: 'app-loading-valuation-messages',
  imports: [MatCardModule, MatProgressSpinnerModule, MatDialogContent, MatDialogTitle],
  template: `
      <div class="loading-dialog">
        <h2 mat-dialog-title class="cabin-font-heading text-center">Processing Valuation...</h2>
        <mat-dialog-content>
          <div class="container-fluid d-flex flex-column align-items-center justify-content-center my-2">
              @if(loadingValuation) {
                  <mat-spinner class="my-2 spinner-sm"></mat-spinner>
                  <mat-card class="loading-valuation-card">
                      <span class="p-2 m-2 cabin-font-text">{{ valuationMessages[currentMessageIndex] }}</span>
                  </mat-card>
              }
          </div>
        </mat-dialog-content>
      </div>
    `,
  styles: `
    .loading-dialog {
        background-color: lavender;
        max-height: 80vh;
        height: 350px;
    }
    .loading-valuation-card {
        width: 100%;
        max-width: 300px;
    }
    .spinner-sm {
        width: 20px;
        height: 20px;
    }
  `
})
export class LoadingValuationMessagesComponent implements OnInit {
  data = inject(MAT_DIALOG_DATA);
  dialogRef = inject(MatDialogRef<LoadingValuationMessagesComponent>);
  loadingValuation = false;
  valuationMessages: string[] = [];
  currentMessageIndex = 0;

  ngOnInit() {
    this.loadingValuation = true;
    this.valuationMessages = this.data.messages;
    this.startMessageCycle();
  }

  startMessageCycle() {
    const shownIndexes: number[] = [];
    const maxMessages = 3;
  
    const interval = setInterval(() => {
      if (shownIndexes.length >= maxMessages) {
        clearInterval(interval); // Stop after 3 messages
        this.dialogRef.close();
        return;
      }
  
      let randomIndex: number;
  
      do {
        randomIndex = Math.floor(Math.random() * this.valuationMessages.length);
      } while (shownIndexes.includes(randomIndex)); // Avoid repeats
  
      shownIndexes.push(randomIndex);
      this.currentMessageIndex = randomIndex;
    }, 3000);
  }
}
