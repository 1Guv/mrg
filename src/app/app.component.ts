import { Component } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import {HeaderMenuComponent} from "./core/header-menu/header-menu.component";
import {MatSidenavContainer, MatSidenavModule} from "@angular/material/sidenav";
import {NgStyle} from "@angular/common";
import {MatButtonModule} from "@angular/material/button";
import {MatIconModule} from "@angular/material/icon";

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [RouterOutlet, HeaderMenuComponent, MatSidenavContainer, NgStyle, MatSidenavModule, MatButtonModule, MatIconModule],
  templateUrl: './app.component.html',
  styleUrl: './app.component.scss'
})
export class AppComponent {
  title = 'mrg-app-v1';
  currentWidthPx: string = '';
  opened: boolean = false;
}
