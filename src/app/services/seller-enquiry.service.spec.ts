import { TestBed } from '@angular/core/testing';
import { SellerEnquiryService } from './seller-enquiry.service';
import { Firestore } from '@angular/fire/firestore';
import { Functions } from '@angular/fire/functions';

describe('SellerEnquiryService', () => {
  let service: SellerEnquiryService;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        SellerEnquiryService,
        { provide: Firestore, useValue: {} },
        { provide: Functions, useValue: {} }
      ]
    });
    service = TestBed.inject(SellerEnquiryService);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });
});
