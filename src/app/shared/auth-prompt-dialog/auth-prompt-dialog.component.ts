import { Component, inject } from '@angular/core';
import { MatDialogRef, MatDialogModule, MAT_DIALOG_DATA } from '@angular/material/dialog';
import { MatButtonModule } from '@angular/material/button';
import { Router } from '@angular/router';

export interface AuthPromptDialogData {
  title?: string;
  message?: string;
}

@Component({
  selector: 'app-auth-prompt-dialog',
  standalone: true,
  imports: [MatDialogModule, MatButtonModule],
  templateUrl: './auth-prompt-dialog.component.html',
  styleUrl: './auth-prompt-dialog.component.scss'
})
export class AuthPromptDialogComponent {
  private dialogRef = inject(MatDialogRef<AuthPromptDialogComponent>);
  private router = inject(Router);
  private data: AuthPromptDialogData = inject(MAT_DIALOG_DATA, { optional: true }) ?? {};

  title = this.data.title ?? 'Sign in to message the seller';
  message = this.data.message ?? 'You need to be logged in to message a seller. Please log in or create a free account to continue.';

  goToLogin(): void {
    this.dialogRef.close();
    this.router.navigate(['/login']);
  }

  goToRegister(): void {
    this.dialogRef.close();
    this.router.navigate(['/register']);
  }
}
