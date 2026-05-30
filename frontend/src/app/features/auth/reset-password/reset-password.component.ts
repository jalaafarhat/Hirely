import { Component, inject, signal } from '@angular/core';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { AuthService } from '../../../core/services/auth.service';

@Component({
  selector: 'app-reset-password',
  standalone: true,
  imports: [FormsModule, RouterLink],
  template: `
    <div class="auth-page">
      <div class="auth-card card">
        <h1 class="logo">Hirely</h1>
        <p class="subtitle">Set a new password</p>
        @if (error()) { <p class="error">{{ error() }}</p> }
        @if (success()) {
          <p class="success">Password updated! You can now sign in.</p>
          <a routerLink="/login" class="btn-primary">Sign in</a>
        } @else {
          <form (ngSubmit)="onSubmit()">
            <div class="form-group">
              <label class="form-label">New Password</label>
              <input class="form-input" type="password" [(ngModel)]="password" name="password" required minlength="8" />
            </div>
            <button class="btn-primary w-full" type="submit" [disabled]="loading()">
              {{ loading() ? 'Updating...' : 'Reset password' }}
            </button>
          </form>
        }
      </div>
    </div>
  `,
  styles: [`
    .auth-page { min-height: 100vh; display: flex; align-items: center; justify-content: center; background: var(--bg-secondary); padding: 20px; }
    .auth-card { width: 100%; max-width: 400px; }
    .logo { font-size: 28px; font-weight: 700; color: var(--accent); text-align: center; }
    .subtitle { color: var(--text-secondary); text-align: center; margin: 8px 0 24px; }
    .form-group { margin-bottom: 16px; }
    .w-full { width: 100%; }
    .success { color: var(--success); text-align: center; margin-bottom: 16px; }
    .error { color: var(--danger); margin-bottom: 16px; }
  `],
})
export class ResetPasswordComponent {
  private auth = inject(AuthService);
  private route = inject(ActivatedRoute);
  private router = inject(Router);
  password = '';
  loading = signal(false);
  success = signal(false);
  error = signal('');

  async onSubmit() {
    const token = this.route.snapshot.queryParamMap.get('token');
    if (!token) {
      this.error.set('Invalid reset link');
      return;
    }
    this.loading.set(true);
    this.error.set('');
    try {
      await this.auth.resetPassword(token, this.password);
      this.success.set(true);
    } catch (e: unknown) {
      this.error.set(e instanceof Error ? e.message : 'Reset failed');
    } finally {
      this.loading.set(false);
    }
  }
}
