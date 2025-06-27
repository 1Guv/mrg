import { ChangeDetectorRef, Component, signal } from '@angular/core';
import { SharedPlateDataService } from '../../services/shared-plate-data.service';
import { CommonModule } from '@angular/common';
import { DatelessHowManyLettersMultiplier, DatelessHowManyNumbersMultiplier, DatelessReg, DatelessRegLength, DatelessRegMultiplier, DatelessYearMultiplier, DigitValues, IsAnyLetterUsedAsNumber, IsAnyNumberUsedAsLetter, IsPlateSpacingGoodForMot, LetterValues, MinMaxTotals, Spaces } from '../../formulas/dateless-formula';
import { NumberPlateType } from '../../models/reg.model';
import { FormControl, FormsModule, ReactiveFormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatRadioModule } from '@angular/material/radio';
import { MatSlideToggleChange, MatSlideToggleModule } from '@angular/material/slide-toggle';
import { MatIconModule } from '@angular/material/icon';
import { MatCardModule } from '@angular/material/card';
import { MatDatepickerModule } from '@angular/material/datepicker';
import { DateAdapter, MAT_DATE_FORMATS, MAT_DATE_LOCALE, MatNativeDateModule } from '@angular/material/core';
import { MomentDateAdapter } from '@angular/material-moment-adapter';
import moment from 'moment';
import { NumberPlateFormService } from '../../services/number-plate-form.service';
import { MatSliderModule } from '@angular/material/slider';
import { MatExpansionModule } from '@angular/material/expansion';

export const MY_FORMATS = {
  parse: {
    dateInput: 'YYYY',
  },
  display: {
    dateInput: 'YYYY',
    monthYearLabel: 'YYYY',
    dateA11yLabel: 'YYYY',
    monthYearA11yLabel: 'YYYY',
  },
};

@Component({
    selector: 'reg-plate-valuation-results',
    standalone: true,
    imports: [
        ReactiveFormsModule,
        MatFormFieldModule,
        MatInputModule,
        MatButtonModule,
        FormsModule,
        MatRadioModule,
        MatSlideToggleModule,
        CommonModule,
        MatIconModule,
        MatCardModule,
        MatDatepickerModule,
        MatNativeDateModule,
      MatSliderModule,
      MatExpansionModule
    ],
    templateUrl: './reg-plate-valuation-results.component.html',
    styleUrl: './reg-plate-valuation-results.component.scss',
    providers: [
      { provide: MAT_DATE_FORMATS, useValue: MY_FORMATS },
      { provide: DateAdapter, useClass: MomentDateAdapter, deps: [MAT_DATE_LOCALE] },
    ]
})
export class RegPlateValuationResultsComponent {
  currentPlateData: any;
  currentPlate: string = '';
  currentPlateType: string = '';
  plateTypePoints: number = 0;
  plateLengthPoints: number = 0;
  plateFirstCharacterPoints: number = 0;
  plateCharacterPoints: number = 0;
  charPoints: Array<{ character: string, points: number }> = [];
  plateWithSpaces: string = '';

  DatelessReg = DatelessReg;
  spaces = [0, 1, 2, 3];
  spacesSelected: number = 0;
  spacesPoints: number = Spaces[`_${this.spacesSelected}` as keyof typeof Spaces];

  isAnyLetterUsedAsNumber: boolean = false;
  isAnyNumberUsedAsLetter: boolean = false;
  isPlateSpacingGoodForMot: boolean = false;
  isPlateSpacingGoodForMotPoints: number = 0;
  isAnyLetterUsedAsNumberPoints: number = 0;
  isAnyNumberUsedAsLetterPoints: number = 0;
  isDateOfPurchaseKnown: boolean = false;
  dateOfPurchaseKnownPoints: number = 0;
  multiplier: number = 0;
  DatelessRegMultiplier = DatelessRegMultiplier;
  DatelessYearMultiplier = DatelessYearMultiplier;
  multiplierPoints: number = 0;
  MinMaxTotals = MinMaxTotals;

  totalPoints: number = 0;
  totalPointsWithMultiplier: number = 0;
  minPrice: number = 0;
  maxPrice: number = 0;

  maxDate = moment();
  minDate = moment([1904, 0, 1]);
  startDate = moment();
  yearOfPurchase: FormControl<moment.Moment | null> = new FormControl<moment.Moment | null>(null);
  yearsOld: number = 0;

  howManyNumbers: number = 0;
  howManyNumbersPoints: number = DatelessHowManyNumbersMultiplier[`_${this.howManyNumbers}` as keyof typeof DatelessHowManyNumbersMultiplier];

  howManyLetters: number = 0;
  howManyLettersPoints: number = DatelessHowManyLettersMultiplier[`_${this.howManyLetters}` as keyof typeof DatelessHowManyLettersMultiplier];

  popularityMultiplier: FormControl<number | null> = new FormControl<number | null>(0);
  totalPointsWithPopularityMultiplier: number = 0;
  readonly panelOpenState = signal(false);

  constructor(
    private sharedPlateDataService: SharedPlateDataService,
    private numberPlateFormService: NumberPlateFormService,
    private cdr: ChangeDetectorRef
  ) {
    this.sharedPlateDataService.getCurrentPlateData().subscribe((data) => {
      this.currentPlateData = data;
      this.currentPlate = data?.registration;
      this.currentPlateType = data?.type?.value;
      this.howManyNumbersPoints = this.calcHowManyNumbersPoints();
      this.howManyLettersPoints = this.calcHowManyLettersPoints();
      this.plateTypePoints = this.calcPlateTypePoints();
      this.plateLengthPoints = this.calcPlateLengthPoints();
      this.plateFirstCharacterPoints = this.calcPlateFirstCharacterPoints();
      this.plateCharacterPoints = this.calcPlateCharacterPoints();
      this.multiplier = this.calcMultiplierPoints();
      this.calcTotalPoints();
      this.calcMinPrice();
      this.calcMaxPrice();
    });
  }

  calcHowManyNumbersPoints():number {
    let count = 0;
    for (let i = 0; i < this.currentPlate?.length; i++) {
      const char = this.currentPlate[i];
      const isNumber = "0123456789".includes(char);
      if (isNumber) {
        count++;
      }
    }
    this.howManyNumbers = count;
    return DatelessHowManyNumbersMultiplier[`_${count}` as keyof typeof DatelessHowManyNumbersMultiplier];
  }

  calcHowManyLettersPoints():number {
    let count = 0;
    for (let i = 0; i < this.currentPlate?.length; i++) {
      const char = this.currentPlate[i].toUpperCase();
      const isLetter = "ABCDEFGHIJKLMNOPQRSTUVWXYZ".includes(char);
      if (isLetter) {
        count++;
      }
    } 
    this.howManyLetters = count;
    return DatelessHowManyLettersMultiplier[`_${count}` as keyof typeof DatelessHowManyLettersMultiplier];
  }

  calcPlateTypePoints():number {
    switch (this.currentPlateType) {
      // case NumberPlateType.Current:
      //   return DatelessReg.start;
      // case NumberPlateType.Prefix:
      //   return DatelessReg.start;
      // case NumberPlateType.Suffix:
      //   return DatelessReg.start;
      case NumberPlateType.Dateless:
        return DatelessReg.start;
    }
    return 0;
  }

  calcPlateLengthPoints():number {
    switch (this.currentPlate?.length) {
      case 6:
        return DatelessRegLength._6;
      case 5:
        return DatelessRegLength._5;
      case 4:
        return DatelessRegLength._4;
      case 3:
        return DatelessRegLength._3;
      case 2:
        return DatelessRegLength._2;
    }
    return 0;
  }

  calcPlateFirstCharacterPoints(): number {
    const isFirstCharNumber = "0123456789".includes(this.currentPlate?.[0]);
    if (isFirstCharNumber) {
      return DatelessReg.numberFirst;
    } else {
      return DatelessReg.letterFirst;
    }
  }

  calcPlateCharacterPoints() {
    this.charPoints = [];
    let points = 0;
    for (let i = 0; i < this.currentPlate?.length; i++) {
      const char = this.currentPlate[i];
      console.log(char);
      const isNumber = "0123456789".includes(char);
      console.log(isNumber);
      if (isNumber) {
        points += DigitValues[`_${char}` as keyof typeof DigitValues];
        this.charPoints.push({
          character: char,
          points: DigitValues[`_${char}` as keyof typeof DigitValues]
        });
      } else {
        points += LetterValues[char.toUpperCase() as keyof typeof LetterValues];
        this.charPoints.push({
          character: char,
          points: LetterValues[char.toUpperCase() as keyof typeof LetterValues]
        });
      }
    
    }
    return points;
  }

  calcSpacesPoints(event: MatSlideToggleChange) {
    this.spacesPoints = Spaces[`_${event}` as keyof typeof Spaces];
    this.calcTotalPoints();
    this.calcMinPrice();
    this.calcMaxPrice();
  }

  calcIsAnyLetterUsedAsNumberPoints(event: MatSlideToggleChange) {
    this.isAnyLetterUsedAsNumberPoints = IsAnyLetterUsedAsNumber[`_${event}` as keyof typeof IsAnyLetterUsedAsNumber];
    this.calcTotalPoints(); 
    this.calcMinPrice();
    this.calcMaxPrice();
  }

  calcIsAnyNumberUsedAsLetterPoints(event: MatSlideToggleChange) {
    this.isAnyNumberUsedAsLetterPoints = IsAnyNumberUsedAsLetter[`_${event}` as keyof typeof IsAnyNumberUsedAsLetter];
    this.calcTotalPoints(); 
    this.calcMinPrice();
    this.calcMaxPrice();
  }

  calcIsPlateSpacingGoodForMotPoints(event: MatSlideToggleChange) {
    this.isPlateSpacingGoodForMotPoints = IsPlateSpacingGoodForMot[`_${event}` as keyof typeof IsPlateSpacingGoodForMot];
    this.calcTotalPoints(); 
    this.calcMinPrice();
    this.calcMaxPrice();
  }

  isDateOfPurchaseKnownToggle(event: MatSlideToggleChange) {
    this.isDateOfPurchaseKnown = event.checked;
    if (!event.checked) {
      this.yearOfPurchase.setValue(null);
      this.dateOfPurchaseKnownPoints = 0;
      this.yearsOld = 0;
    }
    this.calcTotalPoints();
    this.calcMinPrice();
    this.calcMaxPrice();
  }

  calcDateOfPurchaseKnownPoints(event: moment.Moment, dp: any) {
    if (event) {
      this.yearOfPurchase.setValue(event); // This shows the year in the input
      this.yearsOld = moment().diff(event, 'years');
      this.dateOfPurchaseKnownPoints = this.yearsOld * this.calcDateOfPurchaseMultiplierPoints();

      dp.close();
      this.calcTotalPoints();
      this.calcMinPrice();
      this.calcMaxPrice();
    }
  }
  
  calcDateOfPurchaseMultiplierPoints() {
    return this.DatelessYearMultiplier[`_${this.currentPlate?.length}` as keyof typeof this.DatelessYearMultiplier];
  }

  calcMultiplierPoints() {
    return this.DatelessRegMultiplier[`_${this.currentPlate?.length}` as keyof typeof this.DatelessRegMultiplier];
  }

  calcTotalPoints() {
    this.totalPoints = this.plateTypePoints + 
    this.plateLengthPoints + 
    this.plateFirstCharacterPoints + 
    this.plateCharacterPoints + 
    this.spacesPoints +
    this.isAnyLetterUsedAsNumberPoints +
    this.isAnyNumberUsedAsLetterPoints +
    this.isPlateSpacingGoodForMotPoints +
    this.dateOfPurchaseKnownPoints +
    this.howManyNumbersPoints +
    this.howManyLettersPoints;
  }

  calcMinPrice() {
    this.minPrice = this.totalPoints * this.multiplier - ((this.totalPoints * this.multiplier) * MinMaxTotals.min);
  }

  calcMaxPrice() {
    this.maxPrice = this.totalPoints * this.multiplier + ((this.totalPoints * this.multiplier) * MinMaxTotals.max);
  }

  onResetPlateForm() {
    this.resetValuation();
    this.numberPlateFormService.triggerReset();
  }

  resetValuation() {
    this.spacesSelected = 0;
    this.spacesPoints = 0;
    this.isAnyLetterUsedAsNumber = false;
    this.isAnyLetterUsedAsNumberPoints = 0;
    this.isAnyNumberUsedAsLetter = false;
    this.isAnyNumberUsedAsLetterPoints = 0;
    this.isPlateSpacingGoodForMot = false;
    this.isPlateSpacingGoodForMotPoints = 0;
    this.isDateOfPurchaseKnown = false;
    this.yearOfPurchase.setValue(null);
    this.dateOfPurchaseKnownPoints = 0;
    this.yearsOld = 0;
    this.popularityMultiplier.setValue(0);
    this.totalPointsWithPopularityMultiplier = 0;
    this.totalPointsWithMultiplier = 0;
    this.calcTotalPoints();
    this.calcMinPrice();
    this.calcMaxPrice();
  }

  onPopularityMultiplierChange(event: any) {
    this.popularityMultiplier.setValue(Math.round(event?.srcElement?.value));

    this.calculateTotalWithPopularityMultiplier();
    // Manually trigger change detection      
    this.cdr.detectChanges();
  }
  
  calculateTotalWithPopularityMultiplier() {
    this.totalPointsWithPopularityMultiplier = this.totalPoints * (this.popularityMultiplier.value || 0);
  }

  formatLabel(value: number): string {
    return `${value}x`;
  }

  calcTotalPlatePointsExpansionPanel() {
    return this.plateTypePoints +
      this.howManyNumbersPoints +
      this.howManyLettersPoints +
      this.plateLengthPoints +
      this.plateFirstCharacterPoints +
      this.plateCharacterPoints
  }

  calcTotalPointsQuestionsExpansionPanel() {
    return this.spacesPoints +
    this.isAnyLetterUsedAsNumberPoints +
    this.isAnyNumberUsedAsLetterPoints +
    this.isPlateSpacingGoodForMotPoints +
    this.dateOfPurchaseKnownPoints
  }

  onSaveValuation() {
    
  }
}
