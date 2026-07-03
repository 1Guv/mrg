import { inject, Injectable } from '@angular/core';
import {
  Auth,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signOut,
  user,
  sendPasswordResetEmail,
  signInWithPopup,
  GoogleAuthProvider,
  FacebookAuthProvider,
  getAdditionalUserInfo,
  UserCredential,
} from '@angular/fire/auth';
import { Firestore, collection, addDoc } from '@angular/fire/firestore';

@Injectable({
  providedIn: 'root'
})
export class AuthService {
  currentUser$= user(this.auth);
  private firestore = inject(Firestore);

  constructor(private auth: Auth) {
  }

  async saveUserProfile(uid: string, email: string, source: 'manual' | 'auto' | 'google' | 'facebook', extra?: { firstName?: string; lastName?: string; city?: string; plateMeaning?: string }) {
    const ref = collection(this.firestore, 'users');
    return addDoc(ref, {
      uid,
      email,
      source,
      registeredAt: new Date(),
      ...extra
    });
  }

  async loginWithFacebook(): Promise<UserCredential> {
    const result = await signInWithPopup(this.auth, new FacebookAuthProvider());
    if (getAdditionalUserInfo(result)?.isNewUser) {
      const { displayName, email, uid } = result.user;
      const [firstName, ...rest] = (displayName ?? '').split(' ');
      await this.saveUserProfile(uid, email ?? '', 'facebook', {
        firstName,
        lastName: rest.join(' ') || undefined,
      });
    }
    return result;
  }

  async login(email: string, password: string) {
    return await signInWithEmailAndPassword(this.auth, email, password);
  }

  async loginWithGoogle(): Promise<UserCredential> {
    const result = await signInWithPopup(this.auth, new GoogleAuthProvider());
    if (getAdditionalUserInfo(result)?.isNewUser) {
      const { displayName, email, uid } = result.user;
      const [firstName, ...rest] = (displayName ?? '').split(' ');
      await this.saveUserProfile(uid, email ?? '', 'google', {
        firstName,
        lastName: rest.join(' ') || undefined,
      });
    }
    return result;
  }

  async register(email: string, password: string) {
    return await createUserWithEmailAndPassword(this.auth, email, password);
  }

  async logout() {
    return await signOut(this.auth);
  }

  async sendPasswordReset(email: string): Promise<void> {
    return sendPasswordResetEmail(this.auth, email);
  }
}
