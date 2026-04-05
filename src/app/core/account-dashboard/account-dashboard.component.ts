import { Component, OnDestroy, OnInit, effect, inject, signal } from '@angular/core';
import { CommonModule, DatePipe, UpperCasePipe } from '@angular/common';
import { MatButtonModule } from '@angular/material/button';
import { MatTabsModule } from '@angular/material/tabs';
import { MatDialog, MatDialogModule } from '@angular/material/dialog';
import { Router, RouterModule } from '@angular/router';
import { AuthService } from '../../services/auth.service';
import { ReplyToEnquiryDialogComponent } from '../../shared/reply-to-enquiry-dialog/reply-to-enquiry-dialog.component';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { combineLatest, map, of, Subscription, switchMap } from 'rxjs';
import { PlateListingService } from '../../services/plate-listing.service';
import { PlateListing } from '../../models/plate-listing.model';
import { toObservable } from '@angular/core/rxjs-interop';
import { UserAccountDetailsComponent } from '../user-account-details/user-account-details.component';
import { ValuationService } from '../../services/valuation.service';
import { NumberPlateType, RegValuation } from '../../models/reg.model';
import { AccountDashboardValuationComponent } from '../account-dashboard-valuation/account-dashboard-valuation.component';
import { NumberPlateFormService } from '../../services/number-plate-form.service';
import { AdminComponent } from '../admin/admin.component';
import { AdminService, AutoValuation, PlateSearch, PlateValuationMessage, UserProfile, ValuationFeedback } from '../../services/admin.service';
import { AdminsService } from '../../services/admins.service';
import { MeComponent } from '../me/me.component';
import { SellerEnquiryService, SellerEnquiry } from '../../services/seller-enquiry.service';

@Component({
  selector: 'app-account-dashboard',
  standalone: true,
  imports: [
    CommonModule,
    DatePipe,
    UpperCasePipe,
    MatButtonModule,
    MatTabsModule,
    MatDialogModule,
    RouterModule,
    ReactiveFormsModule,
    MatFormFieldModule,
    MatInputModule,
    UserAccountDetailsComponent,
    AccountDashboardValuationComponent,
    AdminComponent,
    MeComponent
  ],
  templateUrl: './account-dashboard.component.html',
  styleUrl: './account-dashboard.component.scss'
})
export class AccountDashboardComponent implements OnInit, OnDestroy {

  currentUser$ = signal({});
  subs = new Subscription();

  private valuationService = inject(ValuationService);
  private adminService = inject(AdminService);
  private adminsService = inject(AdminsService);
  private numberPlateFormService = inject(NumberPlateFormService);
  private sellerEnquiryService = inject(SellerEnquiryService);

  valuations$ = signal<RegValuation[]>([]);
  plateSearches$ = signal<PlateSearch[]>([]);
  autoValuations$ = signal<AutoValuation[]>([]);
  users$ = signal<UserProfile[]>([]);
  feedback$ = signal<ValuationFeedback[]>([]);
  plateMessages$ = signal<PlateValuationMessage[]>([]);
  sellerEnquiries$ = signal<SellerEnquiry[]>([]);
  myListings$ = signal<PlateListing[]>([]);
  listingForms = new Map<string, FormGroup>();
  savingListingId = signal<string | null>(null);
  saveError = signal(new Map<string, string>());

  private plateListingService = inject(PlateListingService);
  private fb = inject(FormBuilder);

  private adminUids$ = toObservable(this.adminsService.adminUids);

  private hasLoadedUsers = false;

  constructor(
    private router: Router,
    private authService: AuthService,
    private dialog: MatDialog
  ) {
    effect(() => {
      const uid = (this.currentUser$() as any)?.uid;
      if (uid && this.adminsService.isAdmin(uid) && !this.hasLoadedUsers) {
        this.hasLoadedUsers = true;
        this.subs.add(
          this.adminService.getAuthUsers().subscribe((users) => this.users$.set(users))
        );
      }
    });
  }

  ngOnInit() {
    this.numberPlateFormService.triggerReset();

    this.subs.add(
      this.authService.currentUser$
        .pipe(map((user: any) => this.currentUser$.set(user)))
        .subscribe()
    );

    this.subs.add(
      this.valuationService
        .getValuations()
        .pipe(map((valuations: RegValuation[]) => this.valuations$.set([...valuations].reverse())))
        .subscribe()
    );

    this.subs.add(
      combineLatest([this.authService.currentUser$, this.adminUids$]).pipe(
        switchMap(([user, adminUids]) => adminUids.includes((user as any)?.uid)
          ? this.adminService.getPlateSearches()
          : of([] as PlateSearch[]))
      ).subscribe((searches) => this.plateSearches$.set(searches))
    );

    this.subs.add(
      combineLatest([this.authService.currentUser$, this.adminUids$]).pipe(
        switchMap(([user, adminUids]) => adminUids.includes((user as any)?.uid)
          ? this.adminService.getAutoValuations()
          : of([] as AutoValuation[]))
      ).subscribe((valuations) => this.autoValuations$.set(valuations))
    );

    this.subs.add(
      combineLatest([this.authService.currentUser$, this.adminUids$]).pipe(
        switchMap(([user, adminUids]) => adminUids.includes((user as any)?.uid)
          ? this.adminService.getFeedback()
          : of([] as ValuationFeedback[]))
      ).subscribe((feedback) => this.feedback$.set(feedback))
    );

    this.subs.add(
      combineLatest([this.authService.currentUser$, this.adminUids$]).pipe(
        switchMap(([user, adminUids]) => adminUids.includes((user as any)?.uid)
          ? this.adminService.getPlateValuationMessages()
          : of([] as PlateValuationMessage[]))
      ).subscribe((messages) => this.plateMessages$.set(messages))
    );

    this.subs.add(
      combineLatest([
        this.authService.currentUser$,
        this.adminUids$
      ]).pipe(
        switchMap(([user, adminUids]) => {
          const uid = (user as any)?.uid;
          const email = (user as any)?.email;
          if (!email) return of([] as SellerEnquiry[]);
          const queryEmail = uid && adminUids.includes(uid)
            ? 'guv.mr.valuations+apnaplates@gmail.com'
            : email;
          return this.sellerEnquiryService.getEnquiriesForSeller(queryEmail);
        })
      ).subscribe(enquiries => this.sellerEnquiries$.set(enquiries))
    );

    this.subs.add(
      this.authService.currentUser$.pipe(
        switchMap(user => {
          const uid = (user as any)?.uid;
          if (!uid) return of([] as PlateListing[]);
          return this.plateListingService.getMyListings(uid);
        })
      ).subscribe(listings => {
        this.myListings$.set(listings);
        // Prune forms for listings that no longer exist
        const currentIds = new Set(listings.map(l => String(l.id)));
        for (const key of this.listingForms.keys()) {
          if (!currentIds.has(key)) {
            this.listingForms.delete(key);
          }
        }
        listings.forEach(l => {
          const id = String(l.id);
          if (!this.listingForms.has(id)) {
            this.listingForms.set(id, this.fb.group({
              askingPrice: [l.askingPrice, [Validators.required, Validators.min(1)]],
              meanings: [l.meanings ?? ''],
            }));
          }
        });
      })
    );
  }

  get currentValuations(): RegValuation[] {
    return this.valuations$().filter(v => v.type === NumberPlateType.Current);
  }

  get prefixValuations(): RegValuation[] {
    return this.valuations$().filter(v => v.type === NumberPlateType.Prefix);
  }

  get suffixValuations(): RegValuation[] {
    return this.valuations$().filter(v => v.type === NumberPlateType.Suffix);
  }

  get datelessValuations(): RegValuation[] {
    return this.valuations$().filter(v => v.type === NumberPlateType.Dateless);
  }

  get isAdmin(): boolean {
    return this.adminsService.isAdmin((this.currentUser$() as any)?.uid);
  }

  async signOut(): Promise<void> {
    await this.authService.logout();
    await this.router.navigateByUrl('/login');
  }

  onReply(enquiry: SellerEnquiry): void {
    this.dialog.open(ReplyToEnquiryDialogComponent, { width: '520px', data: enquiry });
  }

  getListingForm(listing: PlateListing): FormGroup {
    return this.listingForms.get(String(listing.id))!;
  }

  async saveListing(listing: PlateListing): Promise<void> {
    const form = this.getListingForm(listing);
    if (!form || form.invalid) return;
    const id = String(listing.id);
    this.savingListingId.set(id);
    const errors = new Map(this.saveError());
    errors.delete(id);
    this.saveError.set(errors);
    try {
      await this.plateListingService.updateListing(id, {
        askingPrice: String(form.value.askingPrice),
        meanings: form.value.meanings ?? '',
      });
      form.markAsPristine();
    } catch {
      const errs = new Map(this.saveError());
      errs.set(id, 'Failed to save. Please try again.');
      this.saveError.set(errs);
    } finally {
      this.savingListingId.set(null);
    }
  }

  ngOnDestroy(): void {
    this.subs.unsubscribe();
  }
}
