import {JsonPipe, NgClass} from '@angular/common';
import { Component } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import {Router, RouterLink, RouterModule} from '@angular/router';
import {FormBuilder, FormGroup, FormsModule, ReactiveFormsModule, Validators} from "@angular/forms";
import {AuthService} from "../../services/auth.service";
import {map} from "rxjs";
import {MatCardModule} from "@angular/material/card";
import {MatFormField, MatFormFieldModule, MatLabel} from "@angular/material/form-field";
import {MatInput} from "@angular/material/input";
import {MatDialogClose} from "@angular/material/dialog";
import {MatIcon} from "@angular/material/icon";
import {MatSnackBar} from "@angular/material/snack-bar";

@Component({
  selector: 'app-login',
  standalone: true,
  imports: [
    MatButtonModule,
    JsonPipe,
    RouterLink,
    FormsModule,
    ReactiveFormsModule,
    RouterModule,
    MatCardModule,
    MatFormFieldModule,
    MatInput,
    MatLabel,
    MatDialogClose,
    NgClass,
    MatIcon
  ],
  templateUrl: './login.component.html',
  styleUrl: './login.component.scss'
})
export class LoginComponent {

  loginForm: FormGroup = new FormGroup({})
  fieldTextType = false;
  errorMessage= '';

  constructor(
    private authService: AuthService,
    private router: Router,
    private formBuilder: FormBuilder,
    private snackBar: MatSnackBar
  )
  {
    this.createLoginForm();

    this.authService.currentUser$
      .pipe(
        map((user: any) => {
          !!user
            ? this.router.navigate(['/account-dashboard'])
            : this.router.navigate(['/login']);
        })
      )
      .subscribe();
  }

  async onLogin() {
    if (this.loginForm.valid) {
      try {
        await this.authService.login(this.loginForm.get('email')?.value, this.loginForm.get('password')?.value)
        await this.router.navigate(['/account-dashboard']);
      } catch (error: any) {
        this.handleError(error);
        this.snackBar.open(this.errorMessage, 'OK');
      }
    }
  }

  createLoginForm() {
    this.loginForm = this.formBuilder.group({
      email: ['', [Validators.required, Validators.email]],
      password: ['', [Validators.required, Validators.minLength(6)]]
    })
  }

  onToggleFieldTextType() {
    this.fieldTextType = !this.fieldTextType;
  }

  handleError(error: any) {
    switch (error.code) {
      case 'auth/invalid-credential':
        this.errorMessage = 'Invalid login credentials. Please try again.';
        break;
      case 'auth/user-not-found':
        this.errorMessage = 'No user found with this email.';
        break;
      case 'auth/wrong-password':
        this.errorMessage = 'Incorrect password. Please try again.';
        break;
      case 'auth/network-request-failed':
        this.errorMessage = 'Network error. Please check your internet connection.';
        break;
      default:
        this.errorMessage = 'An unknown error occurred. Please try again later.';
        break;
    }
  }
}
