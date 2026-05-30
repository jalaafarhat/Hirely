# Hirely

AI-powered career agent that automatically searches for jobs, scores matches, and sends personalized daily email digests.

## Tech Stack

- **Frontend:** Angular 20, TailwindCSS, Angular Material, Signals
- **Backend:** NestJS, Prisma, PostgreSQL, Redis, BullMQ
- **AI:** Google Gemini (CV parsing + job matching)
- **Jobs:** SerpAPI Google Jobs (LinkedIn, Indeed, Glassdoor, etc.)
- **Email:** Resend
- **Storage:** AWS S3 (production) / local filesystem (development)

## Quick Start

### Prerequisites

- Node.js 22+
- Docker & Docker Compose

### 1. Start infrastructure

```bash
docker compose up -d postgres redis
```

### 2. Backend

```bash
cd backend
cp ../.env.example .env   # or use the provided .env
npm install
npx prisma migrate dev
npm run prisma:seed
npm run start:dev
```

API runs at `http://localhost:3000/api/v1`

### 3. Frontend

```bash
cd frontend
npm install
npm start
```

App runs at `http://localhost:4200`

### Default Admin

- Email: `admin@hirely.app`
- Password: `Admin123!`

## Environment Variables

See `.env.example` for all configuration options. Key variables:

| Variable | Description |
|----------|-------------|
| `GOOGLE_API_KEY` | Google Gemini for CV analysis & matching |
| `SERPAPI_API_KEY` | Job search via Google Jobs |
| `RESEND_API_KEY` | Transactional & digest emails |
| `JWT_SECRET` | Access token signing key |
| `APP_URL` | Public frontend URL (links in emails) |
| `EMAIL_FROM` | Verified Resend sender address |

## Production (hirelycareeragent.com)

**Website:** https://hirelycareeragent.com

Set these in your production backend environment:

```env
NODE_ENV=production
APP_URL=https://hirelycareeragent.com
API_URL=https://hirelycareeragent.com
EMAIL_FROM=Hirely <noreply@jalaafarhat.com>
CORS_ORIGINS=https://www.hirelycareeragent.com
```

The production frontend build uses `/api/v1` (same domain). Nginx proxies `/api/` to the NestJS backend — see `frontend/nginx.conf`.

If you later verify `hirelycareeragent.com` on Resend, switch `EMAIL_FROM` to `noreply@hirelycareeragent.com`.

Build for production:

```bash
cd frontend && npm run build
cd ../backend && npm run build
```

## Project Structure

```
hirely/
├── backend/          NestJS API
├── frontend/         Angular 20 app
├── docs/             Architecture, API contracts, roadmap
├── docker-compose.yml
└── .github/workflows/
```

## Features

- JWT auth with refresh tokens, email verification, password reset
- CV upload (PDF/DOCX) with AI profile extraction
- Daily job agent (08:00 user timezone)
- AI match scoring with configurable threshold
- Duplicate prevention via SentJobs tracking
- Feedback learning (interested/not interested)
- Daily email digest
- Dashboard with stats widgets
- Jobs page with filters and actions
- Admin panel

## Documentation

- [Architecture](docs/ARCHITECTURE.md)
- [API Contracts](docs/API.md)
- [Implementation Roadmap](docs/ROADMAP.md)

## Docker (Full Stack)

```bash
docker compose up --build
```

## License

MIT
