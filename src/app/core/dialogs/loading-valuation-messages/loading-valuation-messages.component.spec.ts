import { ComponentFixture, TestBed } from '@angular/core/testing';

import { LoadingValuationMessagesComponent } from './loading-valuation-messages.component';

describe('LoadingValuationMessagesComponent', () => {
  let component: LoadingValuationMessagesComponent;
  let fixture: ComponentFixture<LoadingValuationMessagesComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [LoadingValuationMessagesComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(LoadingValuationMessagesComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
