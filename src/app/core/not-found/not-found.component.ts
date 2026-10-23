import { Component } from '@angular/core';
import { RouterModule } from '@angular/router';
import { MatButtonModule } from '@angular/material/button';

@Component({
  selector: 'app-not-found',
  standalone: true,
  imports: [RouterModule, MatButtonModule],
  template: `
    <div class="container text-center py-5">
      <h1 class="mb-3">Page not found</h1>
      <p class="text-muted mb-4">
        This page doesn't exist. The plate may have sold or the link may be out of date.
      </p>
      <a mat-raised-button color="primary" routerLink="/">Value a plate</a>
      <a mat-button routerLink="/plates-for-sale" class="ms-2">Browse plates for sale</a>
    </div>
  `,
})
export class NotFoundComponent {}
