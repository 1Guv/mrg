import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { provideNoopAnimations } from '@angular/platform-browser/animations';
import { Observable, of } from 'rxjs';
import { PlatesPreviewComponent } from './plates-preview.component';
import { PlateListingService } from '../../services/plate-listing.service';
import { PlateListing } from '../../models/plate-listing.model';
import { AuthService } from '../../services/auth.service';

function listing(over: Partial<PlateListing>): PlateListing {
  return {
    plateCharacters: 'AB 12 CDE',
    askingPrice: '5000',
    meanings: 'A meaning',
    initials: 'GS',
    createdDate: '2026-09-01',
    viewsPlaceholder: 0,
    isSold: false,
    ...over,
  } as PlateListing;
}

describe('PlatesPreviewComponent', () => {
  let fixture: ComponentFixture<PlatesPreviewComponent>;

  async function setup(listings: PlateListing[], limit?: number) {
    await TestBed.configureTestingModule({
      imports: [PlatesPreviewComponent],
      providers: [
        provideRouter([]),
        provideNoopAnimations(),
        {
          provide: PlateListingService,
          useValue: {
            getAll: (): Observable<PlateListing[]> => of(listings),
          },
        },
        // The shared card injects AuthService for its Message Seller action.
        { provide: AuthService, useValue: { currentUser$: of(null) } },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(PlatesPreviewComponent);
    if (limit !== undefined) fixture.componentRef.setInput('limit', limit);
    fixture.detectChanges();
  }

  const cards = (): HTMLElement[] =>
    Array.from(
      fixture.nativeElement.querySelectorAll('app-plate-listing-card'));

  it('shows at most the requested number of listings', async () => {
    await setup(
      Array.from({ length: 10 }, (_, i) =>
        listing({ plateCharacters: `AB 1${i} CDE` })),
      4
    );
    expect(cards().length).toBe(4);
  });

  it('excludes sold listings', async () => {
    await setup([
      listing({ plateCharacters: 'LIVE 1', isSold: false }),
      listing({ plateCharacters: 'SOLD 1', isSold: true }),
    ]);
    const text = fixture.nativeElement.textContent;
    expect(text).toContain('LIVE 1');
    expect(text).not.toContain('SOLD 1');
  });

  it('uses the shared listing card', async () => {
    await setup([listing({})]);
    expect(cards()[0].querySelector('.listing-card')).toBeTruthy();
    expect(cards()[0].querySelector('.message-seller-btn')).toBeTruthy();
  });

  it('renders the plate and its asking price', async () => {
    await setup([listing({ plateCharacters: 'MR 1', askingPrice: '12500' })]);
    const text = cards()[0].textContent ?? '';
    expect(text).toContain('MR 1');
    expect(text).toContain('12500');
  });

  it('links each card to that plate on the full page', async () => {
    await setup([listing({ plateCharacters: 'mr 1' })]);
    const hrefs = Array.from(cards()[0].querySelectorAll('a'))
      .map(a => a.getAttribute('href'));
    expect(hrefs).toContain('/plates-for-sale/MR1');
  });

  it('shows an empty state when nothing is for sale', async () => {
    await setup([listing({ plateCharacters: 'SOLD 1', isSold: true })]);
    expect(cards().length).toBe(0);
    expect(fixture.nativeElement.textContent)
      .toContain('No plates listed for sale');
  });

  it('always offers a link through to the full page', async () => {
    await setup([]);
    const link: HTMLAnchorElement =
      fixture.nativeElement.querySelector('.plates-preview__all');
    expect(link).toBeTruthy();
    expect(link.getAttribute('href')).toContain('/plates-for-sale');
  });
});
