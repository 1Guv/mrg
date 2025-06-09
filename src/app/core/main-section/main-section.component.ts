import {Component, OnDestroy, OnInit} from '@angular/core';
import {FormBuilder, FormGroup, Validators} from "@angular/forms";
import { RegPlateMainComponent } from "../reg-plate-main/reg-plate-main.component";
import { RegPlateValuationResultsComponent } from "../reg-plate-valuation-results/reg-plate-valuation-results.component";

@Component({
    selector: 'app-main-section',
    standalone: true,
    imports: [
        RegPlateMainComponent,
        RegPlateValuationResultsComponent
    ],
    templateUrl: './main-section.component.html',
    styleUrl: './main-section.component.scss'
})
export class MainSectionComponent implements OnInit, OnDestroy {

  form: FormGroup = new FormGroup({})  ;

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
