import { ComponentFixture, TestBed } from '@angular/core/testing';

import { RegPlateValuationResultsComponent } from './reg-plate-valuation-results.component';

describe('RegPlateValuationResultsComponent', () => {
  let component: RegPlateValuationResultsComponent;
  let fixture: ComponentFixture<RegPlateValuationResultsComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [RegPlateValuationResultsComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(RegPlateValuationResultsComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
