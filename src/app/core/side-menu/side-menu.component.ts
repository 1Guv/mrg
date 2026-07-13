import { Component, EventEmitter, Output } from '@angular/core';
import {MatIcon} from "@angular/material/icon";
import {MatButton} from "@angular/material/button";
import {ContentService} from "../../services/content.service";
import {HeaderMenuOptions} from "../../models/content.model";
import {map, Observable} from "rxjs";
import {AsyncPipe} from "@angular/common";
import {RouterLink} from "@angular/router";

@Component({
    selector: 'app-side-menu',
    standalone: true,
    imports: [
        MatIcon,
        AsyncPipe,
        RouterLink
    ],
    templateUrl: './side-menu.component.html',
    styleUrl: './side-menu.component.scss'
})
export class SideMenuComponent {

  @Output() linkClicked = new EventEmitter<void>();

  menuOptions$: Observable<HeaderMenuOptions[]>

  constructor(
    private contentService: ContentService,
  ) {
    this.menuOptions$ = this.contentService.content$.pipe(map(content => content?.header?.menuOptions)) as Observable<any>
  }
}
