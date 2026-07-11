import { Routes } from '@angular/router';
import { LoginComponent } from './core/login/login.component';
import { MainSectionComponent } from './core/main-section/main-section.component';
import { RegisterComponent } from './core/register/register.component';
import { authGuard } from './guards/auth.guard';
import { AccountDashboardComponent } from './core/account-dashboard/account-dashboard.component';
import { ForgotPasswordComponent } from './core/forgot-password/forgot-password.component';
import { PlatesForSaleComponent } from './core/plates-for-sale/plates-for-sale.component';
import { ListPlateComponent } from './core/list-plate/list-plate.component';
import { ListPlateSuccessComponent } from './core/list-plate-success/list-plate-success.component';
import { NewsListingComponent } from './core/news-listing/news-listing.component';
import { NewsArticleComponent } from './core/news-article/news-article.component';
import { UnsubscribedComponent } from './core/unsubscribed/unsubscribed.component';
import { PrivacyPolicyComponent } from './core/privacy-policy/privacy-policy.component';
import { PlateDetailComponent } from './core/plate-detail/plate-detail.component';
import { AboutComponent } from './core/about/about.component';
import { ContactComponent } from './core/contact/contact.component';

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
    { path: 'plates-for-sale', component: PlatesForSaleComponent },
    { path: 'plates-for-sale/:plate', component: PlateDetailComponent },
    { path: 'list-plate', component: ListPlateComponent },
    { path: 'list-plate/success', component: ListPlateSuccessComponent },
    { path: 'news', component: NewsListingComponent },
    { path: 'news/:slug', component: NewsArticleComponent },
    { path: 'unsubscribed', component: UnsubscribedComponent },
    { path: 'privacy-policy', component: PrivacyPolicyComponent },
    { path: 'about', component: AboutComponent },
    { path: 'contact', component: ContactComponent },
];
