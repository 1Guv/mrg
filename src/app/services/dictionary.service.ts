import { inject, Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { catchError, map, Observable, of } from 'rxjs';

@Injectable({
  providedIn: 'root'
})
export class DictionaryService {
  private http = inject(HttpClient);

  isRealWord(word: string): Observable<boolean> {
    const url = `https://api.dictionaryapi.dev/api/v2/entries/en/${word.toLowerCase()}`;
    return this.http.get(url).pipe(
      map(() => true),
      catchError(() => of(false))
    );
  }
}
