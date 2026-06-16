# Deploy to Vercel

The whole monorepo — Vite frontend + FastAPI backend — deploys as **one
Vercel project** via a monorepo config in [vercel.json](../vercel.json).

## Architecture

```
                          https://winx-it.vercel.app
                                       │
            ┌──────────────────────────┴──────────────────────────┐
            │                                                     │
     /api/* (rewrites)                                     everything else
            │                                                     │
            ▼                                                     ▼
  ┌───────────────────────┐                          ┌──────────────────────┐
  │  @vercel/python       │                          │  @vercel/static-build │
  │  (Mangum + FastAPI)   │                          │  (Vite output:        │
  │                       │                          │   app/dist)           │
  │  backend/             │                          │                       │
  │  vercel_index.py      │                          │  HTML/CSS/JS          │
  │  → app.main:app       │                          │  + SPA fallback       │
  └───────────────────────┘                          └──────────────────────┘
            │                                                     │
            ▼                                                     │
       NVIDIA NIM, Supabase  ←──────────────────────  VITE_API_URL=/api
```

- **`/api/*`** → Python serverless function (FastAPI wrapped in Mangum)
- **everything else** → static frontend (`app/dist`)

The frontend's `VITE_API_URL=/api` makes all API calls **same-origin**,
so the browser doesn't trigger CORS preflight. The backend's CORS
middleware is still configured (for non-browser clients / local dev).

## One-time setup

### 1. Get your Supabase project

1. Create a project at [supabase.com](https://supabase.com).
2. Run [`backend/sql/schema.sql`](../backend/sql/schema.sql) in
   **SQL Editor** (creates 5 tables + RLS policies + trigger).
3. **Project Settings → API** — copy:
   - `SUPABASE_URL`
   - `SUPABASE_ANON_KEY`
   - `SUPABASE_SERVICE_KEY` (the `service_role` secret, server-only)
   - `SUPABASE_JWT_SECRET`
4. **Authentication → URL Configuration** — add
   `https://<your-vercel-app>.vercel.app/dashboard` to the redirect
   allowlist.
5. **Authentication → Providers** — enable Google and/or GitHub OAuth
   and paste the client id/secret from each provider's console.

### 2. Get your NVIDIA NIM key

1. Go to [build.nvidia.com](https://build.nvidia.com).
2. Pick any **DeepSeek** model → **Get API Key**.
3. Copy the `nvapi-…` value.

### 3. Connect Vercel to GitHub

1. Sign in to [vercel.com](https://vercel.com).
2. **Add New Project** → import `raishaadhila/Winx-It`.
3. **Framework Preset**: *Other* (we ship a custom `vercel.json`).
4. **Root Directory**: leave blank (we use the repo root).
5. **Build & Output Settings**: leave defaults — `vercel.json` drives them.
6. **Environment Variables** — paste the values from steps 1 & 2
   (see [the table below](#environment-variables)).

### 4. Deploy

Click **Deploy**. The first build takes ~2 minutes. Once it's green:

- Frontend: `https://<your-app>.vercel.app`
- API: `https://<your-app>.vercel.app/api/health`

## Environment variables

Set these in Vercel → **Project → Settings → Environment Variables**.

### Frontend (build-time, Vite)

| Name | Value | Scope |
|---|---|---|
| `VITE_API_URL` | `/api` | Production, Preview |
| `VITE_SUPABASE_URL` | `https://<ref>.supabase.co` | Production, Preview |
| `VITE_SUPABASE_ANON_KEY` | `<anon public key>` | Production, Preview |

### Backend (runtime, Python)

| Name | Value | Scope |
|---|---|---|
| `SUPABASE_URL` | `https://<ref>.supabase.co` | Production |
| `SUPABASE_ANON_KEY` | `<anon public key>` | Production |
| `SUPABASE_SERVICE_KEY` | `<service_role key>` | Production |
| `SUPABASE_JWT_SECRET` | `<JWT secret>` | Production |
| `NVIDIA_API_KEY` | `nvapi-…` | Production |
| `NVIDIA_MODEL` | `deepseek-ai/deepseek-v4-flash` | Production |
| `NVIDIA_BASE_URL` | `https://integrate.api.nvidia.com/v1` | Production |
| `CORS_ORIGINS` | `https://<your-app>.vercel.app,http://localhost:5173` | Production |
| `ENVIRONMENT` | `production` | Production |

**Pro tip:** Use Vercel's "Sensitive" flag on `SUPABASE_SERVICE_KEY`,
`SUPABASE_JWT_SECRET`, and `NVIDIA_API_KEY`.

## Build & runtime behavior

- **Frontend** — `@vercel/static-build` runs `npm run build` in `app/`,
  outputs to `app/dist`. Vercel serves the bundle + does the
  client-side routing fallback to `index.html` for SPA routes.

- **Backend** — `@vercel/python` bundles `backend/` (incl.
  `requirements.txt` and the `app/` package) into a Lambda-compatible
  function. `backend/vercel_index.py` wraps the FastAPI app in
  Mangum. Vercel sets `maxDuration: 60s` per request; **this requires
  the Vercel Pro plan** — on Hobby you're capped at 10s and the LLM
  generation endpoint can timeout on slow NVIDIA days.

## LLM timeout: Hobby vs Pro

| Plan | Function timeout | Realistic for `POST /api/anon/plans/generate` |
|---|---|---|
| Hobby (free) | 10s | Tight. DeepSeek is usually 3–8s but can spike. |
| Pro | 60s | Comfortable. |

`vercel.json` sets `maxDuration: 60` on the Python build — Vercel
silently caps it to 10s on Hobby, so the value is harmless on free
tier. If you regularly hit timeouts on Hobby, the alternatives are:

- **Upgrade to Pro** — simplest.
- **Render / Railway** for the backend only — 30s+ on free tiers,
  no Vercel function overhead. Point `VITE_API_URL` at the new
  backend URL. The frontend stays on Vercel.
- **Background-job pattern** — split the LLM call into
  `POST /api/anon/plans/generate` (returns a job id immediately) and
  `GET /api/anon/plans/jobs/:id` (polls). Requires backend changes.

## Local dev vs production

The deployment config doesn't change local dev. Continue to:

```bash
# Terminal 1
cd backend && .venv/bin/uvicorn app.main:app --reload

# Terminal 2
cd app && npm run dev
```

`VITE_API_URL` defaults to `http://localhost:8000` for local dev (the
example file has `/api` — for local dev, override with
`VITE_API_URL=http://localhost:8000` in `app/.env`).

## Common Vercel failures

| Symptom | Cause | Fix |
|---|---|---|
| `404` on `/api/*` | `vercel.json` paths wrong | Re-check rewrites section. |
| `500` on Python build | `requirements.txt` import error | Check Vercel build log; usually a missing dep. |
| `CORS` errors in browser | `CORS_ORIGINS` missing the Vercel domain | Add `https://<your-app>.vercel.app` to `CORS_ORIGINS`. |
| LLM timeout on Hobby | 10s cap | Upgrade to Pro or move backend to Render/Railway. |
| `OPENAI` env error | `OPENAI_API_KEY` leaked from old config | Make sure you don't have stray `OPENAI_*` vars. |

## Architecture notes

- **Why one Vercel project, not two?** Monorepo is simpler — one
  domain, one set of env vars, one CI run. The Vercel project map
  would split if the two apps needed different release cadences.
- **Why a Python function, not Edge?** Edge Functions cap at 1ms
  CPU and don't support `openai` / `supabase` properly. Python serverless
  is the right shape.
- **Why Mangum?** It's the canonical ASGI→Lambda adapter. Vercel's
  Python runtime is Lambda-compatible; Mangum is the bridge.
- **Why `lifespan="off"`?** Vercel functions are stateless — there's
  no startup/shutdown cycle to manage. Disabling lifespan avoids
  noise in the cold-start path.
- **Why `api_gateway_base_path="/api"`?** Vercel routes `/api/me` to
  the function; without this, Mangum would pass `/api/me` to FastAPI
  which only has routes registered at `/me`.

## What this deployment doesn't include

- **Custom domain** — add one in Vercel → **Project → Settings →
  Domains**. Don't forget to also add it to Supabase's
  redirect-allowlist and to `CORS_ORIGINS`.
- **CDN caching of the API** — every API request is a cold Lambda
  invocation. If you want caching, consider Cloudflare in front.
- **Background workers** — the `ai-real-llm` CI job (real NVIDIA
  integration test) is still triggered via GitHub Actions
  `workflow_dispatch`, not Vercel. Vercel doesn't host long-running
  workers.
- **CI** — the existing GitHub Actions workflow in
  `.github/workflows/ci.yml` continues to run on every push, testing
  both apps before deploy. Vercel deploys on every push to `master`.

## Next steps after first deploy

1. Smoke-test the production URL:
   `curl https://<your-app>.vercel.app/api/health` — should return
   `{"status": "ok", ...}` with `nvidia_configured: true` once
   the env var is set.
2. Sign up via the Google OAuth button on the deployed frontend.
3. Generate a plan and check the dashboard for XP.
4. Set up a custom domain.
5. Enable Vercel Analytics (free) to watch page performance.
