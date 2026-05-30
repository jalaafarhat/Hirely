# Hirely System Architecture

## Overview

Hirely is a monorepo SaaS application with an Angular 20 frontend, NestJS API, PostgreSQL database, Redis job queue, and external integrations for AI, email, and job discovery.

```
┌─────────────────────────────────────────────────────────────────────────┐
│                           Client (Angular 20)                           │
│  Auth │ Dashboard │ Profile │ Jobs │ Preferences │ Admin                │
└───────────────────────────────┬─────────────────────────────────────────┘
                                │ HTTPS / REST + JWT
┌───────────────────────────────▼─────────────────────────────────────────┐
│                         NestJS API (Port 3000)                          │
├─────────────┬─────────────┬──────────────┬──────────────┬───────────────┤
│ AuthModule  │ UserModule  │ CVModule     │ JobsModule   │ AdminModule   │
│             │             │              │              │               │
│ AuthService │ UserService │ CVParser     │ JobMatching  │ AdminService  │
│             │             │ ProfileAnaly │ JobSources   │               │
│             │             │              │ EmailDigest  │               │
└──────┬──────┴──────┬──────┴──────┬───────┴──────┬───────┴───────┬───────┘
       │             │             │              │               │
       ▼             ▼             ▼              ▼               ▼
  PostgreSQL      AWS S3 /      Google AI     SerpAPI         Resend
  (Prisma)        Local FS      (Gemini)      (Jobs)          (Email)
       │
       ▼
  Redis + BullMQ (job agent queue, scheduled tasks)
```

## Core Flows

### 1. Onboarding Flow

```
Register → Verify Email → Upload CV → AI Parse Profile → Set Preferences → Agent Active
```

### 2. Daily Job Agent Flow

```
Cron (08:00 user TZ) → Load Users → Generate Search Queries → Fetch Jobs (Sources)
→ Normalize → AI Match Score → Filter (threshold) → Dedupe (SentJobs) → Save Matches
→ Build Digest → Send Email → Log SentJobs
```

### 3. Feedback Learning Flow

```
User Feedback (Interested/Not Interested) → Update preference weights
→ Future matching prompts include learned signals
```

## Backend Module Structure

```
backend/src/
├── main.ts
├── app.module.ts
├── common/           # Guards, filters, pipes, decorators
├── config/           # Configuration module
├── prisma/           # Prisma service
├── auth/             # JWT auth, refresh tokens, email verification
├── users/            # User profile management
├── cv/               # CV upload, parse, profile storage
├── preferences/      # Job preferences
├── jobs/             # Job matches, saved jobs, applications
├── agent/            # Scheduled job search agent
├── matching/         # AI matching engine
├── sources/          # Job source providers (LinkedIn, Indeed, etc.)
├── email/            # Resend email digest
├── feedback/         # Recommendation learning
├── admin/            # Admin panel APIs
└── storage/          # S3 / local file storage
```

## Frontend Structure

```
frontend/src/app/
├── core/             # Auth, interceptors, guards, services
├── shared/           # UI components, pipes, directives
├── layout/           # Shell, sidebar, header
├── features/
│   ├── auth/
│   ├── dashboard/
│   ├── profile/
│   ├── jobs/
│   ├── preferences/
│   ├── settings/
│   └── admin/
└── theme/            # Dark/light mode
```

## Security

- JWT access tokens (15m) + HTTP-only refresh tokens (7d)
- Rate limiting on auth endpoints
- File upload validation (PDF/DOCX, size limits)
- Role-based access (USER, ADMIN)
- Input validation via class-validator
- CORS restricted to APP_URL

## Infrastructure

| Service    | Dev (Docker Compose) | Production        |
|------------|----------------------|-------------------|
| PostgreSQL | postgres:16          | Managed PG        |
| Redis      | redis:7              | Managed Redis     |
| API        | Node container       | Container/K8s     |
| Frontend   | nginx static         | CDN/nginx         |
| Storage    | Local volume         | AWS S3            |

## External Services

| Service   | Purpose                          |
|-----------|----------------------------------|
| Google AI | CV parsing, job matching         |
| SerpAPI   | Job discovery (Google Jobs)      |
| Resend    | Transactional + digest emails    |
| AWS S3    | CV file storage (prod)           |

## Job Source Strategy

Each provider implements `JobSourceProvider` interface returning normalized `NormalizedJob[]`.
SerpAPI Google Jobs acts as the primary aggregator; provider-specific adapters filter by `source` field.
ATS providers (Greenhouse, Lever, Ashby) use public job board APIs where available.
