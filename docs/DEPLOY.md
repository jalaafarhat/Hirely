# Deploy Hirely (Vercel + Railway)

## Architecture

| Service | Platform |
|---------|----------|
| Angular frontend | **Vercel** → hirelycareeragent.com |
| NestJS API | **Railway** → api.hirelycareeragent.com |
| PostgreSQL | **Railway** (plugin) |
| Redis | **Railway** (plugin) or [Upstash](https://upstash.com) |

---

## Step 1 — Railway (backend + database)

### 1. Create project
1. Go to [railway.app/new](https://railway.app/new)
2. **Deploy from GitHub repo** → select `jalaafarhat/Hirely`
3. When the service is created, open **Settings** → **Root Directory** → set to `backend`

### 2. Add PostgreSQL
1. In the project canvas → **+ New** → **Database** → **PostgreSQL**
2. Railway auto-injects `DATABASE_URL` into linked services (link it to the API service if needed)

### 3. Add Redis
1. **+ New** → **Database** → **Redis** (or use Upstash and set `REDIS_URL` manually)

### 4. API environment variables
Open the **backend** service → **Variables** → add:

```
NODE_ENV=production
PORT=3000
JWT_SECRET=<generate-a-long-random-string>
JWT_REFRESH_SECRET=<another-long-random-string>
GOOGLE_API_KEY=<your-gemini-key>
SERPAPI_API_KEY=<your-serpapi-key>
RESEND_API_KEY=<your-resend-key>
EMAIL_FROM=Hirely <noreply@jalaafarhat.com>
APP_URL=https://hirelycareeragent.com
API_URL=https://api.hirelycareeragent.com
CORS_ORIGINS=https://hirelycareeragent.com,https://www.hirelycareeragent.com
```

`DATABASE_URL` and `REDIS_URL` are set automatically if you added Railway plugins.

### 5. Deploy & domain
1. **Deploy** (Railway builds from `backend/Dockerfile`)
2. **Settings** → **Networking** → **Generate Domain** (note the `*.up.railway.app` URL)
3. **Settings** → **Networking** → **Custom Domain** → add `api.hirelycareeragent.com`
4. At your domain registrar, add the CNAME record Railway shows

### 6. Verify
Open `https://api.hirelycareeragent.com/api/v1/health` — should return `{ "status": "ok" }`.

---

## Step 2 — Vercel (frontend)

### 1. Import project
1. Go to [vercel.com/new](https://vercel.com/new)
2. Import `jalaafarhat/Hirely` from GitHub

### 2. Build settings

| Setting | Value |
|---------|--------|
| **Root Directory** | `frontend` |
| **Build Command** | `npm run build` |
| **Output Directory** | `dist/frontend/browser` |
| **Install Command** | `npm install` |

If `dist/frontend/browser` fails, try `dist/frontend` instead.

### 3. Environment variables (Vercel → Settings → Environment Variables)

```
API_URL=https://api.hirelycareeragent.com/api/v1
```

This is injected at build time by `scripts/inject-api-url.mjs`.

### 4. Deploy
Click **Deploy**. Note the `*.vercel.app` preview URL and test login.

### 5. Custom domain
1. **Settings** → **Domains** → add `hirelycareeragent.com` and `www.hirelycareeragent.com`
2. Add the DNS records Vercel provides at your registrar

---

## Step 3 — Final checks

- [ ] `https://hirelycareeragent.com` loads the app
- [ ] Register / login works
- [ ] CV upload works
- [ ] Job search runs
- [ ] Verification emails link to `https://hirelycareeragent.com/verify-email?...`

---

## CLI deploy (optional)

```bash
# Railway
npm i -g @railway/cli
railway login
cd backend
railway link
railway up

# Vercel
npm i -g vercel
cd frontend
vercel login
vercel --prod
```

Set `API_URL` in Vercel dashboard before deploying the frontend.
