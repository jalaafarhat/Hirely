import { Component, inject, signal, OnInit } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ApiService } from '../../core/services/api.service';

interface JobItem {
  id: string;
  title: string;
  company: string;
  location: string;
  salary: string;
  url: string;
  source: string;
  matchScore: number;
  reasoning: string;
  status: string;
  workMode?: string;
}

@Component({
  selector: 'app-jobs',
  standalone: true,
  imports: [FormsModule],
  template: `
    <div class="page">
      <h1 class="page-title">Jobs</h1>
      <p class="page-subtitle">All matched job opportunities</p>

      <div class="filters card">
        <select class="form-input filter" [(ngModel)]="filters.source" (change)="loadJobs()">
          <option value="">All sources</option>
          <option value="linkedin">LinkedIn</option>
          <option value="indeed">Indeed</option>
          <option value="glassdoor">Glassdoor</option>
          <option value="greenhouse">Greenhouse</option>
          <option value="amazon">Amazon</option>
          <option value="microsoft">Microsoft</option>
          <option value="nvidia">NVIDIA</option>
          <option value="apple">Apple</option>
          <option value="meta">Meta</option>
          <option value="appsflyer">AppsFlyer</option>
          <option value="paloalto">Palo Alto Networks</option>
        </select>
        <select class="form-input filter" [(ngModel)]="filters.workMode" (change)="loadJobs()">
          <option value="">All work modes</option>
          <option value="remote">Remote</option>
          <option value="hybrid">Hybrid</option>
          <option value="onsite">Onsite</option>
        </select>
        <input class="form-input filter" type="number" placeholder="Min score" [(ngModel)]="filters.minScore" (change)="loadJobs()" />
      </div>

      @if (loading()) {
        <p>Loading jobs...</p>
      } @else if (jobs().length === 0) {
        <div class="card empty">No jobs matched yet. Upload your CV and configure preferences to get started.</div>
      } @else {
        <div class="jobs-list">
          @for (job of jobs(); track job.id) {
            <div class="job-card card">
              <div class="job-header">
                <div>
                  <h3>{{ job.title }}</h3>
                  <p class="company">{{ job.company }} · {{ job.location }}</p>
                </div>
                <span class="badge badge-success">{{ job.matchScore }}% match</span>
              </div>
              <p class="reasoning">{{ job.reasoning }}</p>
              <div class="job-meta">
                <span class="badge badge-accent">{{ job.source }}</span>
              </div>
              <div class="job-actions">
                <a [href]="job.url" target="_blank" class="btn-primary">Apply</a>
                <button class="btn-secondary" (click)="saveJob(job.id)">Save</button>
                <button class="btn-secondary" (click)="hideJob(job.id)">Hide</button>
                <button class="btn-secondary" (click)="markApplied(job.id)">Applied</button>
                <button class="btn-secondary" (click)="feedback(job.id, 'INTERESTED')">👍</button>
                <button class="btn-secondary" (click)="feedback(job.id, 'NOT_INTERESTED')">👎</button>
              </div>
            </div>
          }
        </div>
      }
    </div>
  `,
  styles: [`
    .page-title { font-size: 24px; font-weight: 700; }
    .page-subtitle { color: var(--text-secondary); margin: 4px 0 24px; }
    .filters { display: flex; gap: 12px; margin-bottom: 24px; padding: 16px; }
    .filter { max-width: 180px; }
    .jobs-list { display: flex; flex-direction: column; gap: 16px; }
    .job-header { display: flex; justify-content: space-between; align-items: flex-start; }
    .job-header h3 { font-size: 18px; }
    .company { color: var(--text-secondary); font-size: 14px; margin-top: 4px; }
    .reasoning { color: var(--text-secondary); font-size: 14px; margin: 12px 0; line-height: 1.5; }
    .job-meta { display: flex; gap: 8px; align-items: center; margin-bottom: 16px; }
    .job-actions { display: flex; gap: 8px; flex-wrap: wrap; }
    .empty { text-align: center; color: var(--text-secondary); padding: 40px; }
  `],
})
export class JobsComponent implements OnInit {
  private api = inject(ApiService);
  jobs = signal<JobItem[]>([]);
  loading = signal(true);
  filters = { source: '', workMode: '', minScore: 0 };

  ngOnInit() { this.loadJobs(); }

  loadJobs() {
    this.loading.set(true);
    const params = new URLSearchParams();
    if (this.filters.source) params.set('source', this.filters.source);
    if (this.filters.workMode) params.set('workMode', this.filters.workMode);
    if (this.filters.minScore) params.set('minScore', String(this.filters.minScore));

    this.api.get<{ data: JobItem[] }>(`/jobs?${params}`)
      .then((r) => this.jobs.set(r.data))
      .catch(() => this.jobs.set([]))
      .finally(() => this.loading.set(false));
  }

  saveJob(id: string) { this.api.post(`/jobs/${id}/save`).then(() => this.loadJobs()); }
  hideJob(id: string) { this.api.post(`/jobs/${id}/hide`).then(() => this.loadJobs()); }
  markApplied(id: string) { this.api.post(`/jobs/${id}/applied`).then(() => this.loadJobs()); }
  feedback(id: string, type: string) { this.api.post(`/jobs/${id}/feedback`, { type }); }
}
