import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { Observable, map, of, shareReplay } from 'rxjs';
import { Content } from '../models/content';

@Injectable({
  providedIn: 'root'
})
export class ContentService {
  content$: Observable<Content>;

  constructor(
    private http: HttpClient
  ) {
    this.content$ = this.http.get<Content>('./assets/data/content.json').pipe(shareReplay(1));
  }

}
