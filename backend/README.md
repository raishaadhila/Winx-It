# Winx It! — Backend

FastAPI service that powers the Winx It! app. Talks to Supabase (Postgres + Auth) and OpenAI (structured plan generation).

## Quick start

```bash
cd backend
python3.12 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
cp .env.example .env   # fill in Supabase + OpenAI keys
```

### One-time DB setup

Run `sql/schema.sql` against your Supabase project's SQL editor. It creates:

- `profiles` — extends `auth.users` with fairy, pillar, level, XP, streak
- `pillar_xp` — per-pillar XP distribution
- `plans` — user quest plans
- `tasks` — day-by-day tasks (with `done` state)
- `xp_events` — audit log of XP awards
- Triggers: auto-create profile on signup, `updated_at` maintenance
- RLS policies: users can only see/edit their own data

### Run dev server

```bash
uvicorn app.main:app --reload --port 8000
```

Visit http://localhost:8000/docs for the auto-generated OpenAPI UI.

## Architecture

```
Vite SPA  ──bearer JWT──▶  FastAPI  ──service key──▶  Supabase Postgres
   │                          │
   │                          └─openai──▶  GPT-4o-mini (structured JSON)
   │
   └─Supabase Auth (email + Google + GitHub)
```

### Auth flow

1. User signs in via the Vite app against Supabase Auth directly (client-side)
2. Supabase returns a JWT
3. Vite sends the JWT as `Authorization: Bearer <token>` on every API request
4. FastAPI verifies the JWT with `SUPABASE_JWT_SECRET` and extracts the user id
5. The user id scopes all DB queries (RLS enforces this on the DB level too)

### Endpoints

| Method | Path                              | Description                              |
|--------|-----------------------------------|------------------------------------------|
| GET    | `/health`                         | Health check + config status             |
| GET    | `/api/me`                         | Current profile + level/XP/streak        |
| PUT    | `/api/me/avatar`                  | Update fairy / pillar / accent / name    |
| POST   | `/api/plans/generate`             | Generate plan from goal via OpenAI       |
| POST   | `/api/plans`                      | Persist a generated plan + tasks         |
| GET    | `/api/plans`                      | List user's plans (with progress)        |
| GET    | `/api/plans/{id}`                 | Plan detail with all tasks               |
| PATCH  | `/api/plans/{id}`                 | Rename, archive, pause, etc.             |
| DELETE | `/api/plans/{id}`                 | Delete plan                              |
| POST   | `/api/plans/{id}/tasks`           | Add a task                               |
| PATCH  | `/api/plans/{id}/tasks/{taskId}`  | Inline-edit a task (description, hours…) |
| DELETE | `/api/plans/{id}/tasks/{taskId}`  | Delete a task                            |
| POST   | `/api/plans/{id}/tasks/{taskId}/complete` | Mark done → awards XP + streak    |

### XP rules

- **+50 XP** per task completion
- **+200 × streak_day** bonus per day (so day 1 = 200, day 7 = 1400, etc.)
- **Level up** every 1000 XP
- Pillar XP mirrors task XP for radar chart stats

### Dev fallback

If neither `OPENAI_API_KEY` nor `DEEPSEEK_API_KEY` is set, the planner returns a small stub plan (3 weeks, cycling pillars) so the rest of the app stays exercisable. Same goes for missing Supabase keys — the service returns `503` on DB writes but `/health` still works.

### LLM provider selection

The planner picks the active LLM in this order:

1. `DEEPSEEK_API_KEY` if set (uses `DEEPSEEK_BASE_URL`, defaults to `https://api.deepseek.com`)
2. `OPENAI_API_KEY` otherwise

You can confirm the active provider via `GET /health` → `active_llm` field.
