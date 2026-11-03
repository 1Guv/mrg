import { Component, inject } from '@angular/core';
import { FormControl, ReactiveFormsModule, Validators } from '@angular/forms';
import { MatDialogRef, MatDialogModule } from '@angular/material/dialog';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';

/** Asks for the email a sign-in link was sent to, when it was opened on another device. */
@Component({
  selector: 'app-confirm-email-dialog',
  standalone: true,
  imports: [ReactiveFormsModule, MatDialogModule, MatButtonModule, MatFormFieldModule, MatInputModule],
  templateUrl: './confirm-email-dialog.component.html',
  styleUrl: './confirm-email-dialog.component.scss'
})
export class ConfirmEmailDialogComponent {
  private dialogRef = inject(MatDialogRef<ConfirmEmailDialogComponent>);

  email = new FormControl('', { nonNullable: true, validators: [Validators.required, Validators.email] });

  confirm(): void {
    if (this.email.invalid) return;
    this.dialogRef.close(this.email.value.trim());
  }
}
