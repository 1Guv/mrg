import { ComponentFixture, TestBed } from '@angular/core/testing';

import { RegPlateMainComponent } from './reg-plate-main.component';

describe('RegPlateMainComponent', () => {
  let component: RegPlateMainComponent;
  let fixture: ComponentFixture<RegPlateMainComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [RegPlateMainComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(RegPlateMainComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
