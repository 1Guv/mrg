import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router } from '@angular/router';
import { MatDialogRef, MatDialogModule } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatButtonModule } from '@angular/material/button';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { AuthService } from '../../../services/auth.service';

@Component({
  selector: 'app-user-details-dialog',
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    MatDialogModule,
    MatFormFieldModule,
    MatInputModule,
    MatButtonModule,
    MatProgressSpinnerModule,
  ],
  templateUrl: './user-details-dialog.component.html',
  styleUrl: './user-details-dialog.component.scss'
})
export class UserDetailsDialogComponent {
  private dialogRef = inject(MatDialogRef<UserDetailsDialogComponent>);
  private authService = inject(AuthService);
  private fb = inject(FormBuilder);
  private router = inject(Router);

  form: FormGroup = this.fb.group({
    email: ['', [Validators.required, Validators.email]],
  });

  errorMessage = '';
  loading = false;
  emailAlreadyExists = false;

  async onSubmit() {
    if (this.form.invalid) return;
    this.loading = true;
    this.errorMessage = '';
    this.emailAlreadyExists = false;

    const { email } = this.form.value;
    const randomPassword = Math.random().toString(36).slice(-10) + Math.random().toString(36).slice(-10) + '!A1';

    try {
      const credential = await this.authService.register(email, randomPassword);
      await this.authService.saveUserProfile(credential.user.uid, email, 'auto');
      await this.authService.sendPasswordReset(email);
      this.dialogRef.close({ email });
    } catch (error: any) {
      if (error.code === 'auth/email-already-in-use') {
        await this.authService.sendPasswordReset(email);
        this.emailAlreadyExists = true;
        this.errorMessage = 'You already have an account. A password reset email has been sent — check your spam folder if you cannot find it.';
      } else {
        this.errorMessage = 'Something went wrong. Please try again.';
      }
    } finally {
      this.loading = false;
    }
  }

  continueAnyway() {
    this.dialogRef.close({ email: this.form.value.email });
  }

  goToLogin() {
    this.dialogRef.close(undefined);
    this.router.navigate(['/login']);
  }
}
