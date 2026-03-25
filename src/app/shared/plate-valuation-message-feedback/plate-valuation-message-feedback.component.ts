import { Component, inject, input, viewChild } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormControl, ReactiveFormsModule, Validators } from '@angular/forms';
import { MatCardModule } from '@angular/material/card';
import { MatExpansionModule, MatExpansionPanel } from '@angular/material/expansion';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatButtonModule } from '@angular/material/button';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { catchError, of } from 'rxjs';
import { ValuationService } from '../../services/valuation.service';

@Component({
  selector: 'app-plate-valuation-message-feedback',
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    MatCardModule,
    MatExpansionModule,
    MatFormFieldModule,
    MatInputModule,
    MatButtonModule,
    MatSnackBarModule,
  ],
  templateUrl: './plate-valuation-message-feedback.component.html',
  styleUrl: './plate-valuation-message-feedback.component.scss',
})
export class PlateValuationMessageFeedbackComponent {
  registration = input.required<string>();
  valuation = input.required<number>();
  plateMeaning = input<string>('');

  panel = viewChild<MatExpansionPanel>('panel');

  message = new FormControl('', [Validators.required, Validators.minLength(5)]);
  submitted = false;

  private snackBar = inject(MatSnackBar);
  private valuationService = inject(ValuationService);

  onSubmit() {
    if (this.message.invalid) return;
    this.valuationService.savePlateValuationMessage(
      this.registration(),
      this.valuation(),
      this.plateMeaning(),
      this.message.value!
    ).pipe(
      catchError(() => of(null))
    ).subscribe((result) => {
      if (result) {
        this.submitted = true;
        this.message.reset();
      } else {
        this.snackBar.open('Failed to send — please try again', 'OK', { duration: 3000 });
      }
    });
  }

  onCancel() {
    this.panel()?.close();
  }
}
