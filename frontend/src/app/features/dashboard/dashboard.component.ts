import { Component, inject, signal, OnInit } from '@angular/core';
import { RouterLink } from '@angular/router';
import { ApiService } from '../../core/services/api.service';

interface DashboardStats {
  newJobsToday: number;
  jobsThisWeek: number;
  averageMatchScore: number;
  totalJobsMatched: number;
  emailsSent: number;
}

interface AgentResult {
  jobsFound: number;
  jobsMatched: number;
  jobsEmailed: number;
  message: string;
}

@Component({
  selector: 'app-dashboard',
  standalone: true,
  imports: [RouterLink],
  template: `
    <div class="page">
      <div class="page-header">
        <div>
          <h1 class="page-title">Dashboard</h1>
          <p class="page-subtitle">Search on demand or wait for scheduled email digests</p>
        </div>
        <button class="btn-primary" (click)="runAgent()" [disabled]="agentRunning()">
          {{ agentRunning() ? 'Searching jobs...' : 'Run Job Search Now' }}
        </button>
      </div>

      <p class="info-card">
        <strong>Manual search</strong> runs immediately across Google Jobs plus direct career sites (Amazon, Microsoft, NVIDIA, Apple, Meta, AppsFlyer, Palo Alto Networks).
        If <em>email digests</em> are enabled in Preferences, matched jobs are also emailed to you.
        <br /><br />
        <strong>Automatic digests</strong> run at the times you pick in Preferences (e.g. 9 AM &amp; 3 PM in your timezone from Settings), as long as the job search agent is enabled.
      </p>

      @if (agentRunning()) {
        <div class="agent-loading card">
          <div class="spinner"></div>
          <p>Searching job boards and scoring matches — this can take up to a minute...</p>
        </div>
      }

      @if (agentMessage()) {
        <div class="agent-result card" [class.success]="agentSuccess()" [class.warn]="!agentSuccess()">
          <p>{{ agentMessage() }}</p>
          @if (lastResult()?.jobsMatched) {
            <a routerLink="/jobs" class="btn-secondary">View {{ lastResult()!.jobsMatched }} matched jobs →</a>
          }
        </div>
      }

      @if (loading()) {
        <p>Loading stats...</p>
      } @else {
        <div class="stats-grid">
          <div class="stat-card">
            <div class="stat-value">{{ stats()?.newJobsToday ?? 0 }}</div>
            <div class="stat-label">New jobs today</div>
          </div>
          <div class="stat-card">
            <div class="stat-value">{{ stats()?.jobsThisWeek ?? 0 }}</div>
            <div class="stat-label">Jobs this week</div>
          </div>
          <div class="stat-card">
            <div class="stat-value">{{ stats()?.averageMatchScore ?? 0 }}%</div>
            <div class="stat-label">Average match score</div>
          </div>
          <div class="stat-card">
            <div class="stat-value">{{ stats()?.totalJobsMatched ?? 0 }}</div>
            <div class="stat-label">Total jobs matched</div>
          </div>
          <div class="stat-card">
            <div class="stat-value">{{ stats()?.emailsSent ?? 0 }}</div>
            <div class="stat-label">Emails sent</div>
          </div>
        </div>
      }
    </div>
  `,
  styles: [`
    .page-header { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 8px; gap: 16px; flex-wrap: wrap; }
    .page-title { font-size: 24px; font-weight: 700; }
    .page-subtitle { color: var(--text-secondary); margin: 4px 0 0; }
    .info-card { background: var(--bg-tertiary); border: 1px solid var(--border-color); border-radius: 12px; padding: 16px 20px; margin: 16px 0; font-size: 14px; line-height: 1.6; color: var(--text-secondary); }
    .stats-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(200px, 1fr)); gap: 16px; margin-top: 24px; }
    .agent-loading { display: flex; align-items: center; gap: 16px; margin: 16px 0; padding: 16px 20px; }
    .agent-result { margin: 16px 0; padding: 16px 20px; }
    .agent-result.success { border-color: var(--success); }
    .agent-result.warn { border-color: #f59e0b; }
    .agent-result p { margin-bottom: 12px; }
    .spinner { width: 24px; height: 24px; border: 3px solid var(--border-color); border-top-color: var(--accent); border-radius: 50%; animation: spin 0.8s linear infinite; flex-shrink: 0; }
    @keyframes spin { to { transform: rotate(360deg); } }
  `],
})
export class DashboardComponent implements OnInit {
  private api = inject(ApiService);
  stats = signal<DashboardStats | null>(null);
  loading = signal(true);
  agentRunning = signal(false);
  agentMessage = signal('');
  agentSuccess = signal(false);
  lastResult = signal<AgentResult | null>(null);

  ngOnInit() {
    this.loadStats();
  }

  loadStats() {
    this.loading.set(true);
    this.api
      .get<DashboardStats>('/dashboard/stats')
      .then((s) => this.stats.set(s))
      .catch(() => {})
      .finally(() => this.loading.set(false));
  }

  async runAgent() {
    this.agentRunning.set(true);
    this.agentMessage.set('');
    this.lastResult.set(null);
    try {
      const res = await this.api.post<AgentResult>('/agent/run');
      this.lastResult.set(res);
      this.agentMessage.set(res.message);
      this.agentSuccess.set(res.jobsMatched > 0);
      this.loadStats();
    } catch (e: unknown) {
      this.agentMessage.set(e instanceof Error ? e.message : 'Job search failed');
      this.agentSuccess.set(false);
    } finally {
      this.agentRunning.set(false);
    }
  }
}
