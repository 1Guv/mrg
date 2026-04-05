import { Component, inject } from '@angular/core';
import { MatDialogRef, MatDialogModule } from '@angular/material/dialog';
import { MatButtonModule } from '@angular/material/button';
import { Router } from '@angular/router';

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

  goToLogin(): void {
    this.dialogRef.close();
    this.router.navigate(['/login']);
  }

  goToRegister(): void {
    this.dialogRef.close();
    this.router.navigate(['/register']);
  }
}
