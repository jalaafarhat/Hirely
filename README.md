# Hirely

AI-powered career agent that searches jobs, scores matches against your CV, and sends personalized email digests.

**Live:** [hirelycareeragent.com](https://hirelycareeragent.com)

---

## What it does

1. **Upload your CV** — PDF or DOCX; Gemini extracts skills, experience, and preferences.
2. **Set job preferences** — roles, locations, remote/hybrid, digest schedule.
3. **Run the agent** — searches SerpAPI Google Jobs plus company career boards (Amazon, Microsoft, NVIDIA, Apple, Meta, and others).
4. **Get matched jobs** — AI scoring with duplicate detection and feedback learning.
5. **Receive digests** — scheduled emails via Resend when new strong matches appear.

---

## Architecture

```mermaid
flowchart LR
  User[Browser / Mobile] --> Vercel[Vercel — Angular]
  Vercel -->|API requests| Railway[Railway — NestJS]
  Railway --> Postgres[(PostgreSQL)]
  Railway --> Redis[(Redis / BullMQ)]
  Railway --> Gemini[Google Gemini]
  Railway --> SerpAPI[SerpAPI Jobs]
  Railway --> Resend[Resend Email]
```

| Layer | Stack | Production |
|-------|--------|------------|
| Frontend | Angular 20, TailwindCSS, Signals | [Vercel](https://vercel.com) |
| Backend | NestJS, Prisma, BullMQ | [Railway](https://railway.app) |
| Database | PostgreSQL | Railway |
| Queue | Redis | Railway |
| AI | Google Gemini | API |
| Jobs | SerpAPI + company boards | API |
| Email | Resend | API |

---

## Features

- JWT auth — register, login, refresh tokens, email verification, password reset
- CV upload and AI profile extraction
- Editable profile and job preferences
- Manual and scheduled job agent runs
- AI match scoring (configurable threshold)
- Company career board search
- Saved / hidden / applied job tracking
- Feedback learning (interested / not interested)
- Email digests on a user-defined schedule
- Dashboard, jobs list, settings, admin panel
- Responsive layout and PWA basics (mobile-friendly)

---

## Quick start (local)

### Prerequisites

- **Node.js** 22.12+ (Angular 20 requirement)
- **Docker** & Docker Compose
- API keys: [Google AI](https://aistudio.google.com/apikey), [SerpAPI](https://serpapi.com), [Resend](https://resend.com)

### 1. Clone and configure

```bash
git clone https://github.com/jalaafarhat/Hirely.git
cd Hirely
cp .env.example backend/.env
```

Edit `backend/.env` with your API keys. For Docker Compose, use:

```env
DATABASE_URL=postgresql://hirely:hirely@localhost:5433/hirely
REDIS_URL=redis://localhost:6380
APP_URL=http://localhost:4200
API_URL=http://localhost:3000
EMAIL_FROM=Hirely <noreply@your-verified-domain.com>
```

### 2. Start Postgres and Redis

```bash
docker compose up -d postgres redis
```

### 3. Backend

```bash
cd backend
npm install
npx prisma migrate dev
npm run prisma:seed
npm run start:dev
```

API: `http://localhost:3000/api/v1`  
Health: `http://localhost:3000/api/v1/health`

### 4. Frontend

```bash
cd frontend
npm install
npm start
```

App: `http://localhost:4200`

**Mobile on same Wi‑Fi:** `npx ng serve --host 0.0.0.0` — the app auto-detects your PC's LAN IP for API calls.

### Default admin (after seed)

| Field | Value |
|-------|--------|
| Email | `admin@hirely.app` |
| Password | `Admin123!` |

---

## Environment variables

See [`.env.example`](.env.example). Key variables:

| Variable | Description |
|----------|-------------|
| `DATABASE_URL` | PostgreSQL connection string |
| `REDIS_URL` | Redis for BullMQ job queue |
| `JWT_SECRET` / `JWT_REFRESH_SECRET` | Auth token signing |
| `GOOGLE_API_KEY` | Gemini — CV parsing and job matching |
| `SERPAPI_API_KEY` | Aggregated job search |
| `RESEND_API_KEY` | Transactional and digest email |
| `EMAIL_FROM` | Verified sender on Resend (e.g. `Hirely <noreply@jalaafarhat.com>`) |
| `APP_URL` | Public frontend URL (used in email links) |
| `CORS_ORIGINS` | Allowed browser origins (production) |
| `JOB_MATCH_THRESHOLD` | Minimum match score (default `75`) |

---

## Production deployment

Hirely runs fully in the cloud — no local machine required after deploy.

| Service | Host |
|---------|------|
| Frontend | **Vercel** → `hirelycareeragent.com` |
| API | **Railway** → `*.up.railway.app` |
| Postgres & Redis | **Railway** |

**Vercel settings (monorepo):**

| Setting | Value |
|---------|--------|
| Root Directory | `frontend` |
| Build Command | `npm run build` |
| Output Directory | `dist/frontend/browser` |
| Env `API_URL` | Your Railway API base URL + `/api/v1` |

The frontend build injects `API_URL` via `frontend/scripts/inject-api-url.mjs`. Vercel can also proxy `/api/v1/*` to Railway (see `frontend/vercel.json`).

Full step-by-step guide: **[docs/DEPLOY.md](docs/DEPLOY.md)**

---

## Project structure

```
Hirely/
├── backend/                 NestJS API
│   ├── src/                 Modules: auth, cv, jobs, agent, email, …
│   ├── prisma/              Schema and migrations
│   ├── Dockerfile           Production container
│   └── railway.toml         Railway deploy config
├── frontend/                Angular 20 SPA
│   ├── src/app/             Features, core services, layout
│   ├── public/              Icons, PWA manifest
│   ├── scripts/             Build-time API URL injection
│   └── vercel.json          SPA routing + API proxy
├── docs/                    Architecture, API, deploy, roadmap
├── docker-compose.yml       Local Postgres, Redis, optional full stack
└── .github/workflows/       CI
```

---

## Scripts

**Backend** (`backend/`)

| Command | Description |
|---------|-------------|
| `npm run start:dev` | Dev server with hot reload |
| `npm run build` | Compile for production |
| `npm run start:prod` | Run compiled app |
| `npx prisma migrate dev` | Apply migrations (dev) |
| `npm run prisma:seed` | Seed admin user |

**Frontend** (`frontend/`)

| Command | Description |
|---------|-------------|
| `npm start` | Dev server (`localhost:4200`) |
| `npm run build` | Production build (injects `API_URL`) |

**Docker (full stack)**

```bash
docker compose up --build
```

---

## Documentation

- [Architecture](docs/ARCHITECTURE.md)
- [API contracts](docs/API.md)
- [Deployment guide](docs/DEPLOY.md)
- [Roadmap](docs/ROADMAP.md)

---

## License

[MIT](LICENSE)
