import { TestBed } from '@angular/core/testing';
import { SellerEnquiryService } from './seller-enquiry.service';
import { Firestore } from '@angular/fire/firestore';
import { PlateListingService } from './plate-listing.service';

describe('SellerEnquiryService', () => {
  let service: SellerEnquiryService;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        SellerEnquiryService,
        { provide: Firestore, useValue: {} },
        { provide: PlateListingService, useValue: { incrementViews: () => Promise.resolve() } }
      ]
    });
    service = TestBed.inject(SellerEnquiryService);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });
});
