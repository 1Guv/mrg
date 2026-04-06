import { Component, inject, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatButtonModule } from '@angular/material/button';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatDialogModule, MatDialog } from '@angular/material/dialog';
import { ActivatedRoute, RouterModule } from '@angular/router';
import { take } from 'rxjs';
import { AuthService } from '../../services/auth.service';
import { StripeService } from '../../services/stripe.service';
import { AuthPromptDialogComponent } from '../../shared/auth-prompt-dialog/auth-prompt-dialog.component';

@Component({
  selector: 'app-list-plate',
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    MatFormFieldModule,
    MatInputModule,
    MatButtonModule,
    MatCheckboxModule,
    MatProgressSpinnerModule,
    MatDialogModule,
    RouterModule,
  ],
  templateUrl: './list-plate.component.html',
  styleUrl: './list-plate.component.scss'
})
export class ListPlateComponent implements OnInit {
  private fb = inject(FormBuilder);
  private authService = inject(AuthService);
  private stripeService = inject(StripeService);
  private dialog = inject(MatDialog);
  private route = inject(ActivatedRoute);

  form: FormGroup = this.fb.group({
    plateCharacters: ['', [Validators.required, Validators.minLength(2), Validators.maxLength(8)]],
    askingPrice: ['', [Validators.required, Validators.min(1)]],
    phone: ['', Validators.required],
    email: ['', [Validators.required, Validators.email]],
    initials: ['', [Validators.required, Validators.maxLength(3)]],
    meanings: [''],
    negotiable: [false],
  });

  loading = false;
  errorMessage = '';
  valuationMin: number | null = null;
  valuationMax: number | null = null;

  ngOnInit(): void {
    const params = this.route.snapshot.queryParams;
    const prefill: Record<string, string> = {};
    if (params['plate']) prefill['plateCharacters'] = String(params['plate']).toUpperCase();
    if (params['price']) prefill['askingPrice'] = String(params['price']);
    if (Object.keys(prefill).length) this.form.patchValue(prefill);
    const minVal = Number(params['min']);
    if (!isNaN(minVal) && minVal > 0) this.valuationMin = minVal;
    const maxVal = Number(params['max']);
    if (!isNaN(maxVal) && maxVal > 0) this.valuationMax = maxVal;

    this.authService.currentUser$.pipe(take(1)).subscribe(user => {
      if (!user) {
        this.dialog.open(AuthPromptDialogComponent, { width: '380px' });
      } else {
        this.form.patchValue({ email: user.email ?? '' });
      }
    });
  }

  async onSubmit(): Promise<void> {
    if (this.form.invalid) return;
    this.loading = true;
    this.errorMessage = '';
    try {
      const url = await this.stripeService.createCheckoutSession({
        plateCharacters: this.form.value.plateCharacters.toUpperCase(),
        askingPrice: String(this.form.value.askingPrice),
        phone: this.form.value.phone,
        email: this.form.value.email,
        initials: this.form.value.initials.toUpperCase(),
        meanings: this.form.value.meanings ?? '',
        negotiable: this.form.value.negotiable ?? false,
      });
      window.location.href = url;
    } catch {
      this.errorMessage = 'Something went wrong. Please try again.';
      this.loading = false;
    }
  }
}
