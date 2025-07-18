
import { Component, OnDestroy } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { Router, RouterLink, RouterModule } from '@angular/router';
import { FormBuilder, FormGroup, FormsModule, ReactiveFormsModule, Validators } from "@angular/forms";
import { AuthService } from "../../services/auth.service";
import { catchError, map, of } from "rxjs";
import { MatCardModule } from "@angular/material/card";
import { MatFormFieldModule, MatLabel } from "@angular/material/form-field";
import { MatInput } from "@angular/material/input";
import { MatIcon } from "@angular/material/icon";
import { MatSnackBar } from "@angular/material/snack-bar";
import { ValuationService } from "../../services/valuation.service";
import { Subscription } from 'rxjs';
import { RegValuation } from '../../models/reg.model';

@Component({
  selector: 'app-login',
  standalone: true,
  imports: [
    MatButtonModule,
    RouterLink,
    FormsModule,
    ReactiveFormsModule,
    RouterModule,
    MatCardModule,
    MatFormFieldModule,
    MatInput,
    MatLabel,
    MatIcon
  ],
  templateUrl: './login.component.html',
  styleUrl: './login.component.scss'
})
export class LoginComponent implements OnDestroy {

  loginForm: FormGroup = new FormGroup({})
  fieldTextType = false;
  errorMessage = '';
  subscriptions: Subscription[] = [];

  constructor(
    private authService: AuthService,
    private router: Router,
    private formBuilder: FormBuilder,
    private snackBar: MatSnackBar,
    private valuationService: ValuationService
  ) {
    this.createLoginForm();

    this.subscriptions.push(
      this.authService.currentUser$
        .pipe(
          map((user: any) => {
            !!user
              ? this.router.navigate(['/account-dashboard'])
              : this.router.navigate(['/login']);
          })
        )
        .subscribe()
    );
  }

  async onLogin() {
    if (this.loginForm.valid) {
      try {
        await this.authService.login(this.loginForm.get('email')?.value, this.loginForm.get('password')?.value)
        const valuationNotSaved = this.valuationService.getValuation();

        if (valuationNotSaved()?.registration) {
          const snackBarRef = this.snackBar.open(
            `You have a valuation in progress, do you want to save ${valuationNotSaved()?.registration} ?`, "YES",
            {
              duration: 15000,
              verticalPosition: 'bottom',
              horizontalPosition: 'center'
            });

          snackBarRef.onAction().subscribe(() => {
            this.saveValuation(valuationNotSaved());
          });
        } else {
          this.valuationService.resetValuation();
          await this.router.navigate(['/account-dashboard']);
        }
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

  saveValuation(valuation: RegValuation) {
    this.subscriptions.push(
      this.valuationService.addValuation(valuation)
        .pipe(
          map(() => {
            this.snackBar.open("Valuation saved successfully and can be viewed in your account", "OK");
            this.router.navigate(['/account-dashboard']);
          }),
          catchError((error: any) => {
            this.snackBar.open("Valuation failed to save", "OK");
            this.router.navigate(['']);
            return of(null);
          })
        )
        .subscribe()
    );
  }

  ngOnDestroy(): void {
    this.subscriptions.forEach((sub: Subscription) => sub.unsubscribe());
  }
}
