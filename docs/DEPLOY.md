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
PAYPAL_CLIENT_ID=<paypal-client-id>
PAYPAL_CLIENT_SECRET=<paypal-client-secret>
PAYPAL_PLAN_ID=<optional-paypal-plan-id>
PAYPAL_LIVE=true
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

### 7. PayPal billing (Hirely Pro — $20/mo)
1. Go to [PayPal Developer Dashboard](https://developer.paypal.com/dashboard/applications) → create an app
2. Copy **Client ID** and **Secret** → `PAYPAL_CLIENT_ID` / `PAYPAL_CLIENT_SECRET`
3. Use **Sandbox** credentials locally (`PAYPAL_LIVE=false`); Live credentials in production (`PAYPAL_LIVE=true`)
4. Optional: create a Billing Plan in PayPal and set `PAYPAL_PLAN_ID` (otherwise Hirely auto-creates a $20/mo plan on first checkout)
5. Webhook (recommended): point to `https://your-api/api/v1/billing/webhook`  
   Events: `BILLING.SUBSCRIPTION.ACTIVATED`, `BILLING.SUBSCRIPTION.CANCELLED`, `BILLING.SUBSCRIPTION.SUSPENDED`, `PAYMENT.SALE.COMPLETED`

Docs: [PayPal Subscriptions](https://developer.paypal.com/docs/subscriptions/)

`jalaa.c.m@gmail.com` is exempt from the paywall. All other users must subscribe before running the agent.

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
API_URL=https://YOUR-RAILWAY-APP.up.railway.app/api/v1
```

**Important:** Set this to your live Railway public URL (not `/api/v1` alone). The build script injects it into the frontend so login and billing call the API directly.

After redeploying Railway, update `API_URL` if the `*.up.railway.app` domain changed. Also update the rewrite destination in `frontend/vercel.json` if you rely on the `/api/v1` proxy fallback.

### 4. Deploy
Click **Deploy**. Note the `*.vercel.app` preview URL and test login.

### 5. Custom domain
1. **Settings** → **Domains** → add `hirelycareeragent.com` and `www.hirelycareeragent.com`
2. Add the DNS records Vercel provides at your registrar

---

## Step 3 — Final checks

- [ ] `https://YOUR-RAILWAY-APP.up.railway.app/api/v1/health` returns `{ "status": "ok" }`
- [ ] `https://hirelycareeragent.com` loads the app
- [ ] Register / login works
- [ ] CV upload works
- [ ] Job search runs
- [ ] Subscription page shows PayPal checkout (or dev activate locally)
- [ ] Verification emails link to `https://hirelycareeragent.com/verify-email?...`

---

## Troubleshooting

### Login shows "Load failed" or "Cannot reach the server"

The frontend cannot reach the NestJS API. Common causes:

1. **Railway service deleted or stopped** — open [railway.app](https://railway.app), redeploy the backend from GitHub, copy the new `*.up.railway.app` URL.
2. **Stale Vercel proxy** — `frontend/vercel.json` rewrites `/api/v1` to Railway. If Railway gave you a new URL, update that file **or** set Vercel env `API_URL` to the full Railway URL and redeploy the frontend.
3. **Health check** — visit `https://YOUR-RAILWAY-URL.up.railway.app/api/v1/health`. If you see `Application not found`, the Railway deployment does not exist.

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
