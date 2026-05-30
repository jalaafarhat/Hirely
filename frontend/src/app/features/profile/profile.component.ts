import { Component, inject, signal, OnInit, ElementRef, ViewChild } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ApiService } from '../../core/services/api.service';

interface ParsedProfile {
  name?: string;
  email?: string;
  phone?: string;
  summary?: string;
  jobTitles?: string[];
  skills?: string[];
  technologies?: string[];
  yearsExperience?: number;
  seniority?: string;
  certifications?: string[];
  languages?: string[];
  locations?: string[];
}

interface CVData {
  file?: { filename: string };
  profile?: ParsedProfile;
}

interface ProfileForm {
  name: string;
  email: string;
  phone: string;
  summary: string;
  jobTitles: string;
  skills: string;
  technologies: string;
  yearsExperience: number;
  seniority: string;
  certifications: string;
  languages: string;
  locations: string;
}

@Component({
  selector: 'app-profile',
  standalone: true,
  imports: [FormsModule],
  template: `
    <div class="page">
      <h1 class="page-title">Profile</h1>
      <p class="page-subtitle">Upload your CV and refine your parsed profile</p>

      <div class="card upload-section">
        <h3>Your CV</h3>
        <p class="hint">PDF or DOCX, max 10MB. AI will extract your profile — you can edit it below.</p>

        <input
          #fileInput
          type="file"
          accept=".pdf,.docx,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
          class="hidden-input"
          (change)="onFileSelect($event)"
        />

        <div
          class="dropzone"
          [class.dragging]="isDragging()"
          [class.has-file]="!!cvData()?.file"
          (dragover)="onDragOver($event)"
          (dragleave)="isDragging.set(false)"
          (drop)="onDrop($event)"
        >
          @if (cvData()?.file) {
            <div class="file-preview">
              <span class="file-icon">📄</span>
              <div>
                <p class="file-name">{{ cvData()!.file!.filename }}</p>
                <p class="file-meta">Ready for job matching</p>
              </div>
            </div>
          } @else {
            <span class="upload-icon">↑</span>
            <p class="dropzone-title">Drag & drop your CV here</p>
            <p class="dropzone-sub">or use the button below</p>
          }

          <div class="upload-actions">
            <button type="button" class="btn-primary" [disabled]="uploading()" (click)="fileInput.click()">
              {{ uploading() ? 'Analyzing CV...' : cvData()?.file ? 'Replace CV' : 'Upload CV' }}
            </button>
            @if (cvData()?.file) {
              <button type="button" class="btn-secondary" (click)="deleteCV()" [disabled]="uploading()">Remove</button>
            }
          </div>
        </div>

        @if (uploading()) {
          <div class="progress-bar"><div class="progress-fill"></div></div>
          <p class="info">Extracting text and analyzing with AI...</p>
        }
        @if (uploadSuccess()) { <p class="success">CV uploaded! Review and edit your profile below.</p> }
        @if (uploadError()) { <p class="error">{{ uploadError() }}</p> }
      </div>

      @if (cvData()?.profile) {
        <div class="card profile-section">
          <div class="profile-header">
            <h3>Parsed Profile</h3>
            @if (!editing()) {
              <button type="button" class="btn-secondary" (click)="startEdit()">Edit Profile</button>
            }
          </div>

          @if (!editing()) {
            <div class="profile-grid">
              <div><strong>Name:</strong> {{ cvData()!.profile!.name || '—' }}</div>
              <div><strong>Email:</strong> {{ cvData()!.profile!.email || '—' }}</div>
              <div><strong>Phone:</strong> {{ cvData()!.profile!.phone || '—' }}</div>
              <div><strong>Experience:</strong> {{ cvData()!.profile!.yearsExperience ?? 0 }} years</div>
              <div><strong>Seniority:</strong> {{ cvData()!.profile!.seniority || '—' }}</div>
            </div>
            @if (cvData()!.profile!.summary) {
              <p class="summary">{{ cvData()!.profile!.summary }}</p>
            }
            @if (arrayLen(cvData()!.profile!.jobTitles)) {
              <div class="tags-section">
                <h4>Job Titles</h4>
                <div class="tags">@for (t of cvData()!.profile!.jobTitles!; track t) { <span class="badge badge-accent">{{ t }}</span> }</div>
              </div>
            }
            @if (arrayLen(cvData()!.profile!.skills)) {
              <div class="tags-section">
                <h4>Skills</h4>
                <div class="tags">@for (s of cvData()!.profile!.skills!; track s) { <span class="badge badge-accent">{{ s }}</span> }</div>
              </div>
            }
            @if (arrayLen(cvData()!.profile!.technologies)) {
              <div class="tags-section">
                <h4>Technologies</h4>
                <div class="tags">@for (t of cvData()!.profile!.technologies!; track t) { <span class="badge badge-success">{{ t }}</span> }</div>
              </div>
            }
          } @else {
            <form (ngSubmit)="saveProfile()">
              <div class="form-row">
                <div class="form-group">
                  <label class="form-label">Full Name</label>
                  <input class="form-input" [(ngModel)]="form.name" name="name" />
                </div>
                <div class="form-group">
                  <label class="form-label">Email</label>
                  <input class="form-input" type="email" [(ngModel)]="form.email" name="email" />
                </div>
              </div>
              <div class="form-row">
                <div class="form-group">
                  <label class="form-label">Phone</label>
                  <input class="form-input" [(ngModel)]="form.phone" name="phone" />
                </div>
                <div class="form-group">
                  <label class="form-label">Years of Experience</label>
                  <input class="form-input" type="number" min="0" [(ngModel)]="form.yearsExperience" name="yearsExperience" />
                </div>
              </div>
              <div class="form-group">
                <label class="form-label">Seniority</label>
                <select class="form-input" [(ngModel)]="form.seniority" name="seniority">
                  <option value="">Not specified</option>
                  @for (level of seniorityLevels; track level) {
                    <option [value]="level">{{ level }}</option>
                  }
                </select>
              </div>
              <div class="form-group">
                <label class="form-label">Summary</label>
                <textarea class="form-input textarea" rows="4" [(ngModel)]="form.summary" name="summary"></textarea>
              </div>
              <div class="form-group">
                <label class="form-label">Job Titles</label>
                <input class="form-input" [(ngModel)]="form.jobTitles" name="jobTitles" placeholder="Software Engineer, Frontend Developer" />
                <span class="field-hint">Comma-separated — used for job search queries</span>
              </div>
              <div class="form-group">
                <label class="form-label">Skills</label>
                <input class="form-input" [(ngModel)]="form.skills" name="skills" placeholder="Communication, Agile, Team Leadership" />
                <span class="field-hint">Professional / soft skills, comma-separated</span>
              </div>
              <div class="form-group">
                <label class="form-label">Technologies</label>
                <input class="form-input" [(ngModel)]="form.technologies" name="technologies" placeholder="Angular, TypeScript, Node.js, PostgreSQL" />
                <span class="field-hint">Tools, languages, frameworks — comma-separated</span>
              </div>
              <div class="form-group">
                <label class="form-label">Languages</label>
                <input class="form-input" [(ngModel)]="form.languages" name="languages" placeholder="English, French" />
              </div>
              <div class="form-group">
                <label class="form-label">Preferred Locations</label>
                <input class="form-input" [(ngModel)]="form.locations" name="locations" placeholder="Remote, London, Berlin" />
              </div>
              @if (profileError()) { <p class="error">{{ profileError() }}</p> }
              @if (profileSaved()) { <p class="success">Profile saved!</p> }
              <div class="form-actions">
                <button type="submit" class="btn-primary" [disabled]="savingProfile()">
                  {{ savingProfile() ? 'Saving...' : 'Save Profile' }}
                </button>
                <button type="button" class="btn-secondary" (click)="cancelEdit()">Cancel</button>
              </div>
            </form>
          }
        </div>
      }
    </div>
  `,
  styles: [`
    .page-title { font-size: 24px; font-weight: 700; }
    .page-subtitle { color: var(--text-secondary); margin: 4px 0 32px; }
    .upload-section, .profile-section { margin-bottom: 24px; }
    .upload-section h3, .profile-section h3 { margin-bottom: 8px; }
    .profile-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 16px; }
    .profile-header h3 { margin: 0; }
    .hint { color: var(--text-secondary); font-size: 13px; margin-bottom: 20px; }
    .field-hint { color: var(--text-secondary); font-size: 12px; display: block; margin-top: 4px; }
    .hidden-input { display: none; }
    .dropzone { border: 2px dashed var(--border-color); border-radius: 12px; padding: 32px 24px; text-align: center; transition: border-color 0.2s, background 0.2s; }
    .dropzone.dragging, .dropzone:hover { border-color: var(--accent); background: rgba(79,70,229,0.04); }
    .dropzone.has-file { padding: 24px; }
    .upload-icon { font-size: 32px; color: var(--accent); display: block; margin-bottom: 8px; }
    .dropzone-title { font-weight: 600; margin-bottom: 4px; }
    .dropzone-sub { color: var(--text-secondary); font-size: 13px; margin-bottom: 16px; }
    .upload-actions { display: flex; gap: 12px; justify-content: center; margin-top: 16px; }
    .file-preview { display: flex; align-items: center; gap: 16px; justify-content: center; margin-bottom: 8px; }
    .file-icon { font-size: 36px; }
    .file-name { font-weight: 600; text-align: left; }
    .file-meta { color: var(--text-secondary); font-size: 13px; text-align: left; }
    .progress-bar { height: 4px; background: var(--bg-tertiary); border-radius: 2px; margin-top: 16px; overflow: hidden; }
    .progress-fill { height: 100%; width: 60%; background: var(--accent); animation: pulse 1.2s ease-in-out infinite alternate; }
    @keyframes pulse { from { width: 20%; } to { width: 90%; } }
    .profile-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; margin-bottom: 16px; }
    .form-row { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; }
    @media (max-width: 768px) { .form-row { grid-template-columns: 1fr; } .profile-grid { grid-template-columns: 1fr; } }
    .form-group { margin-bottom: 16px; }
    .form-actions { display: flex; gap: 12px; margin-top: 8px; }
    .textarea { resize: vertical; min-height: 80px; }
    .summary { color: var(--text-secondary); line-height: 1.6; margin-bottom: 20px; }
    .tags-section { margin-bottom: 16px; }
    .tags-section h4 { font-size: 13px; color: var(--text-secondary); margin-bottom: 8px; }
    .tags { display: flex; flex-wrap: wrap; gap: 6px; }
    .error { color: var(--danger); margin-top: 8px; }
    .success { color: var(--success); margin-top: 8px; }
    .info { color: var(--text-secondary); margin-top: 12px; font-size: 14px; }
  `],
})
export class ProfileComponent implements OnInit {
  @ViewChild('fileInput') fileInput!: ElementRef<HTMLInputElement>;

  private api = inject(ApiService);
  cvData = signal<CVData | null>(null);
  uploading = signal(false);
  uploadError = signal('');
  uploadSuccess = signal(false);
  isDragging = signal(false);
  editing = signal(false);
  savingProfile = signal(false);
  profileError = signal('');
  profileSaved = signal(false);

  seniorityLevels = ['Intern', 'Junior', 'Mid', 'Senior', 'Lead', 'Principal', 'Manager', 'Director'];

  form: ProfileForm = this.emptyForm();

  ngOnInit() { this.loadCV(); }

  arrayLen(arr?: string[]) { return (arr?.length ?? 0) > 0; }

  loadCV() {
    this.api
      .get<CVData>('/cv')
      .then((d) => this.cvData.set(d))
      .catch((e: unknown) => {
        const msg = e instanceof Error ? e.message : '';
        if (msg && !msg.includes('No CV uploaded')) {
          this.uploadError.set(msg);
        }
      });
  }

  onDragOver(event: DragEvent) {
    event.preventDefault();
    this.isDragging.set(true);
  }

  onDrop(event: DragEvent) {
    event.preventDefault();
    this.isDragging.set(false);
    const file = event.dataTransfer?.files?.[0];
    if (file) this.uploadFile(file);
  }

  onFileSelect(event: Event) {
    const file = (event.target as HTMLInputElement).files?.[0];
    if (file) this.uploadFile(file);
  }

  async uploadFile(file: File) {
    const name = file.name.toLowerCase();
    if (!name.endsWith('.pdf') && !name.endsWith('.docx')) {
      this.uploadError.set('Please upload a PDF or DOCX file');
      return;
    }

    this.uploading.set(true);
    this.uploadError.set('');
    this.uploadSuccess.set(false);
    const form = new FormData();
    form.append('file', file);

    try {
      const result = await this.api.post<{ profile: ParsedProfile; filename: string }>('/cv/upload', form);
      this.cvData.set({ file: { filename: result.filename || file.name }, profile: result.profile });
      this.uploadSuccess.set(true);
      this.editing.set(true);
      this.populateForm(result.profile);
      setTimeout(() => this.uploadSuccess.set(false), 5000);
    } catch (e: unknown) {
      this.uploadError.set(e instanceof Error ? e.message : 'Upload failed');
    } finally {
      this.uploading.set(false);
      if (this.fileInput?.nativeElement) this.fileInput.nativeElement.value = '';
    }
  }

  startEdit() {
    this.populateForm(this.cvData()?.profile);
    this.editing.set(true);
    this.profileError.set('');
    this.profileSaved.set(false);
  }

  cancelEdit() {
    this.editing.set(false);
    this.profileError.set('');
  }

  private populateForm(p?: ParsedProfile) {
    this.form = {
      name: p?.name || '',
      email: p?.email || '',
      phone: p?.phone || '',
      summary: p?.summary || '',
      jobTitles: (p?.jobTitles || []).join(', '),
      skills: (p?.skills || []).join(', '),
      technologies: (p?.technologies || []).join(', '),
      yearsExperience: p?.yearsExperience ?? 0,
      seniority: p?.seniority || '',
      certifications: (p?.certifications || []).join(', '),
      languages: (p?.languages || []).join(', '),
      locations: (p?.locations || []).join(', '),
    };
  }

  private emptyForm(): ProfileForm {
    return {
      name: '', email: '', phone: '', summary: '',
      jobTitles: '', skills: '', technologies: '',
      yearsExperience: 0, seniority: '',
      certifications: '', languages: '', locations: '',
    };
  }

  private parseList(value: string): string[] {
    return value.split(',').map((s) => s.trim()).filter(Boolean);
  }

  async saveProfile() {
    this.savingProfile.set(true);
    this.profileError.set('');
    this.profileSaved.set(false);

    const payload = {
      name: this.form.name.trim(),
      email: this.form.email.trim(),
      phone: this.form.phone.trim(),
      summary: this.form.summary.trim(),
      jobTitles: this.parseList(this.form.jobTitles),
      skills: this.parseList(this.form.skills),
      technologies: this.parseList(this.form.technologies),
      yearsExperience: Number(this.form.yearsExperience) || 0,
      seniority: this.form.seniority,
      certifications: this.parseList(this.form.certifications),
      languages: this.parseList(this.form.languages),
      locations: this.parseList(this.form.locations),
    };

    try {
      const res = await this.api.patch<{ profile: ParsedProfile }>('/cv/profile', payload);
      this.cvData.update((d) => d ? { ...d, profile: res.profile } : d);
      this.profileSaved.set(true);
      this.editing.set(false);
      setTimeout(() => this.profileSaved.set(false), 3000);
    } catch (e: unknown) {
      this.profileError.set(e instanceof Error ? e.message : 'Failed to save profile');
    } finally {
      this.savingProfile.set(false);
    }
  }

  async deleteCV() {
    await this.api.delete('/cv');
    this.cvData.set(null);
    this.editing.set(false);
  }
}
