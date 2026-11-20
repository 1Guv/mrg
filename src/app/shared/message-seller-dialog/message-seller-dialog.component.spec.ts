import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideNoopAnimations } from '@angular/platform-browser/animations';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import { of } from 'rxjs';
import { MessageSellerDialogComponent } from './message-seller-dialog.component';
import { AuthService } from '../../services/auth.service';
import { SellerEnquiryService } from '../../services/seller-enquiry.service';
import { ConversionTrackingService } from '../../services/conversion-tracking.service';
import { PlateListing } from '../../models/plate-listing.model';

const LISTING = { id: 'abc', plateCharacters: 'mr 1', askingPrice: '1000' } as unknown as PlateListing;

describe('MessageSellerDialogComponent', () => {
  let fixture: ComponentFixture<MessageSellerDialogComponent>;
  let component: MessageSellerDialogComponent;
  let calls: { fn: string; args: unknown[] }[];
  let sendError: unknown;

  async function setup(user: unknown) {
    calls = [];
    sendError = null;
    const result = () => sendError ? Promise.reject(sendError) : Promise.resolve({ whatsappNumber: '447000', plate: 'MR 1' });
    await TestBed.configureTestingModule({
      imports: [MessageSellerDialogComponent],
      providers: [
        provideNoopAnimations(),
        { provide: MAT_DIALOG_DATA, useValue: LISTING },
        { provide: MatDialogRef, useValue: { close: () => {} } },
        { provide: AuthService, useValue: { currentUser$: of(user) } },
        {
          provide: SellerEnquiryService, useValue: {
            sendEnquiry: (...args: unknown[]) => { calls.push({ fn: 'sendEnquiry', args }); return result(); },
            sendGuestEnquiry: (...args: unknown[]) => { calls.push({ fn: 'sendGuestEnquiry', args }); return result(); },
          }
        },
        { provide: ConversionTrackingService, useValue: { enquirySent: () => {} } },
      ],
    }).compileComponents();
    fixture = TestBed.createComponent(MessageSellerDialogComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  }

  const el = (sel: string) => fixture.nativeElement.querySelector(sel);
  const fill = (email = '') => component.form.patchValue({
    enquiryType: 'Other', message: 'Is this still for sale?', email,
  });

  it('asks signed-out buyers for their email, and sends as a guest', async () => {
    await setup(null);
    expect(el('input[type="email"]')).toBeTruthy();
    fill();
    expect(component.canSend).toBeFalse();
    fill('buyer@example.com');
    expect(component.canSend).toBeTrue();

    await component.onSubmit();
    expect(calls.length).toBe(1);
    expect(calls[0].fn).toBe('sendGuestEnquiry');
    expect(calls[0].args.slice(1)).toEqual(['Other', 'Is this still for sale?', 'buyer@example.com', '']);
    fixture.detectChanges();
    expect(fixture.nativeElement.textContent).toContain('buyer@example.com');
  });

  it('sends as the signed-in buyer, without asking for an email', async () => {
    await setup({ uid: 'u1', email: 'me@example.com' });
    expect(el('input[type="email"]')).toBeFalsy();
    fill();
    expect(component.canSend).toBeTrue();
    await component.onSubmit();
    expect(calls[0].fn).toBe('sendEnquiry');
  });

  it('fills in a message for the chosen reason, but never replaces one they typed', async () => {
    await setup(null);
    const type = component.form.get('enquiryType')!;
    const message = component.form.get('message')!;
    type.setValue('Is it still available?');
    expect(message.value).toBe('Hi, is MR 1 still available?');
    type.setValue('Is the price negotiable?');
    expect(message.value).toContain('negotiable');
    message.setValue('My own words about this plate');
    type.setValue('Is it still available?');
    expect(message.value).toBe('My own words about this plate');
  });

  it('explains the rate limit', async () => {
    await setup(null);
    fill('buyer@example.com');
    sendError = { code: 'functions/resource-exhausted' };
    await component.onSubmit();
    expect(component.errorMessage).toContain('try again in an hour');
    expect(component.submitted).toBeFalse();
  });
});
