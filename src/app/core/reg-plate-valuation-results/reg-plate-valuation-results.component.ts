import { Component } from '@angular/core';
import { SharedPlateDataService } from '../../services/shared-plate-data.service';
import { CommonModule, DecimalPipe, JsonPipe } from '@angular/common';
import { DatelessReg, DatelessRegLength, DatelessRegMultiplier, DigitValues, IsAnyLetterUsedAsNumber, IsAnyNumberUsedAsLetter, LetterValues, MinMaxTotals, Spaces } from '../../formulas/dateless-formula';
import { NumberPlateType } from '../../models/reg.model';
import { FormsModule, ReactiveFormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatRadioModule } from '@angular/material/radio';
import { MatSlideToggleChange, MatSlideToggleModule } from '@angular/material/slide-toggle';
import { MatIconModule } from '@angular/material/icon';
import { MatCardModule } from '@angular/material/card';
import { MatDatepicker, MatDatepickerModule } from '@angular/material/datepicker';
import { MAT_DATE_FORMATS, MatNativeDateModule } from '@angular/material/core';
import { Moment } from 'moment';
import {
  MomentDateAdapter,
  MAT_MOMENT_DATE_ADAPTER_OPTIONS,
} from '@angular/material-moment-adapter';
import { DateAdapter, MAT_DATE_LOCALE } from '@angular/material/core';

import * as _moment from 'moment';
// tslint:disable-next-line:no-duplicate-imports
import { default as _rollupMoment } from 'moment';

const moment = _rollupMoment || _moment;
export const MY_FORMATS = {
  parse: {
    dateInput: 'YYYY',
  },
  display: {
    dateInput: 'YYYY',
    monthYearLabel: 'YYYY',
    dateA11yLabel: 'LL',
    monthYearA11yLabel: 'YYYY',
  },
};
@Component({
    selector: 'reg-plate-valuation-results',
    imports: [
        JsonPipe,
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
        MatNativeDateModule
    ],
    templateUrl: './reg-plate-valuation-results.component.html',
    styleUrl: './reg-plate-valuation-results.component.scss',
    providers: [
        {
            provide: DateAdapter,
            useClass: MomentDateAdapter,
            deps: [MAT_DATE_LOCALE, MAT_MOMENT_DATE_ADAPTER_OPTIONS],
        },
        { provide: MAT_DATE_FORMATS, useValue: MY_FORMATS },
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
  isAnyLetterUsedAsNumberPoints: number = 0;
  isAnyNumberUsedAsLetterPoints: number = 0;
  isDateOfPurchaseKnown: boolean = false;
  dateOfPurchaseKnownPoints: number = 0;
  multiplier: number = 0;
  DatelessRegMultiplier = DatelessRegMultiplier;
  multiplierPoints: number = 0;
  MinMaxTotals = MinMaxTotals;

  totalPoints: number = 0;
  totalPointsWithMultiplier: number = 0;
  minPrice: number = 0;
  maxPrice: number = 0;

  constructor(private sharedPlateDataService: SharedPlateDataService) {
    this.sharedPlateDataService.getCurrentPlateData().subscribe((data) => {

      // Need to reset toggle values to zero when plate changes
      // this.spacesPoints = 0;
      // this.isAnyLetterUsedAsNumberPoints = 0;
      // this.isAnyNumberUsedAsLetterPoints = 0;

      this.currentPlateData = data;
      this.currentPlate = data?.registration;
      this.currentPlateType = data?.type?.value;
      this.plateTypePoints = this.calcPlateTypePoints();
      this.plateLengthPoints = this.calcPlateLengthPoints();
      this.plateFirstCharacterPoints = this.calcPlateFirstCharacterPoints();
      this.plateCharacterPoints = this.calcPlateCharacterPoints();
      // this.spacesPoints = this.calcSpacesPoints(null);
      // this.isAnyLetterUsedAsNumberPoints = this.calcIsAnyLetterUsedAsNumberPoints();
      // this.isAnyNumberUsedAsLetterPoints = this.calcIsAnyNumberUsedAsLetterPoints();
      this.multiplier = this.calcMultiplierPoints();
      this.calcTotalPoints();
      this.calcMinPrice();
      this.calcMaxPrice();
    });
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

  calcDateOfPurchaseKnownPoints(event: Moment, dp: MatDatepicker<Moment>) {
    console.log("event:", event);
    console.log("event:", event.year());
    // this.dateOfPurchaseKnownPoints = DateOfPurchaseKnown[`_${event}` as keyof typeof DateOfPurchaseKnown];
    this.calcTotalPoints(); 
    this.calcMinPrice();
    this.calcMaxPrice();
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
    this.isAnyNumberUsedAsLetterPoints;
  }

  calcMinPrice() {
    this.minPrice = this.totalPoints * this.multiplier - ((this.totalPoints * this.multiplier) * MinMaxTotals.min);
  }

  calcMaxPrice() {
    this.maxPrice = this.totalPoints * this.multiplier + ((this.totalPoints * this.multiplier) * MinMaxTotals.max);
  } 
}
