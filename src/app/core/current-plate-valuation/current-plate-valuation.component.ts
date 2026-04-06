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
import { catchError, map } from 'rxjs';
import { ShareButtonsComponent } from '../../shared/share-buttons/share-buttons.component';
import { ValuationFeedbackComponent } from '../../shared/valuation-feedback/valuation-feedback.component';
import { PlateValuationMessageFeedbackComponent } from '../../shared/plate-valuation-message-feedback/plate-valuation-message-feedback.component';
import { PlateValuationHeaderComponent } from '../../shared/plate-valuation-header/plate-valuation-header.component';
import { PlateBreakdownCardComponent } from '../../shared/plate-breakdown-card/plate-breakdown-card.component';
import { PlateValuationTotalsComponent } from '../../shared/plate-valuation-totals/plate-valuation-totals.component';
import { ValuationService } from '../../services/valuation.service';
import { NumberPlateType, RegValuation } from '../../models/reg.model';
import { Subscription } from 'rxjs';
import { SharedPlateDataService } from '../../services/shared-plate-data.service';
import { NumberPlateFormService } from '../../services/number-plate-form.service';
import { DictionaryService } from '../../services/dictionary.service';
import { forkJoin, Observable, of } from 'rxjs';
import { LoadingValuationMessagesComponent } from '../dialogs/loading-valuation-messages/loading-valuation-messages.component';
import { VALUATION_LOADING_MESSAGES } from '../../models/valuation-loading-messages.model';
import { AGE_IDENTIFIER_MATCH, AGE_IDENTIFIER_NO_MATCH, CurrentReg, CurrentRegYearMultiplier, DICTIONARY_WORD_BONUS, FIRST_CHAR_NOT_X_PENALTY, FIRST_CHAR_X_BONUS, NON_LEGAL_SPACING_PENALTY, ONE_WORD_DICTIONARY_MATCH, ONE_WORD_DICTIONARY_NO_MATCH, PLATE_ALPHABET, POPULAR_NAMES, POPULAR_SURNAMES, SPECIAL_COMBINATIONS, THREE_WORD_PENALTY, TWO_WORD_LEGAL_SPACING_BONUS, VALID_TWO_LETTER_COMBINATIONS, WORD_DICT_MATCH_BONUS, WORD_DICT_NO_MATCH_PENALTY } from '../../formulas/current-formula';

const LETTERS = 'ABCDEFGHJKLMNOPQRSTUVWXY'.split(''); // A-Z excluding I and Z
const ALL_LETTERS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split(''); // A-Z including I and Z

const POSITION_TYPES: Array<'letter' | 'age-letter' | 'number'> = [
  'letter', 'letter', 'age-letter', 'age-letter', 'letter', 'letter', 'letter'
];

const POSITION_LABELS = [
  'Area 1', 'Area 2', 'Age 1', 'Age 2', 'Random 1', 'Random 2', 'Random 3'
];

@Component({
  selector: 'app-current-plate-valuation',
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
  templateUrl: './current-plate-valuation.component.html',
  styleUrl: './current-plate-valuation.component.scss'
})
export class CurrentPlateValuationComponent implements OnInit, OnDestroy {
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
  form: FormGroup = this.fb.group({});
  positionLabels = POSITION_LABELS;
  positions = [0, 1, 2, 3, 4, 5, 6];
  showResults = false;
  isCalculating = false;
  basePrice = CurrentReg.start;
  totalPrice = 0;
  ageIdentifierBreakdown: { digit: string; chosenLetter: string; match: boolean; value: number }[] = [];
  oneWordBonus: number = 0;
  legalSpacingBonus: number = 0;
  wordOneText: string = '';
  wordTwoText: string = '';
  isWordOne: boolean | null = null;
  isWordTwo: boolean | null = null;
  wordOneBonus: number = 0;
  wordTwoBonus: number = 0;
  firstCharBonus: number = 0;
  nameOneMatch: string | null = null;
  nameTwoMatch: string | null = null;
  nameOneBonus: number = 0;
  nameTwoBonus: number = 0;
  surnameOneMatch: string | null = null;
  surnameTwoMatch: string | null = null;
  surnameOneBonus: number = 0;
  surnameTwoBonus: number = 0;
  surnameMatch: string | null = null;
  surnameBonus: number = 0;
  specialCombinationMatch: string | null = null;
  specialCombinationBonus: number = 0;
  ageIdentifierYear: string = '';
  ageYearBonus: number = 0;
  dictionaryBonus: number = 0;
  dictionaryBonusPotential = DICTIONARY_WORD_BONUS;
  isDictionaryWord: boolean | null = null;
  minPrice: number = 0;
  maxPrice: number = 0;
  private savedValuationId: string | null = null;

  ngOnInit() {
    this.subs.add(
      this.sharedPlateDataService.getCurrentPlatePending().subscribe(reg => {
        this.registration = reg;
        if (reg) {
          this.showResults = false;
          this.savedValuationId = null;
          this.buildForm(reg);
          this.cdr.detectChanges();
        }
      })
    );
  }

  wordOptions = [1, 2, 3];

  get twoWordSpacingOptions() {
    const chars = this.positions.map(i => this.form.get(`char${i}`)?.value ?? '_').join('');
    const fmt = (a: number, b: number) =>
      `${chars.slice(0, a)} ${chars.slice(a, a + b)}`;
    return [
      { value: 'a', plate: fmt(4, 3), description: '4 x 3', legal: true },
      { value: 'b', plate: fmt(1, 6), description: '1 x 6', legal: false },
      { value: 'c', plate: fmt(2, 5), description: '2 x 5', legal: false },
      { value: 'd', plate: fmt(3, 4), description: '3 x 4', legal: false },
      { value: 'e', plate: fmt(5, 2), description: '5 x 2', legal: false },
      { value: 'f', plate: fmt(6, 1), description: '6 x 1', legal: false },
    ];
  }

  get isTwoWords(): boolean {
    return this.form.get('wordCombination')?.value === 2;
  }

  buildForm(reg: string) {
    const chars = reg.replace(/\s/g, '').toUpperCase().split('');
    const controls: any = {};
    this.positions.forEach(i => {
      const isAgePosition = POSITION_TYPES[i] === 'age-letter';
      const options = this.getOptions(i);
      const value = (!isAgePosition && options.includes(chars[i])) ? chars[i] : '';
      controls[`char${i}`] = [value, Validators.required];
    });
    controls['wordCombination'] = ['', Validators.required];
    controls['twoWordSpacing'] = [''];
    this.form = this.fb.group(controls);

    this.subs.add(
      this.form.valueChanges.subscribe(() => {
        if (this.showResults) {
          this.savedValuationId = null;
          this.showResults = false;
          this.totalPrice = 0;
          this.ageIdentifierBreakdown = [];
          this.oneWordBonus = 0;
          this.legalSpacingBonus = 0;
          this.dictionaryBonus = 0;
          this.isDictionaryWord = null;
          this.wordOneText = '';
          this.wordTwoText = '';
          this.isWordOne = null;
          this.isWordTwo = null;
          this.wordOneBonus = 0;
          this.wordTwoBonus = 0;
          this.firstCharBonus = 0;
          this.nameOneMatch = null;
          this.nameTwoMatch = null;
          this.nameOneBonus = 0;
          this.nameTwoBonus = 0;
          this.surnameOneMatch = null;
          this.surnameTwoMatch = null;
          this.surnameOneBonus = 0;
          this.surnameTwoBonus = 0;
          this.surnameMatch = null;
          this.surnameBonus = 0;
          this.specialCombinationMatch = null;
          this.specialCombinationBonus = 0;
          this.ageYearBonus = 0;
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

  getOptions(index: number): string[] {
    if (POSITION_TYPES[index] === 'age-letter') {
      const digits = (this.registration ?? '').replace(/\s/g, '').toUpperCase();
      const digit = digits[index];
      if (digit && !ALL_LETTERS.includes(digit)) {
        return [...ALL_LETTERS, digit];
      }
      return ALL_LETTERS;
    }
    return LETTERS;
  }

  getPlatePreview(): string {
    const vals = this.positions.map(i => this.form.get(`char${i}`)?.value ?? '');
    return `${vals[0]}${vals[1]}${vals[2]}${vals[3]} ${vals[4]}${vals[5]}${vals[6]}`;
  }

  onCalculate() {
    if (this.form.invalid) return;
    this.showResults = false;
    this.isDictionaryWord = null;

    const allChars = this.positions.map(i => this.form.get(`char${i}`)?.value ?? '');
    const fullWord = allChars.join('');
    const wordCount = this.form.get('wordCombination')?.value;
    const spacing = this.form.get('twoWordSpacing')?.value;

    // Determine the two words to check based on spacing combination
    let wordOneToCheck = '';
    let wordTwoToCheck = '';
    if (wordCount === 2) {
      switch (spacing) {
        case 'a': wordOneToCheck = allChars.slice(0, 4).join(''); wordTwoToCheck = allChars.slice(4).join(''); break; // 4x3
        case 'b': wordTwoToCheck = allChars.slice(1).join(''); break; // 1x6 — word1 is single char, skip
        case 'c': wordOneToCheck = allChars.slice(0, 2).join(''); wordTwoToCheck = allChars.slice(2).join(''); break; // 2x5
        case 'd': wordOneToCheck = allChars.slice(0, 3).join(''); wordTwoToCheck = allChars.slice(3).join(''); break; // 3x4
        case 'e': wordOneToCheck = allChars.slice(0, 5).join(''); wordTwoToCheck = allChars.slice(5).join(''); break; // 5x2
        case 'f': wordOneToCheck = allChars.slice(0, 6).join(''); break; // 6x1 — word2 is single char, skip
      }
    }

    const checkWord = (w: string): Observable<boolean | null> => {
      if (!w || w.length <= 1) return of<boolean | null>(null);
      if (w in VALID_TWO_LETTER_COMBINATIONS) return of<boolean | null>(true);
      return this.dictionaryService.isRealWord(w);
    };

    this.isCalculating = true;

    const dialogRef = this.dialog.open(LoadingValuationMessagesComponent, {
      data: { messages: VALUATION_LOADING_MESSAGES },
      disableClose: true
    });

    this.subs.add(
      forkJoin({
        dialogClosed: dialogRef.afterClosed(),
        isWord: wordCount === 1 ? this.dictionaryService.isRealWord(fullWord) : of<boolean | null>(null),
        isWordOne: checkWord(wordOneToCheck),
        isWordTwo: checkWord(wordTwoToCheck),
      }).subscribe(({ isWord, isWordOne, isWordTwo }) => {
        this.isDictionaryWord = isWord;
        this.dictionaryBonus = isWord ? DICTIONARY_WORD_BONUS : 0;
        this.wordOneText = wordOneToCheck;
        this.wordTwoText = wordTwoToCheck;
        this.isWordOne = isWordOne;
        this.isWordTwo = isWordTwo;
        this.totalPrice = this.basePrice;
        this.totalPrice += this.calcAgeYearBonus();
        this.totalPrice += this.calcAgeIdentifierScore();
        this.totalPrice += this.calcOneWordBonus();
        this.totalPrice += this.dictionaryBonus;
        this.totalPrice += this.calcLegalSpacingBonus();
        this.totalPrice += this.calcSpacingWordBonuses(spacing, allChars[0], isWordOne, isWordTwo);
        this.totalPrice += this.calcSurnameBonus();
        this.totalPrice += this.calcSpecialCombinationBonus();
        this.minPrice = this.totalPrice * 0.25;
        this.maxPrice = this.totalPrice * 1.25;
        this.isCalculating = false;
        this.showResults = true;
        this.cdr.detectChanges();
        this.autoSave();
      })
    );
  }

  onReset() {
    this.showResults = false;
    this.isCalculating = false;
    this.totalPrice = 0;
    this.ageIdentifierBreakdown = [];
    this.oneWordBonus = 0;
    this.legalSpacingBonus = 0;
    this.dictionaryBonus = 0;
    this.isDictionaryWord = null;
    this.wordOneText = '';
    this.wordTwoText = '';
    this.isWordOne = null;
    this.isWordTwo = null;
    this.wordOneBonus = 0;
    this.wordTwoBonus = 0;
    this.firstCharBonus = 0;
    this.surnameMatch = null;
    this.surnameBonus = 0;
    this.specialCombinationMatch = null;
    this.specialCombinationBonus = 0;
    this.ageYearBonus = 0;
    this.savedValuationId = null;
    this.sharedPlateDataService.setCurrentPlatePending(null);
    this.numberPlateFormService.triggerReset();
  }

  listNow(): void {
    this.router.navigate(['/list-plate'], {
      queryParams: {
        plate: (this.registration ?? '').toUpperCase(),
        price: this.totalPrice.toFixed(2),
        min: this.minPrice.toFixed(2),
        max: this.maxPrice.toFixed(2),
      },
    });
  }

  calcAgeYearBonus(): number {
    const digits = (this.registration ?? '').replace(/\s/g, '').toUpperCase();
    this.ageIdentifierYear = digits[2] + digits[3];
    this.ageYearBonus = CurrentRegYearMultiplier[this.ageIdentifierYear] ?? 0;
    return this.ageYearBonus;
  }

  calcSpecialCombinationBonus(): number {
    const fullWord = this.positions.map(i => this.form.get(`char${i}`)?.value ?? '').join('');
    if (SPECIAL_COMBINATIONS[fullWord]) {
      this.specialCombinationMatch = fullWord;
      this.specialCombinationBonus = SPECIAL_COMBINATIONS[fullWord];
      return this.specialCombinationBonus;
    }
    this.specialCombinationMatch = null;
    this.specialCombinationBonus = 0;
    return 0;
  }

  calcSurnameBonus(): number {
    const allChars = this.positions.map(i => this.form.get(`char${i}`)?.value ?? '');
    const candidates = [
      allChars.join(''),           // all 7 chars
      allChars.slice(2).join(''),  // last 5 (age + random) e.g. SINGH
      allChars.slice(3).join(''),  // last 4 e.g. INGH
      allChars.slice(4).join(''),  // last 3 (random only)
    ];

    for (const word of candidates) {
      if (POPULAR_SURNAMES[word]) {
        this.surnameMatch = word;
        this.surnameBonus = POPULAR_SURNAMES[word];
        return this.surnameBonus;
      }
    }

    this.surnameMatch = null;
    this.surnameBonus = 0;
    return 0;
  }

  calcSpacingWordBonuses(spacing: string, firstChar: string, isWordOne: boolean | null, isWordTwo: boolean | null): number {
    if (this.form.get('wordCombination')?.value !== 2) return 0;

    const match = (isWord: boolean | null, len: number) =>
      isWord === null ? 0 : isWord ? (WORD_DICT_MATCH_BONUS[len] ?? 0) : (WORD_DICT_NO_MATCH_PENALTY[len] ?? 0);

    this.wordOneBonus = 0;
    this.wordTwoBonus = 0;
    this.firstCharBonus = 0;

    switch (spacing) {
      case 'a': // 4x3
        this.wordOneBonus = match(isWordOne, 4);
        this.wordTwoBonus = match(isWordTwo, 3);
        break;
      case 'b': // 1x6 — first char X bonus + 6-letter dict check
        this.firstCharBonus = firstChar === 'X' ? FIRST_CHAR_X_BONUS : FIRST_CHAR_NOT_X_PENALTY;
        this.wordTwoBonus = match(isWordTwo, 6);
        break;
      case 'c': // 2x5
        this.wordOneBonus = match(isWordOne, 2);
        this.wordTwoBonus = match(isWordTwo, 5);
        break;
      case 'd': // 3x4
        this.wordOneBonus = match(isWordOne, 3);
        this.wordTwoBonus = match(isWordTwo, 4);
        break;
      case 'e': // 5x2
        this.wordOneBonus = match(isWordOne, 5);
        this.wordTwoBonus = match(isWordTwo, 2);
        break;
      case 'f': // 6x1 — 6-letter dict check, single char skipped
        this.wordOneBonus = match(isWordOne, 6);
        break;
    }

    // Check each word against popular names list
    this.nameOneMatch = null;
    this.nameOneBonus = 0;
    this.nameTwoMatch = null;
    this.nameTwoBonus = 0;

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

    return this.firstCharBonus + this.wordOneBonus + this.wordTwoBonus
      + this.nameOneBonus + this.nameTwoBonus
      + this.surnameOneBonus + this.surnameTwoBonus;
  }

  calcLegalSpacingBonus(): number {
    const wordCount = this.form.get('wordCombination')?.value;
    const isLegalSpacing = this.form.get('twoWordSpacing')?.value === 'a';

    if (wordCount === 3) {
      this.legalSpacingBonus = THREE_WORD_PENALTY;
    } else if (wordCount === 2 && isLegalSpacing) {
      this.legalSpacingBonus = TWO_WORD_LEGAL_SPACING_BONUS;
    } else {
      this.legalSpacingBonus = NON_LEGAL_SPACING_PENALTY;
    }
    return this.legalSpacingBonus;
  }

  calcOneWordBonus(): number {
    const isOneWord = this.form.get('wordCombination')?.value === 1;
    if (!isOneWord) return 0;
    this.oneWordBonus = this.isDictionaryWord ? ONE_WORD_DICTIONARY_MATCH : ONE_WORD_DICTIONARY_NO_MATCH;
    return this.oneWordBonus;
  }

  calcAgeIdentifierScore(): number {
    const originalDigits = (this.registration ?? '').replace(/\s/g, '').toUpperCase();
    const agePositions = [2, 3];
    this.ageIdentifierBreakdown = [];
    let score = 0;

    agePositions.forEach(i => {
      const digit = originalDigits[i];
      const chosenLetter = this.form.get(`char${i}`)?.value ?? '';
      const matches = PLATE_ALPHABET[digit] ?? [];
      const match = matches.includes(chosenLetter);
      const value = match ? AGE_IDENTIFIER_MATCH : AGE_IDENTIFIER_NO_MATCH;
      score += value;
      this.ageIdentifierBreakdown.push({ digit, chosenLetter, match, value });
    });

    return score;
  }

  private buildValuation(): RegValuation {
    return {
      type: NumberPlateType.Current,
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
    const valuation = this.buildValuation();

    // Track in auto_valuations for admin dashboard
    this.subs.add(
      this.valuationService.autoSaveValuation(
        (this.registration ?? '').toUpperCase(),
        this.totalPrice,
        'current',
        this.minPrice,
        this.maxPrice
      ).subscribe()
    );

    // Save to user's valuations
    this.subs.add(
      this.valuationService.addValuation(valuation).pipe(
        map((docRef) => {
          this.savedValuationId = docRef.id;
        }),
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
