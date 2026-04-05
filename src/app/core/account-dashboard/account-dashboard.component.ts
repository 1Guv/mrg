import { Component, OnDestroy, OnInit, effect, inject, signal } from '@angular/core';
import { CommonModule, DatePipe, UpperCasePipe } from '@angular/common';
import { MatButtonModule } from '@angular/material/button';
import { MatTabsModule } from '@angular/material/tabs';
import { Router, RouterModule } from '@angular/router';
import { AuthService } from '../../services/auth.service';
import { map, of, Subscription, switchMap } from 'rxjs';
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
    RouterModule,
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

  private hasLoadedUsers = false;

  constructor(
    private router: Router,
    private authService: AuthService
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
      this.authService.currentUser$.pipe(
        switchMap(user => this.adminsService.isAdmin((user as any)?.uid)
          ? this.adminService.getPlateSearches()
          : of([] as PlateSearch[]))
      ).subscribe((searches) => this.plateSearches$.set(searches))
    );

    this.subs.add(
      this.authService.currentUser$.pipe(
        switchMap(user => this.adminsService.isAdmin((user as any)?.uid)
          ? this.adminService.getAutoValuations()
          : of([] as AutoValuation[]))
      ).subscribe((valuations) => this.autoValuations$.set(valuations))
    );

    this.subs.add(
      this.authService.currentUser$.pipe(
        switchMap(user => this.adminsService.isAdmin((user as any)?.uid)
          ? this.adminService.getFeedback()
          : of([] as ValuationFeedback[]))
      ).subscribe((feedback) => this.feedback$.set(feedback))
    );

    this.subs.add(
      this.authService.currentUser$.pipe(
        switchMap(user => this.adminsService.isAdmin((user as any)?.uid)
          ? this.adminService.getPlateValuationMessages()
          : of([] as PlateValuationMessage[]))
      ).subscribe((messages) => this.plateMessages$.set(messages))
    );

    this.subs.add(
      this.authService.currentUser$.pipe(
        switchMap(user => (user as any)?.email
          ? this.sellerEnquiryService.getEnquiriesForSeller((user as any).email)
          : of([])
        )
      ).subscribe(enquiries => this.sellerEnquiries$.set(enquiries))
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

  ngOnDestroy(): void {
    this.subs.unsubscribe();
  }
}
