import { ComponentFixture, TestBed } from '@angular/core/testing';

import { AccountDashboardValuationComponent } from './account-dashboard-valuation.component';

describe('AccountDashboardValuationComponent', () => {
  let component: AccountDashboardValuationComponent;
  let fixture: ComponentFixture<AccountDashboardValuationComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [AccountDashboardValuationComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(AccountDashboardValuationComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
