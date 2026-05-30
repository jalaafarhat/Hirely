import { Component, inject, signal } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { AuthService } from '../../../core/services/auth.service';

@Component({
  selector: 'app-login',
  standalone: true,
  imports: [FormsModule, RouterLink],
  template: `
    <div class="auth-page">
      <div class="auth-card card">
        <div class="auth-header">
          <h1 class="logo">Hirely</h1>
          <p class="subtitle">Sign in to your account</p>
        </div>
        @if (error()) {
          <div class="error-msg">{{ error() }}</div>
        }
        <form (ngSubmit)="onSubmit()">
          <div class="form-group">
            <label class="form-label">Email</label>
            <input class="form-input" type="email" [(ngModel)]="email" name="email" required />
          </div>
          <div class="form-group">
            <label class="form-label">Password</label>
            <input class="form-input" type="password" [(ngModel)]="password" name="password" required />
          </div>
          <button class="btn-primary w-full" type="submit" [disabled]="loading()">
            {{ loading() ? 'Signing in...' : 'Sign in' }}
          </button>
        </form>
        <div class="auth-links">
          <a routerLink="/forgot-password">Forgot password?</a>
          <a routerLink="/register">Create account</a>
        </div>
      </div>
    </div>
  `,
  styles: [`
    .auth-page { min-height: 100vh; display: flex; align-items: center; justify-content: center; background: var(--bg-secondary); padding: 20px; }
    .auth-card { width: 100%; max-width: 400px; }
    .auth-header { text-align: center; margin-bottom: 32px; }
    .logo { font-size: 28px; font-weight: 700; color: var(--accent); }
    .subtitle { color: var(--text-secondary); margin-top: 8px; }
    .form-group { margin-bottom: 16px; }
    .w-full { width: 100%; margin-top: 8px; }
    .error-msg { background: rgba(220,38,38,0.1); color: var(--danger); padding: 10px; border-radius: 8px; margin-bottom: 16px; font-size: 14px; }
    .auth-links { display: flex; justify-content: space-between; margin-top: 20px; font-size: 14px; }
  `],
})
export class LoginComponent {
  private auth = inject(AuthService);
  private router = inject(Router);

  email = '';
  password = '';
  loading = signal(false);
  error = signal('');

  async onSubmit() {
    this.loading.set(true);
    this.error.set('');
    try {
      await this.auth.login(this.email, this.password);
      this.router.navigate(['/dashboard']);
    } catch (e: unknown) {
      this.error.set(e instanceof Error ? e.message : 'Login failed');
    } finally {
      this.loading.set(false);
    }
  }
}
