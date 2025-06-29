import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import {AbstractControl, FormBuilder, FormGroup, FormsModule, ReactiveFormsModule, Validators} from '@angular/forms';
import { Router, RouterModule } from '@angular/router';
import { AuthService } from '../../services/auth.service';
import {MatButton, MatIconButton} from "@angular/material/button";
import {MatCard, MatCardActions, MatCardContent, MatCardHeader, MatCardTitle} from "@angular/material/card";
import {MatError, MatFormField, MatHint, MatLabel, MatSuffix} from "@angular/material/form-field";
import {MatIcon} from "@angular/material/icon";
import {MatInput} from "@angular/material/input";
import { passwordMatchValidator } from '../../form-validators/validator-password-match';

@Component({
  selector: 'app-register',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    RouterModule,
    RouterModule,
    MatButton,
    MatCard,
    MatCardActions,
    MatCardContent,
    MatCardHeader,
    MatCardTitle,
    MatFormField,
    MatIcon,
    MatIconButton,
    MatInput,
    MatLabel,
    MatSuffix,
    ReactiveFormsModule,
    MatError
  ],
  templateUrl: './register.component.html',
  styleUrls: ['./register.component.scss'],
})
export class RegisterComponent {

  registerForm: FormGroup = new FormGroup({});
  fieldTextTypeOne = false;
  fieldTextTypeTwo = false;

  constructor(
    private authService: AuthService,
    private router: Router,
    private formBuilder: FormBuilder
  ) {
    this.createRegisterForm();
  }

  createRegisterForm() {
    this.registerForm = this.formBuilder.group({
      email: ['', [Validators.required, Validators.email]],
      password: ['', [Validators.required, Validators.minLength(6)]],
      confirmPassword: ['', [Validators.required, Validators.minLength(6)]]
    },
      { validators: passwordMatchValidator() }
    )
  }

  async onRegister() {
    if (this.registerForm.valid) {
      try {
        await this.authService.register(
          this.registerForm.get('email')?.value,
          this.registerForm.get('password')?.value
        );
        await this.router.navigate(['/account-dashboard']);
      } catch (error) {
        console.error('Registration failed:', error);
      }
    }
  }

  onToggleFieldTextType(type: string) {
    if (type === 'one') {
      this.fieldTextTypeOne = !this.fieldTextTypeOne;
    }

    if (type === 'two') {
      this.fieldTextTypeTwo = !this.fieldTextTypeTwo;
    }
  }
}
