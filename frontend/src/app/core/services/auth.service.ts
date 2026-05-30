import { Injectable, signal, computed } from '@angular/core';
import { getApiBaseUrl } from '../config/api.config';

export interface User {
  id: string;
  email: string;
  name: string;
  role: string;
  emailVerified?: boolean;
}

export interface AuthResponse {
  accessToken: string;
  refreshToken: string;
  user: User;
}

@Injectable({ providedIn: 'root' })
export class AuthService {
  private readonly userSignal = signal<User | null>(this.loadUser());
  readonly user = this.userSignal.asReadonly();
  readonly isAuthenticated = computed(() => !!this.userSignal());
  readonly isAdmin = computed(() => this.userSignal()?.role === 'ADMIN');

  private get apiUrl() {
    return getApiBaseUrl();
  }

  private loadUser(): User | null {
    const stored = localStorage.getItem('hirely_user');
    return stored ? JSON.parse(stored) : null;
  }

  private saveTokens(access: string, refresh: string, user: User) {
    localStorage.setItem('hirely_access', access);
    localStorage.setItem('hirely_refresh', refresh);
    localStorage.setItem('hirely_user', JSON.stringify(user));
    this.userSignal.set(user);
  }

  getAccessToken(): string | null {
    return localStorage.getItem('hirely_access');
  }

  async register(email: string, password: string, name: string) {
    const res = await fetch(`${this.apiUrl}/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password, name }),
    });
    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.message || 'Registration failed');
    }
    return res.json();
  }

  async login(email: string, password: string) {
    const res = await fetch(`${this.apiUrl}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password }),
    });
    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.message || 'Login failed');
    }
    const data: AuthResponse = await res.json();
    this.saveTokens(data.accessToken, data.refreshToken, data.user);
    return data;
  }

  logout() {
    const refresh = localStorage.getItem('hirely_refresh');
    if (refresh) {
      fetch(`${this.apiUrl}/auth/logout`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${this.getAccessToken()}`,
        },
        body: JSON.stringify({ refreshToken: refresh }),
      }).catch(() => {});
    }
    localStorage.removeItem('hirely_access');
    localStorage.removeItem('hirely_refresh');
    localStorage.removeItem('hirely_user');
    this.userSignal.set(null);
  }

  async forgotPassword(email: string) {
    const res = await fetch(`${this.apiUrl}/auth/forgot-password`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email }),
    });
    return res.json();
  }

  async resetPassword(token: string, password: string) {
    const res = await fetch(`${this.apiUrl}/auth/reset-password`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token, password }),
    });
    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.message || 'Reset failed');
    }
    return res.json();
  }

  async verifyEmail(token: string) {
    const res = await fetch(`${this.apiUrl}/auth/verify-email`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token }),
    });
    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.message || 'Verification failed');
    }
    return res.json();
  }
}
