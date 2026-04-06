import { Component, Input } from '@angular/core';
import { NgStyle } from '@angular/common';
import { MatCardModule } from '@angular/material/card';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { RouterLink } from '@angular/router';
import { BenefitCard } from '../../models/benefit-card.model';

@Component({
  selector: 'app-benefit-card',
  standalone: true,
  imports: [MatCardModule, MatIconModule, MatButtonModule, RouterLink, NgStyle],
  templateUrl: './benefit-card.component.html',
  styleUrl: './benefit-card.component.scss'
})
export class BenefitCardComponent {
  @Input() card!: BenefitCard;
}
