import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { Observable, of } from 'rxjs';
import { PlatesPreviewComponent } from './plates-preview.component';
import { PlateListingService } from '../../services/plate-listing.service';
import { PlateListing } from '../../models/plate-listing.model';

function listing(over: Partial<PlateListing>): PlateListing {
  return {
    plateCharacters: 'AB 12 CDE',
    askingPrice: '5000',
    meanings: 'A meaning',
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
        {
          provide: PlateListingService,
          useValue: {
            getAll: (): Observable<PlateListing[]> => of(listings),
          },
        },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(PlatesPreviewComponent);
    if (limit !== undefined) fixture.componentRef.setInput('limit', limit);
    fixture.detectChanges();
  }

  const cards = (): HTMLElement[] =>
    Array.from(fixture.nativeElement.querySelectorAll('.plates-preview__card'));

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

  it('renders the plate and its asking price', async () => {
    await setup([listing({ plateCharacters: 'MR 1', askingPrice: '12500' })]);
    const text = cards()[0].textContent ?? '';
    expect(text).toContain('MR 1');
    expect(text).toContain('12,500');
  });

  it('links each card to that plate on the full page', async () => {
    await setup([listing({ plateCharacters: 'mr 1' })]);
    const href = cards()[0].querySelector('a')?.getAttribute('href');
    expect(href).toContain('/plates-for-sale/MR1');
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
