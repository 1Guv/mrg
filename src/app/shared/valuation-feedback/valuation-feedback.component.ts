import { Component, inject, input, OnInit } from '@angular/core';
import { MatCardModule } from '@angular/material/card';
import { MatIconModule } from '@angular/material/icon';
import { ValuationService } from '../../services/valuation.service';

@Component({
  selector: 'app-valuation-feedback',
  standalone: true,
  imports: [MatCardModule, MatIconModule],
  templateUrl: './valuation-feedback.component.html',
  styleUrl: './valuation-feedback.component.scss'
})
export class ValuationFeedbackComponent {
  registration = input.required<string>();
  valuation = input.required<number>();
  popularityMultiplier = input<number>(0);

  private valuationService = inject(ValuationService);

  feedbackGiven = false;
  feedbackAgreed: boolean | null = null;

  onFeedback(agreed: boolean) {
    this.feedbackGiven = true;
    this.feedbackAgreed = agreed;
    this.valuationService.saveFeedback(
      this.registration(),
      this.valuation(),
      agreed,
      this.popularityMultiplier()
    ).subscribe();
  }

  reset() {
    this.feedbackGiven = false;
    this.feedbackAgreed = null;
  }
}
