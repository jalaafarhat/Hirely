import { Component, inject, signal, OnInit } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ApiService } from '../../core/services/api.service';

interface PreferencesPayload {
  locationType: string;
  country?: string;
  city?: string;
  workModes: string[];
  jobTypes: string[];
  matchThreshold: number;
  agentEnabled: boolean;
  digestHours: number[];
  emailDigestEnabled: boolean;
}

@Component({
  selector: 'app-preferences',
  standalone: true,
  imports: [FormsModule],
  template: `
    <div class="page">
      <h1 class="page-title">Preferences</h1>
      <p class="page-subtitle">Configure your job search preferences</p>

      @if (loading()) {
        <p>Loading preferences...</p>
      } @else {
        <div class="card">
          <form (ngSubmit)="save()">
            <div class="form-row">
              <div class="form-group">
                <label class="form-label">Location Type</label>
                <select class="form-input" [(ngModel)]="prefs.locationType" name="locationType">
                  <option value="WORLDWIDE">Worldwide</option>
                  <option value="COUNTRY">Country</option>
                  <option value="CITY">City</option>
                </select>
              </div>
              @if (prefs.locationType === 'COUNTRY') {
                <div class="form-group">
                  <label class="form-label">Country</label>
                  <input class="form-input" [(ngModel)]="prefs.country" name="country" placeholder="e.g. United States" />
                </div>
              }
              @if (prefs.locationType === 'CITY') {
                <div class="form-group">
                  <label class="form-label">City</label>
                  <input class="form-input" [(ngModel)]="prefs.city" name="city" placeholder="e.g. New York" />
                </div>
              }
            </div>

            <div class="form-group">
              <label class="form-label">Work Mode</label>
              <div class="checkboxes">
                @for (mode of workModes; track mode) {
                  <label><input type="checkbox" [checked]="prefs.workModes.includes(mode)" (change)="toggleWorkMode(mode)" /> {{ mode }}</label>
                }
              </div>
            </div>

            <div class="form-group">
              <label class="form-label">Job Types</label>
              <div class="checkboxes">
                @for (type of jobTypes; track type) {
                  <label><input type="checkbox" [checked]="prefs.jobTypes.includes(type)" (change)="toggleJobType(type)" /> {{ type.replace('_', ' ') }}</label>
                }
              </div>
            </div>

            <div class="form-group">
              <label class="form-label">Match Threshold ({{ prefs.matchThreshold }}%)</label>
              <input class="form-input" type="range" min="50" max="100" [(ngModel)]="prefs.matchThreshold" name="matchThreshold" />
              <p class="field-hint">Only show jobs scoring above this percentage</p>
            </div>

            <div class="section-divider"></div>
            <h3 class="section-title">Email Digest Schedule</h3>
            <p class="section-hint">
              When the job search agent is enabled, Hirely automatically searches and emails matched jobs at these times in your timezone (set in Settings). Manual runs from the Dashboard also email results when this is enabled.
            </p>

            <div class="form-group">
              <label><input type="checkbox" [(ngModel)]="prefs.emailDigestEnabled" name="emailDigestEnabled" /> Enable email digests</label>
            </div>

            @if (prefs.emailDigestEnabled) {
              <div class="form-group">
                <label class="form-label">Delivery times</label>
                <div class="checkboxes digest-times">
                  @for (slot of digestSlots; track slot.hour) {
                    <label>
                      <input
                        type="checkbox"
                        [checked]="prefs.digestHours.includes(slot.hour)"
                        (change)="toggleDigestHour(slot.hour)"
                      />
                      {{ slot.label }}
                    </label>
                  }
                </div>
              </div>
            }

            <div class="section-divider"></div>

            <div class="form-group">
              <label><input type="checkbox" [(ngModel)]="prefs.agentEnabled" name="agentEnabled" /> Enable automatic job search agent</label>
            </div>

            @if (error()) { <p class="error">{{ error() }}</p> }
            @if (saved()) { <p class="success">Preferences saved!</p> }
            <button class="btn-primary" type="submit" [disabled]="saving()">
              {{ saving() ? 'Saving...' : 'Save Preferences' }}
            </button>
          </form>
        </div>
      }
    </div>
  `,
  styles: [`
    .page-title { font-size: 24px; font-weight: 700; }
    .page-subtitle { color: var(--text-secondary); margin: 4px 0 32px; }
    .form-row { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; }
    @media (max-width: 768px) { .form-row { grid-template-columns: 1fr; } }
    .form-group { margin-bottom: 20px; }
    .checkboxes { display: flex; gap: 16px; flex-wrap: wrap; }
    .checkboxes label { display: flex; align-items: center; gap: 6px; font-size: 14px; }
    .digest-times { flex-direction: column; gap: 10px; }
    .section-divider { border-top: 1px solid var(--border-color); margin: 24px 0; }
    .section-title { font-size: 16px; font-weight: 600; margin-bottom: 4px; }
    .section-hint { color: var(--text-secondary); font-size: 13px; margin-bottom: 16px; }
    .field-hint { color: var(--text-secondary); font-size: 12px; margin-top: 6px; }
    .success { color: var(--success); margin-bottom: 12px; }
    .error { color: var(--danger); margin-bottom: 12px; }
  `],
})
export class PreferencesComponent implements OnInit {
  private api = inject(ApiService);
  workModes = ['REMOTE', 'HYBRID', 'ONSITE'];
  jobTypes = ['FULL_TIME', 'PART_TIME', 'CONTRACT'];
  digestSlots = [
    { hour: 7, label: '7:00 AM' },
    { hour: 9, label: '9:00 AM' },
    { hour: 12, label: '12:00 PM' },
    { hour: 15, label: '3:00 PM' },
    { hour: 18, label: '6:00 PM' },
  ];
  saved = signal(false);
  error = signal('');
  saving = signal(false);
  loading = signal(true);

  prefs: PreferencesPayload = {
    locationType: 'WORLDWIDE',
    workModes: ['REMOTE'],
    jobTypes: ['FULL_TIME'],
    matchThreshold: 75,
    agentEnabled: true,
    digestHours: [9, 15],
    emailDigestEnabled: true,
  };

  ngOnInit() {
    this.api
      .get<Record<string, unknown>>('/preferences')
      .then((p) => {
        this.prefs = {
          locationType: (p['locationType'] as string) || 'WORLDWIDE',
          country: (p['country'] as string) || undefined,
          city: (p['city'] as string) || undefined,
          workModes: (p['workModes'] as string[]) || ['REMOTE'],
          jobTypes: (p['jobTypes'] as string[]) || ['FULL_TIME'],
          matchThreshold: (p['matchThreshold'] as number) ?? 75,
          agentEnabled: (p['agentEnabled'] as boolean) ?? true,
          digestHours: (p['digestHours'] as number[])?.length
            ? (p['digestHours'] as number[])
            : [9, 15],
          emailDigestEnabled: (p['emailDigestEnabled'] as boolean) ?? true,
        };
      })
      .catch((e: Error) => this.error.set(e.message))
      .finally(() => this.loading.set(false));
  }

  toggleWorkMode(mode: string) {
    const idx = this.prefs.workModes.indexOf(mode);
    if (idx >= 0) this.prefs.workModes.splice(idx, 1);
    else this.prefs.workModes.push(mode);
  }

  toggleJobType(type: string) {
    const idx = this.prefs.jobTypes.indexOf(type);
    if (idx >= 0) this.prefs.jobTypes.splice(idx, 1);
    else this.prefs.jobTypes.push(type);
  }

  toggleDigestHour(hour: number) {
    const idx = this.prefs.digestHours.indexOf(hour);
    if (idx >= 0) {
      if (this.prefs.digestHours.length > 1) {
        this.prefs.digestHours.splice(idx, 1);
      }
    } else {
      this.prefs.digestHours.push(hour);
      this.prefs.digestHours.sort((a, b) => a - b);
    }
  }

  private buildPayload(): PreferencesPayload {
    return {
      locationType: this.prefs.locationType,
      country: this.prefs.country?.trim() || undefined,
      city: this.prefs.city?.trim() || undefined,
      workModes: this.prefs.workModes.length ? this.prefs.workModes : ['REMOTE'],
      jobTypes: this.prefs.jobTypes.length ? this.prefs.jobTypes : ['FULL_TIME'],
      matchThreshold: Number(this.prefs.matchThreshold),
      agentEnabled: this.prefs.agentEnabled,
      digestHours: this.prefs.digestHours.length ? this.prefs.digestHours : [9, 15],
      emailDigestEnabled: this.prefs.emailDigestEnabled,
    };
  }

  async save() {
    this.saving.set(true);
    this.error.set('');
    this.saved.set(false);
    try {
      await this.api.put('/preferences', this.buildPayload());
      this.saved.set(true);
      setTimeout(() => this.saved.set(false), 3000);
    } catch (e: unknown) {
      this.error.set(e instanceof Error ? e.message : 'Failed to save preferences');
    } finally {
      this.saving.set(false);
    }
  }
}
