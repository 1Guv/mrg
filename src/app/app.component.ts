import {Component, HostListener, inject} from '@angular/core';
import { RouterOutlet } from '@angular/router';
import {HeaderMenuComponent} from "./core/header-menu/header-menu.component";
import {MatSidenavContainer, MatSidenavModule} from "@angular/material/sidenav";
import {NgStyle} from "@angular/common";
import {MatButtonModule} from "@angular/material/button";
import {MatIconModule} from "@angular/material/icon";
import {SideMenuComponent} from "./core/side-menu/side-menu.component";
import {VoucherBannerComponent} from "./shared/voucher-banner/voucher-banner.component";
import {EmailLinkSignInService} from "./services/email-link-sign-in.service";
@Component({
    selector: 'app-root',
    imports: [RouterOutlet, HeaderMenuComponent, MatSidenavContainer, NgStyle, MatSidenavModule, MatButtonModule, MatIconModule, SideMenuComponent, VoucherBannerComponent],
    templateUrl: './app.component.html',
    styleUrl: './app.component.scss'
})
export class AppComponent {
  title = 'mrg-app-v1';
  width80Percent: string = ''
  opened: boolean = false;
  // Created at startup so a sign-in link is redeemed on whichever page it opens.
  private emailLink = inject(EmailLinkSignInService);

  constructor() {
    this.setWidth();
  }

  @HostListener('window:resize', ['$event'])
  onResize(event: Event) {
    this.setWidth();
  }

  setWidth() {
    this.width80Percent = (window.innerWidth * 0.8).toString() + 'px';
  }

}
