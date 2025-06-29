import { JsonPipe } from '@angular/common';
import {Component, OnDestroy, OnInit, Signal, signal} from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import {Router, RouterModule} from '@angular/router';
import { AuthService } from '../../services/auth.service';
import {map, Subscription} from "rxjs";

@Component({
  selector: 'app-account-dashboard',
  standalone: true,
  imports: [
    JsonPipe,
    MatButtonModule,
    RouterModule
  ],
  templateUrl: './account-dashboard.component.html',
  styleUrl: './account-dashboard.component.scss'
})
export class AccountDashboardComponent implements OnInit, OnDestroy {

  currentUser$ = signal({});
  subs= new Subscription();

  constructor(
    private router: Router,
    private authService: AuthService
  ) {
  }

  ngOnInit() {
    this.subs.add(
      this.authService.currentUser$
        .pipe(
          map((user: any) => {
            this.currentUser$.set(user);
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
