import { Component, inject, signal, OnInit } from '@angular/core';
import { ApiService } from '../../core/services/api.service';

interface JobItem {
  id: string;
  title: string;
  company: string;
  location: string;
  matchScore: number;
  url: string;
}

@Component({
  selector: 'app-saved-jobs',
  standalone: true,
  template: `
    <div class="page">
      <h1 class="page-title">Saved Jobs</h1>
      <p class="page-subtitle">Jobs you've bookmarked</p>

      @if (jobs().length === 0) {
        <div class="card empty">No saved jobs yet.</div>
      } @else {
        @for (job of jobs(); track job.id) {
          <div class="job-card card">
            <h3>{{ job.title }}</h3>
            <p class="meta">{{ job.company }} · {{ job.location }} · {{ job.matchScore }}% match</p>
            <a [href]="job.url" target="_blank" class="btn-primary">Apply</a>
          </div>
        }
      }
    </div>
  `,
  styles: [`
    .page-title { font-size: 24px; font-weight: 700; }
    .page-subtitle { color: var(--text-secondary); margin: 4px 0 24px; }
    .job-card { margin-bottom: 12px; }
    .job-card h3 { font-size: 16px; margin-bottom: 4px; }
    .meta { color: var(--text-secondary); font-size: 14px; margin-bottom: 12px; }
    .empty { text-align: center; color: var(--text-secondary); padding: 40px; }
  `],
})
export class SavedJobsComponent implements OnInit {
  private api = inject(ApiService);
  jobs = signal<JobItem[]>([]);

  ngOnInit() {
    this.api.get<{ data: JobItem[] }>('/saved-jobs')
      .then((r) => this.jobs.set(r.data))
      .catch(() => {});
  }
}
