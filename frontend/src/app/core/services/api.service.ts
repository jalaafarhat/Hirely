import { Injectable } from '@angular/core';
import { AuthService } from './auth.service';
import { getApiBaseUrl } from '../config/api.config';

@Injectable({ providedIn: 'root' })
export class ApiService {
  private readonly baseUrl = getApiBaseUrl();

  constructor(private auth: AuthService) {}

  private async request<T>(
    path: string,
    options: RequestInit = {},
  ): Promise<T> {
    const token = this.auth.getAccessToken();
    const headers: Record<string, string> = {
      ...(options.headers as Record<string, string>),
    };

    if (token && !headers['Authorization']) {
      headers['Authorization'] = `Bearer ${token}`;
    }

    if (!(options.body instanceof FormData)) {
      headers['Content-Type'] = headers['Content-Type'] || 'application/json';
    }

    let res: Response;
    try {
      res = await fetch(`${this.baseUrl}${path}`, { ...options, headers });
    } catch {
      throw new Error(
        `Cannot reach the server at ${this.baseUrl}. Check that the backend is running.`,
      );
    }

    if (res.status === 401 && token) {
      const refreshed = await this.refreshToken();
      if (refreshed) {
        headers['Authorization'] = `Bearer ${this.auth.getAccessToken()}`;
        try {
          res = await fetch(`${this.baseUrl}${path}`, { ...options, headers });
        } catch {
          throw new Error(
            `Cannot reach the server at ${this.baseUrl}. Check that the backend is running.`,
          );
        }
      }
    }

    if (!res.ok) {
      const err = await res.json().catch(() => ({ message: 'Request failed' }));
      throw new Error(err.message || `HTTP ${res.status}`);
    }

    if (res.status === 204) return {} as T;
    return res.json();
  }

  private async refreshToken(): Promise<boolean> {
    const refresh = localStorage.getItem('hirely_refresh');
    if (!refresh) return false;

    try {
      const res = await fetch(`${this.baseUrl}/auth/refresh`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ refreshToken: refresh }),
      });
      if (!res.ok) return false;
      const data = await res.json();
      localStorage.setItem('hirely_access', data.accessToken);
      localStorage.setItem('hirely_refresh', data.refreshToken);
      return true;
    } catch {
      return false;
    }
  }

  get<T>(path: string) {
    return this.request<T>(path);
  }

  post<T>(path: string, body?: unknown) {
    return this.request<T>(path, {
      method: 'POST',
      body: body instanceof FormData ? body : JSON.stringify(body),
    });
  }

  patch<T>(path: string, body: unknown) {
    return this.request<T>(path, {
      method: 'PATCH',
      body: JSON.stringify(body),
    });
  }

  put<T>(path: string, body: unknown) {
    return this.request<T>(path, {
      method: 'PUT',
      body: JSON.stringify(body),
    });
  }

  delete<T>(path: string) {
    return this.request<T>(path, { method: 'DELETE' });
  }
}
