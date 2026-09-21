import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { provideNoopAnimations } from '@angular/platform-browser/animations';
import { MatDialog } from '@angular/material/dialog';
import { of } from 'rxjs';
import { PlateListingCardComponent } from './plate-listing-card.component';
import { AuthService } from '../../services/auth.service';
import { PlateListing } from '../../models/plate-listing.model';

const LISTING = {
  plateCharacters: 'mr 1',
  askingPrice: '12500',
  soldPrice: 9000,
  meanings: 'Mister One',
  initials: 'GS',
  createdDate: '2026-09-01',
  viewsPlaceholder: 7,
  isSold: false,
} as PlateListing;

describe('PlateListingCardComponent', () => {
  let fixture: ComponentFixture<PlateListingCardComponent>;
  let opened: unknown[];
  let currentUser: unknown;

  async function setup(variant: 'sale' | 'sold' = 'sale') {
    opened = [];
    await TestBed.configureTestingModule({
      imports: [PlateListingCardComponent],
      providers: [
        provideRouter([]),
        provideNoopAnimations(),
        { provide: AuthService, useValue: { currentUser$: of(currentUser) } },
        { provide: MatDialog, useValue: { open: (c: unknown) => opened.push(c) } },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(PlateListingCardComponent);
    fixture.componentRef.setInput('listing', LISTING);
    fixture.componentRef.setInput('variant', variant);
    fixture.detectChanges();
  }

  const el = (sel: string) => fixture.nativeElement.querySelector(sel);
  const text = () => fixture.nativeElement.textContent as string;

  beforeEach(() => { currentUser = null; });

  it('shows the plate, avatar and meaning', async () => {
    await setup();
    expect(el('.bevel-plate').textContent.trim()).toBe('MR 1');
    expect(el('.listing-avatar').textContent.trim()).toBe('GS');
    expect(text()).toContain('Mister One');
  });

  it('sale variant shows the asking price and Message Seller', async () => {
    await setup('sale');
    expect(text()).toContain('12500');
    expect(el('.message-seller-btn')).toBeTruthy();
    expect(el('.sold-tab-badge')).toBeFalsy();
  });

  it('sold variant shows the sold price, a badge and no Message Seller', async () => {
    await setup('sold');
    expect(text()).toContain('9,000');
    expect(el('.sold-tab-badge').textContent.trim()).toBe('SOLD');
    expect(el('.message-seller-btn')).toBeFalsy();
  });

  it('prompts signed-out visitors to authenticate', async () => {
    currentUser = null;
    await setup('sale');
    el('.message-seller-btn').click();
    expect(opened.length).toBe(1);
    expect((opened[0] as { name: string }).name)
      .toContain('AuthPromptDialogComponent');
  });

  it('opens the message dialog for signed-in users', async () => {
    currentUser = { uid: 'abc' };
    await setup('sale');
    el('.message-seller-btn').click();
    expect(opened.length).toBe(1);
    expect((opened[0] as { name: string }).name)
      .toContain('MessageSellerDialogComponent');
  });
});
