import { Component } from '@angular/core';
import { MatCardModule } from '@angular/material/card';

@Component({
  selector: 'app-plate-breakdown-card',
  standalone: true,
  imports: [MatCardModule],
  templateUrl: './plate-breakdown-card.component.html',
  styleUrl: './plate-breakdown-card.component.scss',
})
export class PlateBreakdownCardComponent {}
