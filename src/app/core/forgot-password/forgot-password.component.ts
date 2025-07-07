import { Component } from '@angular/core';
import {MatCard, MatCardActions, MatCardContent, MatCardHeader, MatCardTitle} from "@angular/material/card";
import {MatFormField, MatLabel} from "@angular/material/form-field";
import {MatInput} from "@angular/material/input";
import {FormBuilder, FormGroup, ReactiveFormsModule, Validators} from "@angular/forms";
import {MatButton} from "@angular/material/button";
import {AuthService} from "../../services/auth.service";
import {MatSnackBar} from "@angular/material/snack-bar";

@Component({
  selector: 'app-forgot-password',
  standalone: true,
  imports: [
    MatCard,
    MatCardContent,
    MatCardHeader,
    MatCardTitle,
    MatFormField,
    MatInput,
    MatLabel,
    ReactiveFormsModule,
    MatButton,
    MatCardActions
  ],
  templateUrl: './forgot-password.component.html',
  styleUrl: './forgot-password.component.scss'
})
export class ForgotPasswordComponent {

  forgotPasswordForm: FormGroup = new FormGroup({});
  errorMessage = '';

  constructor(
    private formBuilder: FormBuilder,
    private authService: AuthService,
    private snackBar: MatSnackBar,
  ) {
    this.createForgotPasswordForm();
  }

  createForgotPasswordForm() {
    this.forgotPasswordForm = this.formBuilder.group({
      email: ['', [Validators.required, Validators.email]],
    });
  };

  onPasswordReset() {
    if (this.forgotPasswordForm.valid) {
      this.authService.sendPasswordReset(this.forgotPasswordForm.get('email')?.value)
        .then(() => {
          let message = 'Password reset email sent. Please check your inbox.';
          this.snackBar.open(message, 'OK');
        })
        .catch((error: any) => {
          this.handleError(error.code);
          this.snackBar.open(this.errorMessage, 'OK');
        })
    }
  }

  handleError(code: string) {
    switch (code) {
      case 'auth/user-not-found':
        this.errorMessage = 'No user found with this email.';
        break;
      case 'auth/invalid-email':
        this.errorMessage = 'Invalid email address.';
        break;
      default:
        this.errorMessage = 'Something went wrong. Please try again later.';
        break;
    }
  }
}
