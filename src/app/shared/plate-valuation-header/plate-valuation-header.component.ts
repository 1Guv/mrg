import { Component, Input } from '@angular/core';
import { UpperCasePipe } from '@angular/common';

@Component({
  selector: 'app-plate-valuation-header',
  standalone: true,
  imports: [UpperCasePipe],
  templateUrl: './plate-valuation-header.component.html',
  styleUrl: './plate-valuation-header.component.scss',
})
export class PlateValuationHeaderComponent {
  @Input() registration: string = '';
  @Input() meaning: string = '';
  @Input() plateType: string = '';
}
