# Google Login — Design Spec

**Date:** 2026-07-01  
**Scope:** Login page only. Popup flow. No changes to register page or auth prompt dialogs.

---

## What we're building

A "Sign in with Google" button on the login page that lets users authenticate via Google OAuth using Firebase's existing `@angular/fire/auth` integration. New Google users get a Firestore profile saved automatically; returning users skip that step.

---

## Architecture

### `AuthService` (`auth.service.ts`)

Add one new method:

```ts
async loginWithGoogle(): Promise<UserCredential>
```

- Uses `signInWithPopup(this.auth, new GoogleAuthProvider())`
- Calls `getAdditionalUserInfo(result).isNewUser` — saves a Firestore profile via the existing `saveUserProfile()` only for first-time sign-ins
- Profile saved with `source: 'google'`, using `result.user.displayName` split into first/last name where available

### `LoginComponent` (`login.component.ts`)

Add:

```ts
async onGoogleLogin(): Promise<void>
```

- Calls `this.authService.loginWithGoogle()`
- On success: navigates to `/account-dashboard` (same as email login)
- On error: sets `errorMessage` and displays it (same pattern as `handleError`)

### `login.component.html`

Below the existing Login/Register buttons, add:

- An "or" text divider
- A `mat-stroked-button` labelled "Sign in with Google" with the Google SVG logo inline
- Calls `(click)="onGoogleLogin()"`

---

## Data flow

1. User clicks "Sign in with Google" on `/login`
2. Google OAuth popup opens
3. Firebase resolves with `UserCredential`
4. If `isNewUser`: `saveUserProfile()` writes to `users` collection with `source: 'google'`
5. `router.navigate(['/account-dashboard'])`

---

## Error handling

- Popup closed by user (`auth/popup-closed-by-user`): silently ignore — no error shown
- Any other Firebase error: display via existing `errorMessage` binding

---

## What's not in scope

- Google button on register page or auth prompt dialogs
- Account linking (email/password account + same Google email) — Firebase handles this at the SDK level by throwing `auth/account-exists-with-different-credential`; we surface it as a generic error for now
- Redirect flow (popup only)
