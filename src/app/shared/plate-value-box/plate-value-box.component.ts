import { Component, inject, Input } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { MatButtonModule } from '@angular/material/button';
import { detectPlateType } from '../../regex-plate-patterns/detect-plate-type';

/**
 * "What's your plate worth?" reg box for article and plate-for-sale pages.
 * Sends the visitor to the homepage with the plate filled in, where the
 * valuation starts at once.
 */
@Component({
  selector: 'app-plate-value-box',
  standalone: true,
  imports: [FormsModule, MatButtonModule],
  templateUrl: './plate-value-box.component.html',
  styleUrl: './plate-value-box.component.scss'
})
export class PlateValueBoxComponent {
  private router = inject(Router);

  /** Where the box is, for tracking: article or plate_page. */
  @Input() source = 'article';
  @Input() articleSlug = '';
  @Input() heading = "What's your plate worth?";

  registration = '';
  error = '';

  onSubmit(): void {
    const plate = detectPlateType(this.registration);
    if (!plate) {
      this.error = "That doesn't look like a UK reg. Try something like FA57 CAR.";
      return;
    }
    this.error = '';
    this.router.navigate(['/'], {
      queryParams: {
        plate: plate.registration,
        source: this.source,
        ...(this.articleSlug ? { article: this.articleSlug } : {}),
      }
    });
  }
}
