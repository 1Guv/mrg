import { JsonPipe } from '@angular/common';
import {Component, OnDestroy, OnInit, Signal, signal} from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import {Router, RouterModule} from '@angular/router';
import { AuthService } from '../../services/auth.service';
import {map, Subscription} from "rxjs";
import { UserAccountDetailsComponent } from '../user-account-details/user-account-details.component';
import { ValuationService } from '../../services/valuation.service';
import { inject } from '@angular/core';
import { RegValuation } from '../../models/reg.model';
import { MatCardModule } from '@angular/material/card';
import { AccountDashboardValuationComponent } from '../account-dashboard-valuation/account-dashboard-valuation.component';
import { NumberPlateFormService } from '../../services/number-plate-form.service';

@Component({
  selector: 'app-account-dashboard',
  standalone: true,
  imports: [
    JsonPipe,
    MatButtonModule,
    RouterModule,
    UserAccountDetailsComponent,
    AccountDashboardValuationComponent
  ],
  templateUrl: './account-dashboard.component.html',
  styleUrl: './account-dashboard.component.scss'
})
export class AccountDashboardComponent implements OnInit, OnDestroy {

  currentUser$ = signal({});
  subs = new Subscription();
  
  private valuationService = inject(ValuationService);
  valuations$ = signal<RegValuation[]>([]);
  private numberPlateFormService = inject(NumberPlateFormService);

  constructor(
    private router: Router,
    private authService: AuthService
  ) {
  }

  ngOnInit() {
    this.numberPlateFormService.triggerReset();

    this.subs.add(
      this.authService.currentUser$
        .pipe(
          map((user: any) => {
            this.currentUser$.set(user);
          })
        )
        .subscribe()
    );

    this.subs.add(
      this.valuationService
        .getValuations()
        .pipe(
          map((valuations: RegValuation[]) => {
            this.valuations$.set(valuations);
          })
        )
        .subscribe()
    );
  }

  async signOut(): Promise<void> {
    await this.authService.logout();
    await this.router.navigateByUrl('/login');
  }

  ngOnDestroy(): void {
    this.subs.unsubscribe();
  }
}
