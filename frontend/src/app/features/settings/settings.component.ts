import { Component, inject, signal, OnInit } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ApiService } from '../../core/services/api.service';
import { AuthService } from '../../core/services/auth.service';

@Component({
  selector: 'app-settings',
  standalone: true,
  imports: [FormsModule],
  template: `
    <div class="page">
      <h1 class="page-title">Settings</h1>
      <p class="page-subtitle">Manage your account</p>

      <div class="card">
        <form (ngSubmit)="save()">
          <div class="form-group">
            <label class="form-label">Name</label>
            <input class="form-input" [(ngModel)]="name" name="name" />
          </div>
          <div class="form-group">
            <label class="form-label">Email</label>
            <input class="form-input" [value]="auth.user()?.email" disabled />
          </div>
          <div class="form-group">
            <label class="form-label">Timezone</label>
            <select class="form-input" [(ngModel)]="timezone" name="timezone">
              <option value="UTC">UTC</option>
              <option value="America/New_York">Eastern Time</option>
              <option value="America/Chicago">Central Time</option>
              <option value="America/Los_Angeles">Pacific Time</option>
              <option value="Europe/London">London</option>
              <option value="Europe/Paris">Paris</option>
            </select>
          </div>
          @if (saved()) { <p class="success">Settings saved!</p> }
          @if (error()) { <p class="error">{{ error() }}</p> }
          <button class="btn-primary" type="submit" [disabled]="saving()">
            {{ saving() ? 'Saving...' : 'Save' }}
          </button>
        </form>
      </div>
    </div>
  `,
  styles: [`
    .page-title { font-size: 24px; font-weight: 700; }
    .page-subtitle { color: var(--text-secondary); margin: 4px 0 32px; }
    .form-group { margin-bottom: 20px; }
    .success { color: var(--success); margin-bottom: 12px; }
    .error { color: var(--danger); margin-bottom: 12px; }
  `],
})
export class SettingsComponent implements OnInit {
  private api = inject(ApiService);
  auth = inject(AuthService);
  name = '';
  timezone = 'UTC';
  saved = signal(false);
  error = signal('');
  saving = signal(false);

  ngOnInit() {
    this.api.get<{ name: string; timezone: string }>('/users/me').then((u) => {
      this.name = u.name;
      this.timezone = u.timezone;
    }).catch(() => {});
  }

  async save() {
    this.saving.set(true);
    this.error.set('');
    this.saved.set(false);
    try {
      await this.api.patch('/users/me', { name: this.name, timezone: this.timezone });
      this.saved.set(true);
      setTimeout(() => this.saved.set(false), 3000);
    } catch (e: unknown) {
      this.error.set(e instanceof Error ? e.message : 'Failed to save settings');
    } finally {
      this.saving.set(false);
    }
  }
}
