import { Component } from '@angular/core';
import { RouterModule } from '@angular/router';
import { MatButtonModule } from '@angular/material/button';

@Component({
  selector: 'app-unsubscribed',
  standalone: true,
  imports: [RouterModule, MatButtonModule],
  template: `
    <div class="container text-center py-5">
      <h1 class="mb-3">You've been unsubscribed.</h1>
      <p class="text-muted mb-4">
        You won't receive any more listing suggestion emails from us.
      </p>
      <a mat-raised-button color="primary" routerLink="/">Back to homepage</a>
    </div>
  `,
})
export class UnsubscribedComponent {}
