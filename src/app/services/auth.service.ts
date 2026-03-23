import { inject, Injectable } from '@angular/core';
import {
  Auth,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signOut,
  user,
  sendPasswordResetEmail
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

  async saveUserProfile(uid: string, email: string, source: 'manual' | 'auto', extra?: { firstName?: string; lastName?: string; city?: string; plateMeaning?: string }) {
    const ref = collection(this.firestore, 'users');
    return addDoc(ref, {
      uid,
      email,
      source,
      registeredAt: new Date(),
      ...extra
    });
  }

  async login(email: string, password: string) {
    return await signInWithEmailAndPassword(this.auth, email, password);
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
