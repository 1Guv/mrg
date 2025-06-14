import { TestBed } from '@angular/core/testing';

import { NumberPlateFormService } from './number-plate-form.service';

describe('NumberPlateFormService', () => {
  let service: NumberPlateFormService;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(NumberPlateFormService);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });
});
