import {Component, OnDestroy, OnInit} from '@angular/core';
import {FormBuilder, FormGroup, Validators} from "@angular/forms";

@Component({
  selector: 'app-main-section',
  standalone: true,
  imports: [],
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
