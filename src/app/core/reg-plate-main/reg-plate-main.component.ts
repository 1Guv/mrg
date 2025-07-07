import { Component, effect, OnInit } from '@angular/core';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { CommonModule } from '@angular/common';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatButtonModule } from '@angular/material/button';
import { MatRadioModule } from '@angular/material/radio';
import {Badge, NumberPlateType, NumberPlateTypeExamples, NumberPlateTypeObj} from "../../models/reg.model";
import { MatSelectModule } from '@angular/material/select';
import { MatSlideToggleChange, MatSlideToggleModule } from '@angular/material/slide-toggle';
import { regPatternValidator } from '../../form-validators/reg-type-validators';
import { datelessPattern } from '../../regex-plate-patterns/dateless';
import { suffixPattern } from '../../regex-plate-patterns/suffix';
import { prefixPattern } from '../../regex-plate-patterns/prefix';
import { currentPattern } from '../../regex-plate-patterns/current';
import { SharedPlateDataService } from '../../services/shared-plate-data.service';
import { MatIconModule } from '@angular/material/icon';
import { MatTooltipModule } from '@angular/material/tooltip';
import { NumberPlateFormService } from '../../services/number-plate-form.service';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatCardModule } from '@angular/material/card';
@Component({
  selector: 'reg-plate-main',
  standalone: true,
  imports: [
    ReactiveFormsModule,
    CommonModule,
    MatFormFieldModule,
    MatInputModule,
    MatButtonModule,
    MatRadioModule,
    MatSelectModule,
    MatSlideToggleModule,
    MatIconModule,
    MatTooltipModule,
    MatProgressSpinnerModule,
    MatCardModule
  ],
  templateUrl: './reg-plate-main.component.html',
  styleUrls: ['./reg-plate-main.component.scss']
})

export class RegPlateMainComponent implements OnInit {
  types: Array<NumberPlateTypeObj> = [
    { value: NumberPlateType.Current, example: NumberPlateTypeExamples.currentEg },
    { value: NumberPlateType.Prefix, example: NumberPlateTypeExamples.prefixEg },
    { value: NumberPlateType.Suffix, example: NumberPlateTypeExamples.suffixEg },
    { value: NumberPlateType.Dateless, example: NumberPlateTypeExamples.datelessEg }
  ];
  badges: Badge[] = [
    { code: 'UK', label: 'UK', icon: 'assets/icons/001-united-kingdom.png' },
    { code: 'KHANDA', label: 'KHANDA', icon: 'assets/icons/013-spiritual.png' },
    { code: 'PAKISTAN', label: 'PAKISTAN', icon: 'assets/icons/008-flag.png' },
    { code: 'SCOTLAND', label: 'SCOTLAND', icon: 'assets/icons/004-scotland.png' },
    { code: 'INDIA', label: 'INDIA', icon: 'assets/icons/011-world-1.png' },
    { code: 'WALES', label: 'WALES', icon: 'assets/icons/002-wales.png' }
  ];
  selectedBadge: Badge = this.badges[1];
  frontBack: boolean = false;
  registrationForm: FormGroup = this.fb.group({
    type: ['', [Validators.required]],
    registration: ['', [
      // Validators.required,
      // Validators.minLength(7),
      // Validators.maxLength(7),
      // Validators.pattern(/^[A-Za-z]{2}[0-9]{2}[A-Z]{3}$/)
    ]]
  });

  loadingValuation = false;
  valuationMessages: string[] = [];
  currentMessageIndex = 0;

  constructor(
    private fb: FormBuilder,
    private sharedPlateDataService: SharedPlateDataService,
    private numberPlateFormService: NumberPlateFormService
  ) {
    effect(() => {
      if (this.numberPlateFormService.resetSignal()) {
        this.registrationForm.reset();
        this.sharedPlateDataService.setCurrentPlateData(null);
        this.numberPlateFormService.reset();
      }
    });
  }

  ngOnInit() {
    this.registrationForm.get('type')?.valueChanges.subscribe((value) => {
      const regField = this.registrationForm.get('registration');
      this.toggleRegValidators(regField);
    });

    this.registrationForm.get('registration')?.valueChanges.subscribe((value) => {
      if (this.registrationForm.invalid || this.registrationForm.get('registration')?.hasError('error')) {
        this.sharedPlateDataService.setCurrentPlateData(null);
      }
    });
  }

  onSubmit() {
    // this.valuationMessages = [
    //   'Putting your plate through our algorithm...',
    //   'Remember if its not a good plate the algorithm will reject it!',
    //   'Real valuations. Real experience. Backed by a proprietary algorithm 30 years in the making.'
    // ];

    this.valuationMessages = [
      "Powered by 30+ years of number plate expertise. Valuations driven by my personal algorithm – precision you won’t find anywhere else.",
      "Using a one-of-a-kind valuation algorithm built from decades of market insight. No guesswork – just real value.",
      "Not just AI – this is experience, logic, and 30+ years of number plate savvy packed into one powerful valuation engine.",
      "Built on 30+ years of insider knowledge. Our valuation algorithm doesn’t just follow the market – it defines it.",
      "You’re looking at the smartest plate valuation tool online – handcrafted by a number plate veteran with 30+ years in the game.",
      "Real valuations. Real experience. Backed by a proprietary algorithm 30 years in the making.",
      "More than data – this valuation uses decades of intuition, trends, and industry expertise, coded into one clean result.",
      "No generic pricing here – just intelligent, experience-backed plate valuations that reflect the real market.",
      "Your plate’s value isn’t random. It’s calculated with care, history, and 30+ years of industry insight.",
      "Trust the algorithm built from a lifetime in the trade – because not all valuations are created equal."
    ];
    

    this.loadingValuation = true;
    this.currentMessageIndex = 0;
    this.startMessageCycle();

    setTimeout(() => {
      this.loadingValuation = false;
      if (this.registrationForm.valid) {
        this.sharedPlateDataService.setCurrentPlateData(this.registrationForm.value);
      } else {
        this.sharedPlateDataService.setCurrentPlateData(null);
      }
    }, 9000);
  }

  startMessageCycle() {
    const shownIndexes: number[] = [];
    const maxMessages = 3;
  
    const interval = setInterval(() => {
      if (shownIndexes.length >= maxMessages) {
        clearInterval(interval); // Stop after 3 messages
        return;
      }
  
      let randomIndex: number;
  
      do {
        randomIndex = Math.floor(Math.random() * this.valuationMessages.length);
      } while (shownIndexes.includes(randomIndex)); // Avoid repeats
  
      shownIndexes.push(randomIndex);
      this.currentMessageIndex = randomIndex;
    }, 3000);
  }

  selectBadge(badge: Badge) {
    this.selectedBadge = badge;
  }

  isFieldInvalid(): boolean {
    const field = this.registrationForm.get('registration');
    return field ? field.invalid && (field.dirty || field.touched) : false;
  }

  onFrontBackToggle(event: MatSlideToggleChange) {
    this.frontBack = event.checked;
  }

  toggleRegValidators(regField: any) {
    switch (this.registrationForm.get('type')?.value?.value) {
      case NumberPlateType.Current:
        regField?.setValidators([
          Validators.required,
          regPatternValidator(
            currentPattern,
            'error',
            'The format should be YYXX YYY.'
          )
        ])
        break;
      case NumberPlateType.Prefix:
        regField?.setValidators([
          Validators.required,
          regPatternValidator(
            prefixPattern,
            'error',
            'The format should be YXXX YYY.'
          )
        ])
        break;
      case NumberPlateType.Suffix:
        regField?.setValidators([
          Validators.required,
          regPatternValidator(
            suffixPattern,
            'error',
            'The format should be XXX YYYX.'
          )
        ])
        break;
      case NumberPlateType.Dateless:
        regField?.setValidators([
          Validators.required,
          regPatternValidator(
            datelessPattern,
            'error',
            'The format should be XXX YYY or YYY XXX.'
          )
        ])
        break;
    }
    regField?.updateValueAndValidity();
  }
}
