import { Component, inject, signal, OnInit } from '@angular/core';
import { DatePipe } from '@angular/common';
import { ApiService } from '../../core/services/api.service';

interface AdminStats {
  totalUsers: number;
  activeUsers: number;
  totalJobs: number;
  emailsSentToday: number;
  agentRunsToday: number;
}

interface AdminUser {
  id: string;
  name: string;
  email: string;
  role: string;
  emailVerified: boolean;
  _count?: { jobMatches: number };
}

interface AdminCv {
  id: string;
  originalName: string;
  size: number;
  uploadedAt: string;
  user?: { email: string };
}

interface AdminEmail {
  id: string;
  subject: string;
  jobCount: number;
  status: string;
  createdAt: string;
  user?: { email: string };
}

interface AdminRun {
  id: string;
  status: string;
  jobsFound: number;
  jobsMatched: number;
  jobsSent: number;
  startedAt: string;
  user?: { email: string };
}

@Component({
  selector: 'app-admin',
  standalone: true,
  imports: [DatePipe],
  template: `
    <div class="page">
      <h1 class="page-title">Admin Panel</h1>
      <p class="page-subtitle">System overview and management</p>

      @if (stats()) {
        <div class="stats-grid">
          <div class="stat-card"><div class="stat-value">{{ stats()!.totalUsers }}</div><div class="stat-label">Total Users</div></div>
          <div class="stat-card"><div class="stat-value">{{ stats()!.activeUsers }}</div><div class="stat-label">Active Users</div></div>
          <div class="stat-card"><div class="stat-value">{{ stats()!.totalJobs }}</div><div class="stat-label">Total Jobs</div></div>
          <div class="stat-card"><div class="stat-value">{{ stats()!.emailsSentToday }}</div><div class="stat-label">Emails Today</div></div>
          <div class="stat-card"><div class="stat-value">{{ stats()!.agentRunsToday }}</div><div class="stat-label">Agent Runs Today</div></div>
        </div>
      }

      <div class="tabs">
        <button [class.active]="tab() === 'users'" (click)="tab.set('users'); loadTab()">Users</button>
        <button [class.active]="tab() === 'cvs'" (click)="tab.set('cvs'); loadTab()">CVs</button>
        <button [class.active]="tab() === 'emails'" (click)="tab.set('emails'); loadTab()">Email Logs</button>
        <button [class.active]="tab() === 'agent'" (click)="tab.set('agent'); loadTab()">Agent Runs</button>
      </div>

      <div class="card table-card">
        @if (tab() === 'users') {
          <table>
            <thead><tr><th>Name</th><th>Email</th><th>Role</th><th>Verified</th><th>Matches</th></tr></thead>
            <tbody>
              @for (u of users(); track u.id) {
                <tr><td>{{ u.name }}</td><td>{{ u.email }}</td><td>{{ u.role }}</td><td>{{ u.emailVerified ? 'Yes' : 'No' }}</td><td>{{ u._count?.jobMatches }}</td></tr>
              }
            </tbody>
          </table>
        }
        @if (tab() === 'cvs') {
          <table>
            <thead><tr><th>User</th><th>File</th><th>Size</th><th>Uploaded</th></tr></thead>
            <tbody>
              @for (c of cvs(); track c.id) {
                <tr><td>{{ c.user?.email }}</td><td>{{ c.originalName }}</td><td>{{ (c.size / 1024).toFixed(1) }} KB</td><td>{{ c.uploadedAt | date:'short' }}</td></tr>
              }
            </tbody>
          </table>
        }
        @if (tab() === 'emails') {
          <table>
            <thead><tr><th>User</th><th>Subject</th><th>Jobs</th><th>Status</th><th>Date</th></tr></thead>
            <tbody>
              @for (e of emails(); track e.id) {
                <tr><td>{{ e.user?.email }}</td><td>{{ e.subject }}</td><td>{{ e.jobCount }}</td><td>{{ e.status }}</td><td>{{ e.createdAt | date:'short' }}</td></tr>
              }
            </tbody>
          </table>
        }
        @if (tab() === 'agent') {
          <table>
            <thead><tr><th>User</th><th>Status</th><th>Found</th><th>Matched</th><th>Sent</th><th>Started</th></tr></thead>
            <tbody>
              @for (r of runs(); track r.id) {
                <tr><td>{{ r.user?.email }}</td><td>{{ r.status }}</td><td>{{ r.jobsFound }}</td><td>{{ r.jobsMatched }}</td><td>{{ r.jobsSent }}</td><td>{{ r.startedAt | date:'short' }}</td></tr>
              }
            </tbody>
          </table>
        }
      </div>
    </div>
  `,
  styles: [`
    .page-title { font-size: 24px; font-weight: 700; }
    .page-subtitle { color: var(--text-secondary); margin: 4px 0 24px; }
    .stats-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(160px, 1fr)); gap: 12px; margin-bottom: 24px; }
    .tabs { display: flex; gap: 8px; margin-bottom: 16px; }
    .tabs button { padding: 8px 16px; border: 1px solid var(--border-color); border-radius: 8px; background: var(--card-bg); color: var(--text-secondary); font-size: 13px; }
    .tabs button.active { background: rgba(79,70,229,0.1); color: var(--accent); border-color: var(--accent); }
    .table-card { overflow-x: auto; }
    table { width: 100%; border-collapse: collapse; font-size: 14px; }
    th, td { padding: 10px 12px; text-align: left; border-bottom: 1px solid var(--border-color); }
    th { color: var(--text-secondary); font-weight: 500; font-size: 12px; text-transform: uppercase; }
  `],
})
export class AdminComponent implements OnInit {
  private api = inject(ApiService);
  stats = signal<AdminStats | null>(null);
  tab = signal('users');
  users = signal<AdminUser[]>([]);
  cvs = signal<AdminCv[]>([]);
  emails = signal<AdminEmail[]>([]);
  runs = signal<AdminRun[]>([]);

  ngOnInit() {
    this.api.get<AdminStats>('/admin/stats').then((s) => this.stats.set(s)).catch(() => {});
    this.loadTab();
  }

  loadTab() {
    const t = this.tab();
    if (t === 'users') this.api.get<AdminUser[]>('/admin/users').then((d) => this.users.set(d)).catch(() => {});
    if (t === 'cvs') this.api.get<AdminCv[]>('/admin/cvs').then((d) => this.cvs.set(d)).catch(() => {});
    if (t === 'emails') this.api.get<AdminEmail[]>('/admin/email-logs').then((d) => this.emails.set(d)).catch(() => {});
    if (t === 'agent') this.api.get<AdminRun[]>('/admin/agent-runs').then((d) => this.runs.set(d)).catch(() => {});
  }
}
