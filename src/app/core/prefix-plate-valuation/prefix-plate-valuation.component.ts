import { ChangeDetectorRef, Component, inject, OnDestroy, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { MatCardModule } from '@angular/material/card';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatSelectModule } from '@angular/material/select';
import { MatButtonModule } from '@angular/material/button';
import { MatDialog } from '@angular/material/dialog';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { Router } from '@angular/router';
import { catchError, map, forkJoin, Observable, of, Subscription } from 'rxjs';
import { SharedPlateDataService } from '../../services/shared-plate-data.service';
import { NumberPlateFormService } from '../../services/number-plate-form.service';
import { DictionaryService } from '../../services/dictionary.service';
import { ValuationService } from '../../services/valuation.service';
import { NumberPlateType, RegValuation } from '../../models/reg.model';
import { LoadingValuationMessagesComponent } from '../dialogs/loading-valuation-messages/loading-valuation-messages.component';
import { VALUATION_LOADING_MESSAGES } from '../../models/valuation-loading-messages.model';
import { ShareButtonsComponent } from '../../shared/share-buttons/share-buttons.component';
import { ValuationFeedbackComponent } from '../../shared/valuation-feedback/valuation-feedback.component';
import { PlateValuationMessageFeedbackComponent } from '../../shared/plate-valuation-message-feedback/plate-valuation-message-feedback.component';
import { PlateValuationHeaderComponent } from '../../shared/plate-valuation-header/plate-valuation-header.component';
import { PlateBreakdownCardComponent } from '../../shared/plate-breakdown-card/plate-breakdown-card.component';
import { PlateValuationTotalsComponent } from '../../shared/plate-valuation-totals/plate-valuation-totals.component';
import { PrefixReg, PREFIX_YEAR_LETTER_YEAR, PREFIX_YEAR_LETTER_BONUS } from '../../formulas/prefix-formula';
import { VALID_TWO_LETTER_COMBINATIONS, POPULAR_NAMES, POPULAR_SURNAMES } from '../../formulas/current-formula';

const LETTERS = 'ABCDEFGHJKLMNOPQRSTUVWXY'.split('');
const ALL_LETTERS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('');

type PositionType = 'digit' | 'letter';

@Component({
  selector: 'app-prefix-plate-valuation',
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    MatCardModule,
    MatFormFieldModule,
    MatSelectModule,
    MatButtonModule,
    MatSnackBarModule,
    ShareButtonsComponent,
    ValuationFeedbackComponent,
    PlateValuationMessageFeedbackComponent,
    PlateValuationHeaderComponent,
    PlateBreakdownCardComponent,
    PlateValuationTotalsComponent,
  ],
  templateUrl: './prefix-plate-valuation.component.html',
  styleUrl: './prefix-plate-valuation.component.scss',
})
export class PrefixPlateValuationComponent implements OnInit, OnDestroy {
  private sharedPlateDataService = inject(SharedPlateDataService);
  private numberPlateFormService = inject(NumberPlateFormService);
  private dictionaryService = inject(DictionaryService);
  private fb = inject(FormBuilder);
  private cdr = inject(ChangeDetectorRef);
  private dialog = inject(MatDialog);
  private snackBar = inject(MatSnackBar);
  private valuationService = inject(ValuationService);
  private router = inject(Router);
  private subs = new Subscription();

  registration: string | null = null;

  // Parsed registration parts
  yearLetter: string = '';
  yearYear: string = '';
  numDigits: number = 0;
  totalLength: number = 0;
  originalChars: string[] = [];   // selectable chars (digits + suffix letters), excluding year letter
  positions: number[] = [];        // indices for form controls
  positionTypes: PositionType[] = [];
  positionLabels: string[] = [];

  form: FormGroup = this.fb.group({});

  // State
  showResults = false;
  isCalculating = false;
  private savedValuationId: string | null = null;

  // Results
  basePrice = PrefixReg.start;
  totalPrice = 0;
  minPrice = 0;
  maxPrice = 0;
  ageYearBonus = 0;

  // Dictionary / word results
  isDictionaryWord: boolean | null = null;
  wordOneText = '';
  wordTwoText = '';
  isWordOne: boolean | null = null;
  isWordTwo: boolean | null = null;
  wordBonus = 0;
  wordOneBonus = 0;
  wordTwoBonus = 0;
  legalSpacingBonus = 0;

  // Name results
  nameOneMatch: string | null = null;
  nameTwoMatch: string | null = null;
  nameOneBonus = 0;
  nameTwoBonus = 0;
  surnameOneMatch: string | null = null;
  surnameTwoMatch: string | null = null;
  surnameOneBonus = 0;
  surnameTwoBonus = 0;

  wordOptions = [1, 2, 3];

  ngOnInit() {
    this.subs.add(
      this.sharedPlateDataService.getPrefixPlatePending().subscribe(reg => {
        this.registration = reg;
        if (reg) {
          this.showResults = false;
          this.savedValuationId = null;
          this.parseRegistration(reg);
          this.buildForm();
          this.cdr.detectChanges();
        }
      })
    );
  }

  private parseRegistration(reg: string) {
    const stripped = reg.replace(/\s/g, '').toUpperCase();
    this.yearLetter = stripped[0];
    this.yearYear = PREFIX_YEAR_LETTER_YEAR[this.yearLetter] ?? '';
    const rest = stripped.slice(1); // digits + suffix letters, e.g. "457CAR"
    this.numDigits = rest.length - 3;
    this.totalLength = stripped.length;
    this.originalChars = rest.split('');
    this.positions = rest.split('').map((_, i) => i);
    this.positionTypes = [
      ...Array(this.numDigits).fill('digit' as PositionType),
      ...Array(3).fill('letter' as PositionType),
    ];
    this.positionLabels = [
      ...Array(this.numDigits).fill(0).map((_, i) => `Digit ${i + 1}`),
      'Letter 1', 'Letter 2', 'Letter 3',
    ];
  }

  private buildForm() {
    const controls: any = {};
    this.positions.forEach(i => {
      const type = this.positionTypes[i];
      const original = this.originalChars[i];
      if (type === 'digit') {
        controls[`char${i}`] = ['', Validators.required];
      } else {
        const value = LETTERS.includes(original) ? original : '';
        controls[`char${i}`] = [value, Validators.required];
      }
    });
    controls['wordCombination'] = ['', Validators.required];
    controls['twoWordSpacing'] = [''];
    this.form = this.fb.group(controls);

    this.subs.add(
      this.form.valueChanges.subscribe(() => {
        if (this.showResults) {
          this.savedValuationId = null;
          this.showResults = false;
          this.resetResults();
        }
      })
    );

    this.subs.add(
      this.form.get('wordCombination')!.valueChanges.subscribe(val => {
        const spacingCtrl = this.form.get('twoWordSpacing')!;
        if (val === 2) {
          spacingCtrl.setValidators(Validators.required);
        } else {
          spacingCtrl.clearValidators();
          spacingCtrl.reset('');
        }
        spacingCtrl.updateValueAndValidity();
      })
    );
  }

  get digitPositions(): number[] {
    return this.positions.filter(i => this.positionTypes[i] === 'digit');
  }

  get letterPositions(): number[] {
    return this.positions.filter(i => this.positionTypes[i] === 'letter');
  }

  get isTwoWords(): boolean {
    return this.form.get('wordCombination')?.value === 2;
  }

  get twoWordSpacingOptions() {
    const fullWord = this.getFullWord();
    const legalSplit = 1 + this.numDigits;
    const opts = [];
    for (let split = 1; split < this.totalLength; split++) {
      const second = this.totalLength - split;
      const plate = fullWord.slice(0, split) + ' ' + fullWord.slice(split);
      opts.push({
        value: `${split}`,
        plate,
        description: `${split} x ${second}`,
        legal: split === legalSplit,
      });
    }
    return opts;
  }

  getOptions(index: number): string[] {
    if (this.positionTypes[index] === 'digit') {
      return [...ALL_LETTERS, this.originalChars[index]];
    }
    return LETTERS;
  }

  /** Full word including year letter (uses '_' for unfilled positions) */
  getFullWord(): string {
    return this.yearLetter + this.positions.map(i =>
      this.form.get(`char${i}`)?.value || '_'
    ).join('');
  }

  /** Full word for dictionary checks (no underscore fallback) */
  private getFullWordClean(): string {
    return this.yearLetter + this.positions.map(i =>
      this.form.get(`char${i}`)?.value ?? ''
    ).join('');
  }

  getPlatePreview(): string {
    const parts = this.positions.map(i => this.form.get(`char${i}`)?.value || '_');
    const digitPart = parts.slice(0, this.numDigits).join('');
    const letterPart = parts.slice(this.numDigits).join('');
    return `${this.yearLetter}${digitPart} ${letterPart}`;
  }

  onCalculate() {
    if (this.form.invalid) return;
    this.showResults = false;
    this.isDictionaryWord = null;

    const wordCount = this.form.get('wordCombination')?.value;
    const spacing = this.form.get('twoWordSpacing')?.value;
    const fullWord = this.getFullWordClean();
    const splitAt = spacing ? parseInt(spacing) : 0;

    const wordOneToCheck = wordCount === 2 ? fullWord.slice(0, splitAt) : '';
    const wordTwoToCheck = wordCount === 2 ? fullWord.slice(splitAt) : '';

    const checkWord = (w: string): Observable<boolean | null> => {
      if (!w || w.length <= 1) return of<boolean | null>(null);
      if (w in VALID_TWO_LETTER_COMBINATIONS) return of<boolean | null>(true);
      return this.dictionaryService.isRealWord(w);
    };

    this.isCalculating = true;

    const dialogRef = this.dialog.open(LoadingValuationMessagesComponent, {
      data: { messages: VALUATION_LOADING_MESSAGES },
      disableClose: true,
    });

    this.subs.add(
      forkJoin({
        dialogClosed: dialogRef.afterClosed(),
        isWord: wordCount === 1 ? this.dictionaryService.isRealWord(fullWord) : of<boolean | null>(null),
        isWordOne: checkWord(wordOneToCheck),
        isWordTwo: checkWord(wordTwoToCheck),
      }).subscribe(({ isWord, isWordOne, isWordTwo }) => {
        this.isDictionaryWord = isWord;
        this.wordOneText = wordCount === 1 ? fullWord : wordOneToCheck;
        this.wordTwoText = wordTwoToCheck;
        this.isWordOne = isWordOne;
        this.isWordTwo = isWordTwo;

        this.calcNameMatches();

        // Scoring
        this.totalPrice = this.basePrice;
        this.ageYearBonus = PREFIX_YEAR_LETTER_BONUS[this.yearLetter] ?? 0;
        this.totalPrice += this.ageYearBonus;

        // Word bonuses: +1000 if real word, -500 if not
        if (wordCount === 1) {
          this.wordBonus = isWord === true ? 2000 : -1000;
          this.wordOneBonus = 0;
          this.wordTwoBonus = 0;
          this.totalPrice += this.wordBonus;
        } else if (wordCount === 2) {
          this.wordBonus = 0;
          this.wordOneBonus = isWordOne === true ? 1000 : -500;
          this.wordTwoBonus = isWordTwo === true ? 1000 : -500;
          const selectedOpt = this.twoWordSpacingOptions.find(o => o.value === spacing);
          this.legalSpacingBonus = selectedOpt?.legal ? 3000 : -3000;
          this.totalPrice += this.wordOneBonus + this.wordTwoBonus + this.legalSpacingBonus;
        } else {
          this.wordBonus = 0;
          this.wordOneBonus = 0;
          this.wordTwoBonus = 0;
          this.legalSpacingBonus = 0;
        }

        // Name / surname bonuses (flat £2,000 each if matched)
        this.totalPrice += this.nameOneBonus + this.nameTwoBonus
          + this.surnameOneBonus + this.surnameTwoBonus;

        this.minPrice = this.totalPrice * 0.25;
        this.maxPrice = this.totalPrice * 1.25;

        this.isCalculating = false;
        this.showResults = true;
        this.cdr.detectChanges();
        this.autoSave();
      })
    );
  }

  private calcNameMatches() {
    this.nameOneMatch = null;
    this.nameOneBonus = 0;
    this.nameTwoMatch = null;
    this.nameTwoBonus = 0;
    this.surnameOneMatch = null;
    this.surnameOneBonus = 0;
    this.surnameTwoMatch = null;
    this.surnameTwoBonus = 0;

    if (this.wordOneText) {
      if (POPULAR_NAMES[this.wordOneText]) {
        this.nameOneMatch = this.wordOneText;
        this.nameOneBonus = POPULAR_NAMES[this.wordOneText];
      }
      if (POPULAR_SURNAMES[this.wordOneText]) {
        this.surnameOneMatch = this.wordOneText;
        this.surnameOneBonus = POPULAR_SURNAMES[this.wordOneText];
      }
    }
    if (this.wordTwoText) {
      if (POPULAR_NAMES[this.wordTwoText]) {
        this.nameTwoMatch = this.wordTwoText;
        this.nameTwoBonus = POPULAR_NAMES[this.wordTwoText];
      }
      if (POPULAR_SURNAMES[this.wordTwoText]) {
        this.surnameTwoMatch = this.wordTwoText;
        this.surnameTwoBonus = POPULAR_SURNAMES[this.wordTwoText];
      }
    }
  }

  onReset() {
    this.showResults = false;
    this.isCalculating = false;
    this.savedValuationId = null;
    this.resetResults();
    this.sharedPlateDataService.setPrefixPlatePending(null);
    this.numberPlateFormService.triggerReset();
  }

  private resetResults() {
    this.totalPrice = 0;
    this.minPrice = 0;
    this.maxPrice = 0;
    this.ageYearBonus = 0;
    this.isDictionaryWord = null;
    this.wordOneText = '';
    this.wordTwoText = '';
    this.isWordOne = null;
    this.isWordTwo = null;
    this.wordBonus = 0;
    this.wordOneBonus = 0;
    this.wordTwoBonus = 0;
    this.legalSpacingBonus = 0;
    this.nameOneMatch = null;
    this.nameTwoMatch = null;
    this.nameOneBonus = 0;
    this.nameTwoBonus = 0;
    this.surnameOneMatch = null;
    this.surnameTwoMatch = null;
    this.surnameOneBonus = 0;
    this.surnameTwoBonus = 0;
  }

  private buildValuation(): RegValuation {
    return {
      type: NumberPlateType.Prefix,
      registration: (this.registration ?? '').toUpperCase(),
      plateMeaning: this.getPlatePreview().toUpperCase(),
      totalPoints: this.totalPrice,
      totalPointsWithMultiplier: this.totalPrice,
      multiplier: 1,
      minPrice: this.minPrice,
      maxPrice: this.maxPrice,
      createdAt: new Date(),
    };
  }

  private autoSave() {
    this.valuationService.autoSaveValuation(
      (this.registration ?? '').toUpperCase(),
      this.totalPrice,
      'prefix',
      this.minPrice,
      this.maxPrice
    ).subscribe();

    this.subs.add(
      this.valuationService.addValuation(this.buildValuation()).pipe(
        map((docRef) => { this.savedValuationId = docRef.id; }),
        catchError(() => of(null))
      ).subscribe()
    );
  }

  onSaveValuation() {
    if (this.savedValuationId) {
      this.snackBar.open('Valuation already saved to your account', 'OK');
      return;
    }
    const valuation = this.buildValuation();
    this.valuationService.setValuation(valuation);
    this.subs.add(
      this.valuationService.addValuation(valuation).pipe(
        map((docRef) => {
          this.savedValuationId = docRef.id;
          this.snackBar.open('Valuation saved successfully and can be viewed in your account', 'OK');
        }),
        catchError(() => {
          this.router.navigate(['/login']);
          this.snackBar.open('Please login or register to save your valuation', 'OK');
          return of(null);
        })
      ).subscribe()
    );
  }

  get shareText(): string {
    const plate = this.getPlatePreview().toUpperCase();
    return `${plate} has been valued at £${this.totalPrice.toFixed(2)} on MR Valuations!`;
  }

  ngOnDestroy() {
    this.subs.unsubscribe();
  }
}
