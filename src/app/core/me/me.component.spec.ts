import { ComponentFixture, TestBed } from '@angular/core/testing';
import { MeComponent } from './me.component';
import { AdminsService } from '../../services/admins.service';
import { computed } from '@angular/core';
import { NoopAnimationsModule } from '@angular/platform-browser/animations';

describe('MeComponent', () => {
  let component: MeComponent;
  let fixture: ComponentFixture<MeComponent>;

  const mockAdminsService = {
    adminUids: computed(() => ['admin-uid'])
  };

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [MeComponent, NoopAnimationsModule],
      providers: [{ provide: AdminsService, useValue: mockAdminsService }]
    }).compileComponents();

    fixture = TestBed.createComponent(MeComponent);
    component = fixture.componentInstance;
  });

  it('mySearches returns only searches belonging to currentUser uid', () => {
    fixture.componentRef.setInput('currentUser', { uid: 'admin-uid' });
    fixture.componentRef.setInput('searches', [
      { userId: 'admin-uid', registration: 'AB12CDE', type: 'current', badge: '', searchedAt: null },
      { userId: 'other-uid', registration: 'XY99ZZZ', type: 'current', badge: '', searchedAt: null }
    ]);
    fixture.detectChanges();
    expect(component.mySearches().length).toBe(1);
    expect(component.mySearches()[0].registration).toBe('AB12CDE');
  });

  it('adminFeedback returns only feedback from admin uids', () => {
    fixture.componentRef.setInput('feedback', [
      { userId: 'admin-uid', registration: 'AB12CDE', valuation: 500, agreed: true, popularityMultiplier: 1, submittedAt: null },
      { userId: 'user-uid', registration: 'XY99ZZZ', valuation: 300, agreed: false, popularityMultiplier: 1, submittedAt: null }
    ]);
    fixture.detectChanges();
    expect(component.adminFeedback().length).toBe(1);
    expect(component.adminFeedback()[0].registration).toBe('AB12CDE');
  });

  it('adminMessages returns only messages from admin uids', () => {
    fixture.componentRef.setInput('plateMessages', [
      { userId: 'admin-uid', registration: 'AB12CDE', valuation: 500, plateMeaning: 'test', message: 'hello', submittedAt: null },
      { userId: 'user-uid', registration: 'XY99ZZZ', valuation: 300, plateMeaning: '', message: 'world', submittedAt: null }
    ]);
    fixture.detectChanges();
    expect(component.adminMessages().length).toBe(1);
    expect(component.adminMessages()[0].registration).toBe('AB12CDE');
  });
});
