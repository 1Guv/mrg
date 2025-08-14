import { Injectable } from '@angular/core';
import { AuthService } from './auth.service';
import { inject } from '@angular/core';

@Injectable({
  providedIn: 'root'
})
export class AdminService {
  private authService = inject(AuthService);

  constructor() { }
}
