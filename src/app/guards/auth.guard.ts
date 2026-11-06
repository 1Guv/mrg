import { Signal, inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import {AuthService} from "../services/auth.service";
import {map} from "rxjs";

export const authGuard: CanActivateFn = (route, state) => {

  const router = inject(Router);
  const authService = inject(AuthService);

  return authService.currentUser$.pipe(
    map((user) => {
      if (user) return true;
      // Back to the same page after login, e.g. Messages from an enquiry email
      router.navigate(['/login'], { queryParams: { returnUrl: state.url } });
      return false;
    })
  );
};
