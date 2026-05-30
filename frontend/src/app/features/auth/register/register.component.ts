import { Component, inject, signal } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { AuthService } from '../../../core/services/auth.service';

@Component({
  selector: 'app-register',
  standalone: true,
  imports: [FormsModule, RouterLink],
  template: `
    <div class="auth-page">
      <div class="auth-card card">
        <div class="auth-header">
          <h1 class="logo">Hirely</h1>
          <p class="subtitle">Create your account</p>
        </div>
        @if (error()) {
          <div class="error-msg">{{ error() }}</div>
        }
        @if (success()) {
          <div class="success-msg">{{ success() }}</div>
          @if (verifyLink()) {
            <div class="dev-verify">
              <p class="dev-label">Dev verification link:</p>
              <a [href]="verifyLink()!" class="verify-link">{{ verifyLink() }}</a>
            </div>
          }
        }
        <form (ngSubmit)="onSubmit()">
          <div class="form-group">
            <label class="form-label">Full Name</label>
            <input class="form-input" [(ngModel)]="name" name="name" required />
          </div>
          <div class="form-group">
            <label class="form-label">Email</label>
            <input class="form-input" type="email" [(ngModel)]="email" name="email" required />
          </div>
          <div class="form-group">
            <label class="form-label">Password</label>
            <input class="form-input" type="password" [(ngModel)]="password" name="password" required minlength="8" />
          </div>
          <button class="btn-primary w-full" type="submit" [disabled]="loading()">
            {{ loading() ? 'Creating...' : 'Create account' }}
          </button>
        </form>
        <div class="auth-links">
          <a routerLink="/login">Already have an account?</a>
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
    .success-msg { background: rgba(5,150,105,0.1); color: var(--success); padding: 10px; border-radius: 8px; margin-bottom: 16px; font-size: 14px; }
    .dev-verify { background: var(--bg-tertiary); padding: 12px; border-radius: 8px; margin-bottom: 16px; font-size: 13px; word-break: break-all; }
    .dev-label { color: var(--text-secondary); margin-bottom: 8px; }
    .verify-link { color: var(--accent); }
    .auth-links { text-align: center; margin-top: 20px; font-size: 14px; }
  `],
})
export class RegisterComponent {
  private auth = inject(AuthService);
  private router = inject(Router);

  name = '';
  email = '';
  password = '';
  loading = signal(false);
  error = signal('');
  success = signal('');
  verifyLink = signal('');

  async onSubmit() {
    this.loading.set(true);
    this.error.set('');
    this.verifyLink.set('');
    try {
      const res = await this.auth.register(this.email, this.password, this.name);
      this.success.set(res.message || 'Account created! Check your email to verify.');
      if (res.verifyLink) {
        this.verifyLink.set(res.verifyLink);
      } else {
        setTimeout(() => this.router.navigate(['/login']), 3000);
      }
    } catch (e: unknown) {
      this.error.set(e instanceof Error ? e.message : 'Registration failed');
    } finally {
      this.loading.set(false);
    }
  }
}
