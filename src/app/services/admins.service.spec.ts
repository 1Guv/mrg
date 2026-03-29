import { TestBed } from '@angular/core/testing';
import { AdminsService, ADMINS_DATA, Admin } from './admins.service';
import { Firestore } from '@angular/fire/firestore';
import { of } from 'rxjs';

describe('AdminsService', () => {
  let service: AdminsService;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        AdminsService,
        { provide: Firestore, useValue: {} },
        {
          provide: ADMINS_DATA,
          useValue: of([{ uid: 'admin-uid-1', email: 'admin@test.com' } as Admin])
        }
      ]
    });
    service = TestBed.inject(AdminsService);
  });

  it('isAdmin returns false for undefined', () => {
    expect(service.isAdmin(undefined)).toBeFalse();
  });

  it('isAdmin returns false for unknown uid', () => {
    expect(service.isAdmin('unknown-uid')).toBeFalse();
  });

  it('isAdmin returns true for a uid in the admins collection', () => {
    expect(service.isAdmin('admin-uid-1')).toBeTrue();
  });
});
