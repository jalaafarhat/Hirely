import { Component, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { AuthService } from '../../../core/services/auth.service';

@Component({
  selector: 'app-forgot-password',
  standalone: true,
  imports: [FormsModule, RouterLink],
  template: `
    <div class="auth-page">
      <div class="auth-card card">
        <h1 class="logo">Hirely</h1>
        <p class="subtitle">Reset your password</p>
        @if (message()) {
          <div class="success-msg">{{ message() }}</div>
        }
        <form (ngSubmit)="onSubmit()">
          <div class="form-group">
            <label class="form-label">Email</label>
            <input class="form-input" type="email" [(ngModel)]="email" name="email" required />
          </div>
          <button class="btn-primary w-full" type="submit">Send reset link</button>
        </form>
        <a routerLink="/login" class="back-link">Back to login</a>
      </div>
    </div>
  `,
  styles: [`
    .auth-page { min-height: 100vh; display: flex; align-items: center; justify-content: center; background: var(--bg-secondary); padding: 20px; }
    .auth-card { width: 100%; max-width: 400px; text-align: center; }
    .logo { font-size: 28px; font-weight: 700; color: var(--accent); margin-bottom: 8px; }
    .subtitle { color: var(--text-secondary); margin-bottom: 24px; }
    .form-group { margin-bottom: 16px; text-align: left; }
    .w-full { width: 100%; }
    .success-msg { background: rgba(5,150,105,0.1); color: var(--success); padding: 10px; border-radius: 8px; margin-bottom: 16px; font-size: 14px; }
    .back-link { display: block; margin-top: 20px; font-size: 14px; }
  `],
})
export class ForgotPasswordComponent {
  private auth = inject(AuthService);
  email = '';
  message = signal('');

  async onSubmit() {
    await this.auth.forgotPassword(this.email);
    this.message.set('If an account exists, a reset link has been sent.');
  }
}
