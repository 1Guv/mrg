import { Routes } from '@angular/router';
import { LoginComponent } from './core/login/login.component';
import { MainSectionComponent } from './core/main-section/main-section.component';
import { RegisterComponent } from './core/register/register.component';
import { authGuard } from './guards/auth.guard';
import { AccountDashboardComponent } from './core/account-dashboard/account-dashboard.component';
import { ForgotPasswordComponent } from './core/forgot-password/forgot-password.component';

export const routes: Routes = [
    { path: '', component: MainSectionComponent },
    { path: 'login', component: LoginComponent },
    { path: 'register', component: RegisterComponent },
    {
        path: 'account-dashboard',
        component: AccountDashboardComponent,
        canActivate: [authGuard]
    },
    { path: 'forgot-password', component: ForgotPasswordComponent },
];
