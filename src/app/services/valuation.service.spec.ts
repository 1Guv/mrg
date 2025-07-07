import { TestBed } from '@angular/core/testing';

import { ValuationService } from './valuation.service';

describe('ValuationService', () => {
  let service: ValuationService;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(ValuationService);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });
});
