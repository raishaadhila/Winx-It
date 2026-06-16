# ✦ Winx It! 🧚‍♀️✨

<p align="center">
  <img src="https://readme-typing-svg.demolab.com?font=Bricolage+Grotesque&weight=800&size=42&duration=3000&pause=1000&color=854B76&center=true&vCenter=true&multiline=true&repeat=false&width=900&height=120&lines=Transform+your+goals+into+magic." alt="Typing SVG" />
</p>
<p align="center">
  <em>A hyper-structured, gamified productivity SaaS where Type A builders transform goals into magical quests.</em>
</p>

<p align="center">
  <img src="https://img.shields.io/badge/Frontend-Vite+%2B+React-854B76?style=for-the-badge&logo=react&logoColor=ffb7e9" />
  <img src="https://img.shields.io/badge/Backend-FastAPI-94f1fb?style=for-the-badge&logo=python&logoColor=006f78" />
  <img src="https://img.shields.io/badge/AI-DeepSeek+via+NVIDIA-ffd7f0?style=for-the-badge&logo=nvidia&logoColor=76b900" />
  <img src="https://img.shields.io/badge/DB-Supabase+b1dd00?style=for-the-badge&logo=supabase&logoColor=4a5e00" />
  <img src="https://img.shields.io/badge/Tests-244+passing-b1dd00?style=for-the-badge&logo=vitest&logoColor=4a5e00" />
</p>

<p align="center">
  <img src="https://komarev.com/ghpvc/?username=winx-it&style=for-the-badge&color=ffb7e9&label=Visitors" />
  <img src="https://img.shields.io/github/stars/raishaadhila/Winx-It?style=for-the-badge&color=ffd7f0" />
  <img src="https://img.shields.io/github/license/raishaadhila/Winx-It?style=for-the-badge&color=94f1fb" />
</p>

---

## 🧚‍♀️ The Transformation

> *"I'm a Type A builder. I want my life organized, but I don't want it to feel like homework."*

**Winx It!** turns raw ambition into structured, executable quests. Type your goal, the AI architect casts it into a day-by-day plan, and you level up your life across **5 magical pillars**:

```
                       ✦  The Winx Pillar Matrix  ✦

                    🔮 Tecna — Engineering & Data
                   💎 Ship code, run benchmarks, build systems

                   🌿 Flora — Health & Wellness
                  ✨ Cardio, neuroscience, body & mind

                    🎵 Musa — Language & Communication
                   🎯 English, journaling, soft skills

                   🌸 Bloom — Leadership & SaaS
                  🔥 Outreach, launches, user growth

                    ☀️ Stella — Balance & Glow-up
                   💫 Cycle, swim, meditate, reflect
```

---

## ⚡ The Magic, in 30 Seconds

```text
   ✦ ① You land on /plan/new
         │
         ▼
   📝 ② You type your quest — "Launch my SaaS in 3 months"
         │
         ▼
   🪄 ③ DeepSeek-via-NVIDIA casts it into a structured plan
         │   (3-step animation: Analyzing → Mapping → Casting)
         │
         ▼
   🏠 ④ Dashboard appears with your quest laid out
         │   • Today's tasks (checkable, +50 XP each)
         │   • Streak tracker
         │   • 5-pillar XP radar
         │   • Active plans grid
         │
         ▼
   ✨ ⑤ You complete a task → confetti 🎉 + XP toast
         │
         ▼
   🦋 ⑥ You level up. You level up. You level up. ✦
```

<p align="center">
  <img src="https://readme-typing-svg.demolab.com?font=Space+Grotesk&weight=600&size=18&duration=2000&pause=800&color=854B76&center=true&vCenter=true&repeat=true&width=600&height=40&lines=Every+task+%3D+%2B50+XP;Every+streak+day+%3D+%2B200+bonus;Every+1000+XP+%3D+a+new+level+%F0%9F%A4%9F" alt="XP Animation" />
</p>

---

## ✨ The Stack

| Layer | What | Why |
|---|---|---|
| 🧚 **Frontend** | Vite + React 19 + TypeScript + Tailwind v3 | Fast HMR, full type safety, beautiful glass UI |
| 🎨 **Design** | Bricolage Grotesque · Plus Jakarta Sans · Space Grotesk | Whimsical Y2K × magic girl aesthetic |
| 🍃 **Backend** | FastAPI + Pydantic v2 | Async, type-safe, OpenAPI auto-generated |
| 🗄️ **Database** | Supabase (Postgres) + Row Level Security | Multi-tenant out of the box |
| 🤖 **AI** | DeepSeek-via-NVIDIA NIM (deepseek-ai/deepseek-v4-flash) | Fast, cheap, structured JSON output |
| 🎯 **State** | Dual-mode: `localStorage` for guests, real API when authed | Works without signup |
| ✅ **Tests** | 244 passing in 30s (Vitest + pytest) | Frontend, backend, DB, LLM — all green |

---

## 🪄 Quickstart

### 🧚‍♀️ Prerequisites

```
✨ Node 20+          ✨ Python 3.12+        🦋 Supabase account
✨ NVIDIA NIM key    ✨ Git                 ✨ A quest worth casting
```

### 🌸 1. Clone & install

```bash
git clone https://github.com/raishaadhila/Winx-It.git
cd Winx-It

# Frontend
cd app && npm install && cd ..

# Backend
cd backend && python3.12 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
```

### 🌿 2. Configure your secrets

```bash
# Backend
cp backend/.env.example backend/.env
# Edit backend/.env — fill in your SUPABASE_* and NVIDIA_API_KEY

# Frontend
cp app/.env.example app/.env
# Edit app/.env — fill in VITE_SUPABASE_* and VITE_API_URL
```

> ✨ **Get your NVIDIA key:** [build.nvidia.com](https://build.nvidia.com) → DeepSeek model → *Get API Key*
> ✨ **Get Supabase:** [supabase.com](https://supabase.com) → New project → Project Settings → API

### 🗄️ 3. Run the schema

Paste `backend/sql/schema.sql` into Supabase's SQL Editor. Creates 5 tables, RLS policies, triggers.

### 🦋 4. Ignite

```bash
# Terminal 1 — backend
cd backend && source .venv/bin/activate
uvicorn app.main:app --reload
# → http://localhost:8000  (docs at /docs)

# Terminal 2 — frontend
cd app
npm run dev
# → http://localhost:5173
```

Open the app → land on the AI Prompt Interface → cast your first quest ✨

---

## 🧚‍♀️ The 5 Pillars, Explained

| Pillar | Fairy | Maps to | What levels it up |
|---|---|---|---|
| 🔮 **Tecna** | The tech genius | Engineering & Data | Code ships, benchmarks, system design |
| 🌿 **Flora** | The healer | Health & Wellness | Cardio, neuroscience, body & mind |
| 🎵 **Musa** | The muse | Communication | English, journaling, soft skills |
| 🌸 **Bloom** | The hero | Leadership & SaaS | Outreach, launches, user growth |
| ☀️ **Stella** | The sun | Balance & Glow-up | Cycle, swim, meditate, reflect |

Each completed task awards **+50 XP** to its pillar. Streaks compound: **+200 × streak day** on your first task each day. Hit **1000 XP** → level up ✨.

---

## 🧪 Testing

```bash
# Frontend (91 tests, ~14s)
cd app && npm test

# Backend (147 unit + 17 integration = 164 tests, ~15s)
cd backend && .venv/bin/pytest
```

```
✨ 244 tests passing
   ├─ 🧚 Frontend: 91 (pure logic + components + page flows)
   ├─ 🔮 Backend: 147 (XP engine, AI planner, API, auth, validation)
   ├─ 🗄️ Real Supabase: 8 (CRUD, RLS, cascade delete, constraints)
   └─ 🤖 Real NVIDIA NIM: 3 + 2 error-handling (auto-skip without key)
```

---

## 🏗️ Architecture

```
┌──────────────────────────────────────────────────────────────────┐
│  BROWSER                                                         │
│  ┌──────────────────────────┐    ┌─────────────────────────┐     │
│  │  Vite + React (SPA)      │    │  Supabase JS client     │     │
│  │  ┌────────────────────┐  │    │  (browser-side auth)    │     │
│  │  │ api.ts dispatcher  │──┼──► │  signIn / OAuth / etc.  │     │
│  │  └─────────┬──────────┘  │    └─────────────────────────┘     │
│  │            ▼             │                                   │
│  │  ┌────────────────────┐  │                                   │
│  │  │ localData.ts       │  │   guest mode: localStorage         │
│  │  │ (localStorage)     │  │   authed mode: HTTP to FastAPI     │
│  │  └────────────────────┘  │                                   │
│  └──────────┬───────────────┘                                   │
└─────────────┼──────────────────────────────────────────────────────┘
              │  HTTP + JWT (when authed)
              ▼
     ┌─────────────────────┐
     │  FastAPI (Python)   │  JWT verify → service key → Supabase
     │  Pydantic v2         │
     └──────────┬──────────┘
                │  OpenAI-compatible REST
                ▼
     ┌─────────────────────┐
     │  NVIDIA NIM          │  deepseek-ai/deepseek-v4-flash
     │  (DeepSeek)          │  response_format=json_schema → plan
     └─────────────────────┘
```

Full architecture: see [`docs/architecture.md`](docs/architecture.md)
Wireframes: see [`docs/wireframes.md`](docs/wireframes.md)

---

## 🗺️ Roadmap

| ✦ | Status | What |
|---|---|---|
| 🧚 | ✨ **Shipped** | AI quest generation via DeepSeek-via-NVIDIA |
| 🧚 | ✨ **Shipped** | 5-pillar XP system with streaks + level-ups |
| 🧚 | ✨ **Shipped** | Guest mode (no signup needed) + authed mode |
| 🧚 | ✨ **Shipped** | Inline-editable plan table, timeline, pillar views |
| 🧚 | ✨ **Shipped** | Confetti, sparkles, glassmorphism, tonal glows |
| 🪄 | 🚧 Next | Notifications, data export, settings page |
| 🦋 | 🌱 Future | Multiplayer streaks · Team quests · Habit library |
| 🔮 | 🌱 Future | Mobile (React Native) · Voice goal entry · Webhooks |

---

## 📜 License

MIT — see [LICENSE](LICENSE).

---

<p align="center">
  <img src="https://readme-typing-svg.demolab.com?font=Bricolage+Grotesque&weight=700&size=24&duration=4000&pause=1500&color=854B76&center=true&vCenter=true&repeat=true&width=700&height=50&lines=Believe+in+your+dream.;Believe+in+yourself.;Always+remember+you+are+stronger+than+you+seem." alt="Believe in yourself" />
</p>

<p align="center">
  <em>✦ Made with sparkles, structure, and the belief that productivity can be magical ✦</em>
</p>

<p align="center">
  <sub>🌸 Bloom · 🔮 Tecna · 🎵 Musa · 🌿 Flora · ☀️ Stella</sub>
</p>
