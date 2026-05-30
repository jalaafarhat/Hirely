import { Component, inject, signal, OnInit } from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { AuthService } from '../../../core/services/auth.service';

@Component({
  selector: 'app-verify-email',
  standalone: true,
  imports: [RouterLink],
  template: `
    <div class="auth-page">
      <div class="auth-card card">
        <h1 class="logo">Hirely</h1>
        @if (loading()) {
          <p>Verifying your email...</p>
        } @else if (success()) {
          <p class="success">Email verified successfully!</p>
          <a routerLink="/login" class="btn-primary">Sign in</a>
        } @else {
          <p class="error">{{ error() }}</p>
          <a routerLink="/login">Back to login</a>
        }
      </div>
    </div>
  `,
  styles: [`
    .auth-page { min-height: 100vh; display: flex; align-items: center; justify-content: center; background: var(--bg-secondary); padding: 20px; }
    .auth-card { width: 100%; max-width: 400px; text-align: center; }
    .logo { font-size: 28px; font-weight: 700; color: var(--accent); margin-bottom: 24px; }
    .success { color: var(--success); margin-bottom: 16px; }
    .error { color: var(--danger); margin-bottom: 16px; }
  `],
})
export class VerifyEmailComponent implements OnInit {
  private auth = inject(AuthService);
  private route = inject(ActivatedRoute);
  loading = signal(true);
  success = signal(false);
  error = signal('');

  ngOnInit() {
    const token = this.route.snapshot.queryParamMap.get('token');
    if (!token) {
      this.error.set('Invalid verification link');
      this.loading.set(false);
      return;
    }
    this.auth
      .verifyEmail(token)
      .then(() => this.success.set(true))
      .catch((e: Error) => this.error.set(e.message))
      .finally(() => this.loading.set(false));
  }
}
