# Winx It! — Architecture

```
┌──────────────────────────────────────────────────────────────────┐
│  BROWSER                                                         │
│                                                                  │
│  ┌──────────────────────────┐    ┌─────────────────────────┐    │
│  │  Vite + React (SPA)      │    │  Supabase JS client     │    │
│  │  Routes / Pages /        │    │  (browser-side auth)    │    │
│  │  Components              │    │                         │    │
│  │  ┌────────────────────┐  │    │  signIn / signUp /      │    │
│  │  │  api.ts dispatcher  │──┼──┐ │  signInWithOAuth /      │    │
│  │  └────────────────────┘  │  │ │  resetPassword /        │    │
│  │  ┌────────────────────┐  │  │ │  onAuthStateChange       │    │
│  │  │  localData.ts       │  │  │ └─────────────────────────┘    │
│  │  │  (localStorage      │  │  │                                  │
│  │  │   fallback)         │  │  │                                  │
│  │  └────────────────────┘  │  │                                  │
│  └──────────────────────────┘  │                                  │
│                                │                                  │
│              HTTP + JWT ───────┼────►  FastAPI (Python)          │
│                                │                                  │
└────────────────────────────────┼──────────────────────────────────┘
                                 │
                                 │  service_role key
                                 ▼
                       ┌─────────────────────┐
                       │  Supabase           │
                       │  Postgres + Auth    │
                       └─────────────────────┘
                                 ▲
                                 │  REST (structured outputs)
                                 │
                       ┌─────────────────────┐
                       │  DeepSeek / OpenAI  │
                       └─────────────────────┘
```

---

## Frontend (`/app`)

**Stack:** Vite 8 + React 19 + TypeScript + Tailwind v3 + Framer Motion + Recharts + canvas-confetti + Supabase JS

### Folder layout

```
app/src/
├── main.tsx                     ← entry: mounts <App />
├── App.tsx                      ← providers + router
├── index.css                    ← Tailwind base + design-system utilities
│
├── lib/
│   ├── api.ts                   ← typed client; dispatches to backend or local
│   ├── localData.ts             ← localStorage fallback (plans, stats, profile)
│   ├── supabase.ts              ← Supabase JS init
│   ├── types.ts                 ← TS mirror of backend Pydantic models
│   ├── useApi.ts                ← tiny data-fetching hook
│   ├── validation.ts            ← isValidEmail, passwordStrength
│   └── cn.ts                    ← clsx wrapper
│
├── contexts/
│   ├── AuthContext.tsx          ← Supabase session + signIn/Up/OAuth
│   ├── ProfileContext.tsx       ← /api/me cache + applyLocal() for snappy updates
│   └── ToastContext.tsx         ← spring-animated toast queue
│
├── components/
│   ├── AmbientBackground.tsx    ← drifting pink/blue/lime halo + sparkles
│   ├── Avatar.tsx               ← Winx fairy avatar (48/64/128)
│   ├── BorderBeam.tsx           ← magicui-style perimeter beam (unused but available)
│   ├── Button.tsx               ← primary / outline / ghost pill variants
│   ├── Chip.tsx                 ← 5-color toggle chip
│   ├── Confetti.tsx             ← canvas-confetti wrapper
│   ├── GlassCard.tsx            ← level 1/2/3 glass surface
│   ├── Input.tsx                ← borderless rounded-2xl field
│   ├── PasswordStrengthMeter.tsx
│   ├── PillBadge.tsx            ← pillar-colored badge for tasks
│   ├── ProtectedRoute.tsx       ← legacy; no longer wraps app routes
│   ├── RadarStats.tsx           ← 5-axis Recharts radar
│   ├── Skeleton.tsx             ← shimmer placeholders
│   ├── SparkleField.tsx         ← ambient 4-point stars
│   ├── Textarea.tsx
│   ├── TopNav.tsx               ← sticky glass nav, "Sign in" or avatar menu
│   └── VelocityChart.tsx        ← Recharts bar chart
│
└── pages/
    ├── LoginPage.tsx            ← email/pwd + OAuth + reset
    ├── AvatarPickerPage.tsx     ← 6-fairy selector
    ├── PromptPage.tsx           ← /plan/new — text + chips → generate
    ├── PlanEditorPage.tsx       ← /plan/:id — table / timeline / pillars
    └── DashboardPage.tsx        ← /dashboard — hero + today + radar + plans
```

### Data flow (no auth, current default)

```
   /                  ──►  PromptPage
                          │
                          │  api.plans.generate({goal, timeframe, ...})
                          ▼
                       api.ts
                          │
                          │  isAuthed() → false
                          ▼
                       localData.generateLocalPlan()
                          │   • 28-day stub across chosen pillars
                          │   • title from first sentence of goal
                          │   • start_date = today
                          ▼
                       api.plans.create({title, start_date, end_date, tasks})
                          │
                          │  isAuthed() → false
                          ▼
                       localData.create()
                          │   • generates UUIDs
                          │   • localStorage.setItem('winx-it:local-plans', ...)
                          ▼
                       nav('/dashboard')
                          ▼
                       DashboardPage
                          │  api.plans.list()      → localStorage
                          │  api.tasks.list(planId) → localStorage
                          │  api.me.get()           → local profile from localStorage
                          ▼
                       Renders: hero XP, today's quest, streak, radar, active plans
```

### Data flow (with Supabase auth)

```
   LoginPage          ──►  supabase.auth.signInWithPassword({email, pwd})
                          │
                          ▼
                       supabase.auth.onAuthStateChange() fires
                          │
                          ▼
                       AuthContext.session  =  Session
                       ProfileContext.refetch()  ──►  api.me.get()
                                                          │
                                                          │  isAuthed() → true
                                                          ▼
                                                       HTTP GET /api/me
                                                       Authorization: Bearer <jwt>
                                                          │
                                                          ▼
                                                       FastAPI verifies JWT,
                                                       returns profile from Postgres
```

---

## Backend (`/backend`)

**Stack:** FastAPI 0.115 + Pydantic v2 + supabase-py + openai SDK + python-jose

### Folder layout

```
backend/
├── app/
│   ├── main.py                  ← FastAPI app + CORS + /health + router includes
│   ├── core/
│   │   ├── config.py            ← pydantic-settings: env-driven config
│   │   └── security.py          ← JWT verification (Supabase HS256)
│   ├── db/
│   │   └── supabase.py          ← admin client (service key) + per-user client
│   ├── schemas/
│   │   └── models.py            ← 14 Pydantic models (request/response)
│   ├── services/
│   │   ├── ai_planner.py        ← OpenAI/DeepSeek structured-output generation
│   │   └── xp_engine.py         ← XP award + streak update + level calc
│   └── api/
│       ├── me.py                ← GET /api/me, PUT /api/me/avatar
│       ├── plans.py             ← plan CRUD + generate
│       └── tasks.py             ← task CRUD + complete (auto XP)
│
├── sql/
│   └── schema.sql               ← 5 tables, RLS, triggers, grants
│
├── requirements.txt
├── .env.example
└── README.md
```

### Request lifecycle (authenticated)

```
   HTTP POST /api/plans
   Authorization: Bearer eyJ...
   Body: { title, goal_text, start_date, end_date, tasks: [...] }
                          │
                          ▼
                   FastAPI middleware
                          │
                          ▼
                   get_current_user()  ←  app/core/security.py
                          │
                          │  python-jose decodes HS256 with SUPABASE_JWT_SECRET
                          │  validates aud="authenticated"
                          │  extracts sub=<user_id> from claims
                          ▼
                   plans.create()  ←  app/api/plans.py
                          │
                          │  supabase_admin.table("plans").insert({user_id, ...})
                          ▼
                   Postgres (Supabase)
                          │
                          │  RLS policy: auth.uid() = user_id  ✓ pass
                          ▼
                   5 tasks inserted
                          │
                          ▼
                   PlanOut returned
                          │
                          ▼
                   JSON 201 response
```

### AI plan generation

```
   POST /api/plans/generate
   Body: { goal: "Build a SaaS MVP in 3 months",
           timeframe: "3 months",
           pillars: ["tecna", "bloom", "stella"] }
                          │
                          ▼
                   ai_planner.generate_plan()
                          │
                          │  _days_for(timeframe) → 90
                          │  system_prompt: "You are Winx It!'s quest architect..."
                          │  user_prompt: "GOAL: ...  TIMEFRAME: ...  PILLARS: ..."
                          ▼
                   OpenAI / DeepSeek  (response_format=json_schema)
                          │
                          │  model returns JSON matching Pydantic schema
                          │  → { title, start_date, end_date, tasks: [{day, week,
                          │       month, date, description, pillar, hours, energy}] }
                          ▼
                   GeneratedPlan validated
                          │
                          ▼
                   Returned to client (not yet persisted)
```

If `OPENAI_API_KEY` and `DEEPSEEK_API_KEY` are both unset → returns a 21-task stub so the UI still works.

### XP engine

```
   POST /api/plans/<id>/tasks/<task_id>/complete
                          │
                          ▼
                   tasks.complete_task()
                          │
                          │  1. mark task done=true, completed_at=now
                          │  2. call xp_engine.award_task_completion()
                          │     │
                          │     │  a. +50 XP to total_xp
                          │     │  b. +50 XP to pillar_xp[task.pillar]
                          │     │  c. streak logic:
                          │     │     - same day    → no streak change, no bonus
                          │     │     - next day   → streak++, bonus = 200 × streak
                          │     │     - gap > 1d   → streak reset to 1
                          │     │  d. level = floor(total_xp / 1000) + 1
                          │     │  e. longest_streak = max(longest, current)
                          │     │  f. write back to profiles
                          │     │  g. insert audit rows in xp_events
                          │     ▼
                          │  returns { xp_awarded, streak_bonus, new_total_xp,
                          │           new_level, leveled_up, streak }
                          ▼
                   TaskCompleteResponse → client
                          │
                          ▼
                   Frontend: applyLocal({ total_xp, level, current_streak })
                   + toast("+50 XP earned ✦")
                   + confetti burst (2s)
```

---

## Database (Supabase Postgres)

```
   auth.users                 ← Supabase Auth manages this
        │  1:1
        ▼
   profiles                   ← extends auth.users with app fields
        │  1:1
        ▼
   pillar_xp                  ← per-pillar XP distribution

   profiles                   │
        │  1:N                │
        ▼                     │
   plans                      │
        │  1:N                │
        ▼                     │
   tasks  ◄── done=true triggers xp_engine on backend
        │
        │  (audit log, not referenced by client)
        ▼
   xp_events
```

RLS policies: every table has `auth.uid() = user_id` (or `= id`), enforced at the DB level. The service_role key bypasses RLS — used by FastAPI for trusted writes; never exposed to the browser.

---

## Dual-mode frontend (current state)

| Aspect | Authed mode | Guest mode |
|---|---|---|
| Session source | Supabase JWT in `Authorization` header | None — api dispatcher detects `isAuthed() === false` |
| Data source | FastAPI → Postgres | `localData.ts` → `localStorage` |
| XP engine | `app/services/xp_engine.py` (server) | `applyTaskComplete()` in `localData.ts` (client) |
| AI generation | Real OpenAI/DeepSeek call | Local 28-day stub across chosen pillars |
| Profile avatar | From `profiles` row | Default `Raisha / Tecna / blue` (editable) |
| Persistence | Postgres (survives devices) | `localStorage` per-browser |

**Switching is transparent** — the page code calls `api.foo()` and gets the same `Profile` / `Plan` / `Task` shape back. The only observable difference is which storage layer the data comes from.

---

## Where to add new things

| I want to add… | Touch these files |
|---|---|
| A new API endpoint | `backend/app/api/<x>.py` + add to `main.py` |
| A new Pydantic model | `backend/app/schemas/models.py` + mirror in `app/src/lib/types.ts` |
| A new LLM-driven feature | `backend/app/services/<feature>.py` (mirror the `ai_planner.py` pattern) |
| A new frontend page | `app/src/pages/<X>Page.tsx` + add route in `App.tsx` |
| A new shared component | `app/src/components/<X>.tsx` (use Tailwind + `cn()` for styling) |
| A new toast variant | Edit `ToastVariant` in `contexts/ToastContext.tsx` |
| A new XP rule | `backend/app/services/xp_engine.py` (server) **and** `localData.ts → applyTaskComplete()` (client) — keep them in sync |
