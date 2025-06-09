import { Component, OnInit } from '@angular/core';
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
        MatTooltipModule
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

  constructor(
    private fb: FormBuilder,
    private sharedPlateDataService: SharedPlateDataService
  ) { }

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
    if (this.registrationForm.valid) {
      console.log(this.registrationForm.value);
      this.sharedPlateDataService.setCurrentPlateData(this.registrationForm.value);
    } else {
      this.sharedPlateDataService.setCurrentPlateData(null);
    }
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
    switch (this.registrationForm.get('type')?.value.value) {
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
