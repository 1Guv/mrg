import {Component, HostListener} from '@angular/core';
import { RouterOutlet } from '@angular/router';
import {HeaderMenuComponent} from "./core/header-menu/header-menu.component";
import {MatSidenavContainer, MatSidenavModule} from "@angular/material/sidenav";
import {NgStyle} from "@angular/common";
import {MatButtonModule} from "@angular/material/button";
import {MatIconModule} from "@angular/material/icon";
import {SideMenuComponent} from "./core/side-menu/side-menu.component";

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [RouterOutlet, HeaderMenuComponent, MatSidenavContainer, NgStyle, MatSidenavModule, MatButtonModule, MatIconModule, SideMenuComponent],
  templateUrl: './app.component.html',
  styleUrl: './app.component.scss'
})
export class AppComponent {
  title = 'mrg-app-v1';
  width80Percent: string = ''
  opened: boolean = false;

  constructor() {
    this.setWidth();
  }

  @HostListener('window:resize', ['$event'])
  onResize(event: Event) {
    this.setWidth();
  }

  setWidth() {
    this.width80Percent = (window.innerWidth * 0.8).toString() + 'px';
    console.log('80% width:', this.width80Percent);
  }

}
