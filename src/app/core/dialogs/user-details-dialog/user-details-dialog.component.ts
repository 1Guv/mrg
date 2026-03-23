import { Component, inject, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { AbstractControl, FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router } from '@angular/router';
import { MatDialogRef, MatDialogModule } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatAutocompleteModule } from '@angular/material/autocomplete';
import { MatButtonModule } from '@angular/material/button';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { AuthService } from '../../../services/auth.service';
import { UK_CITIES } from '../../../models/uk-cities.model';

@Component({
  selector: 'app-user-details-dialog',
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    MatDialogModule,
    MatFormFieldModule,
    MatInputModule,
    MatAutocompleteModule,
    MatButtonModule,
    MatProgressSpinnerModule,
  ],
  templateUrl: './user-details-dialog.component.html',
  styleUrl: './user-details-dialog.component.scss'
})
export class UserDetailsDialogComponent implements OnInit {
  private dialogRef = inject(MatDialogRef<UserDetailsDialogComponent>);
  private authService = inject(AuthService);
  private fb = inject(FormBuilder);
  private router = inject(Router);

  form: FormGroup = this.fb.group({
    firstName: ['', Validators.required],
    lastName: ['', Validators.required],
    email: ['', [Validators.required, Validators.email]],
    city: ['', [Validators.required, this.cityValidator()]],
    plateMeaning: ['', Validators.required],
  });

  errorMessage = '';
  loading = false;
  emailAlreadyExists = false;
  filteredCities: string[] = UK_CITIES;

  ngOnInit() {
    this.form.get('city')!.valueChanges.subscribe(term => {
      const lower = term?.toLowerCase() ?? '';
      this.filteredCities = UK_CITIES.filter(c => c.toLowerCase().includes(lower));
    });
  }

  cityValidator() {
    return (control: AbstractControl) => {
      if (!control.value) return null;
      return UK_CITIES.includes(control.value) ? null : { invalidCity: true };
    };
  }

  async onSubmit() {
    if (this.form.invalid) return;
    this.loading = true;
    this.errorMessage = '';
    this.emailAlreadyExists = false;

    const { email } = this.form.value;
    const randomPassword = Math.random().toString(36).slice(-10) + Math.random().toString(36).slice(-10) + '!A1';

    try {
      const credential = await this.authService.register(email, randomPassword);
      await this.authService.saveUserProfile(credential.user.uid, email, 'auto', {
        firstName: this.form.value.firstName,
        lastName: this.form.value.lastName,
        city: this.form.value.city,
        plateMeaning: this.form.value.plateMeaning
      });
      await this.authService.sendPasswordReset(email);
      this.dialogRef.close(this.form.value);
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
    this.dialogRef.close(this.form.value);
  }

  goToLogin() {
    this.dialogRef.close(undefined);
    this.router.navigate(['/login']);
  }
}
