import { TestBed } from '@angular/core/testing';
import { PlateDetailComponent } from './plate-detail.component';
import { ActivatedRoute, ParamMap } from '@angular/router';
import { PlateListingService } from '../../services/plate-listing.service';
import { AuthService } from '../../services/auth.service';
import { MatDialog } from '@angular/material/dialog';
import { MatSnackBar } from '@angular/material/snack-bar';
import { Title } from '@angular/platform-browser';
import { of, Subject } from 'rxjs';
import { PlateListing } from '../../models/plate-listing.model';

function fakeParamMap(plate: string): ParamMap {
  return { get: (key: string) => (key === 'plate' ? plate : null) } as ParamMap;
}

describe('PlateDetailComponent', () => {
  let mockPlateService: jasmine.SpyObj<PlateListingService>;
  let paramMapSubject: Subject<ParamMap>;

  beforeEach(async () => {
    paramMapSubject = new Subject<ParamMap>();
    mockPlateService = jasmine.createSpyObj('PlateListingService', ['getByPlate']);
    mockPlateService.getByPlate.and.returnValue(of(null));

    await TestBed.configureTestingModule({
      imports: [PlateDetailComponent],
      providers: [
        { provide: ActivatedRoute, useValue: { paramMap: paramMapSubject.asObservable() } },
        { provide: PlateListingService, useValue: mockPlateService },
        { provide: AuthService, useValue: { currentUser$: of(null) } },
        { provide: MatDialog, useValue: { open: jasmine.createSpy() } },
        { provide: MatSnackBar, useValue: { open: jasmine.createSpy() } },
      ],
    }).compileComponents();
  });

  it('calls getByPlate with the route param', () => {
    TestBed.createComponent(PlateDetailComponent);
    paramMapSubject.next(fakeParamMap('AB12XYZ'));
    expect(mockPlateService.getByPlate).toHaveBeenCalledWith('AB12XYZ');
  });

  it('sets page title when listing is found', () => {
    const titleService = TestBed.inject(Title);
    spyOn(titleService, 'setTitle');
    const listing: Partial<PlateListing> = {
      plateCharacters: 'AB12 XYZ',
      askingPrice: '5000',
      meanings: 'Great plate',
      isSold: false,
    };
    mockPlateService.getByPlate.and.returnValue(of(listing as PlateListing));

    TestBed.createComponent(PlateDetailComponent);
    paramMapSubject.next(fakeParamMap('AB12XYZ'));

    expect(titleService.setTitle).toHaveBeenCalledWith('AB12XYZ Number Plate For Sale | MR Valuations');
  });

  it('resets page title on destroy', () => {
    const titleService = TestBed.inject(Title);
    spyOn(titleService, 'setTitle');
    const fixture = TestBed.createComponent(PlateDetailComponent);
    fixture.destroy();
    expect(titleService.setTitle).toHaveBeenCalledWith(
      'FREE Instant Number Plate Valuation | UKs 1st Automated Tool'
    );
  });
});
