import {Component, OnDestroy, OnInit, signal} from '@angular/core';
import {FormBuilder, FormGroup, Validators} from "@angular/forms";
import { RegPlateMainComponent } from "../reg-plate-main/reg-plate-main.component";
import { RegPlateValuationResultsComponent } from "../reg-plate-valuation-results/reg-plate-valuation-results.component";
import { CurrentPlateValuationComponent } from "../current-plate-valuation/current-plate-valuation.component";
import { PrefixPlateValuationComponent } from "../prefix-plate-valuation/prefix-plate-valuation.component";
import { SuffixPlateValuationComponent } from "../suffix-plate-valuation/suffix-plate-valuation.component";
import { ListNowBannerComponent } from '../../shared/list-now-banner/list-now-banner.component';
import { ModeToggleComponent, HomeMode } from '../../shared/mode-toggle/mode-toggle.component';
import { PlatesPreviewComponent } from '../../shared/plates-preview/plates-preview.component';

@Component({
    selector: 'app-main-section',
    standalone: true,
    imports: [
        RegPlateMainComponent,
        RegPlateValuationResultsComponent,
        CurrentPlateValuationComponent,
        PrefixPlateValuationComponent,
        SuffixPlateValuationComponent,
        ListNowBannerComponent,
        ModeToggleComponent,
        PlatesPreviewComponent,
    ],
    templateUrl: './main-section.component.html',
    styleUrl: './main-section.component.scss'
})
export class MainSectionComponent implements OnInit, OnDestroy {

  form: FormGroup = new FormGroup({});

  /** Which half of the homepage the toggle is showing. */
  readonly mode = signal<HomeMode>('valuations');

  constructor(private formBuilder: FormBuilder,) {}

  ngOnInit() {
    this.buildForm()
  }

  buildForm() {
    this.form = this.formBuilder.group({
      reg: ['', Validators.required],
    })
  }

  ngOnDestroy() {
  }
}
