# Winx It! — Core App Wireframes

**Source of truth:** `/DESIGN.md` (palette, type, motion language)
**Framework:** Vite + React (SPA) · Tailwind v3 · Framer Motion
**Mode:** Light only · Light mode per spec
**Breakpoints:** Mobile <600px · Tablet 600–1024px · Desktop >1020px (max content 1440px)

> **Scope note:** Auth (login / signup / password reset) and avatar onboarding are implemented as thin wrappers over Supabase Auth and live in the codebase, but are intentionally de-prioritized in the design — the core product is the quest transformation pipeline below.

---

## Global Layout Primitives

```
┌──────────────────────────────────────────────┐
│  [Ambient backdrop: pink → blue → lime halo] │  ← fixed, slow drift
│                                              │
│   ┌────────────────────────────────────┐     │
│   │   FLOATING GLASS PANEL             │     │  ← 16px radius, soft shadow
│   │   backdrop-blur 12–20px            │     │     no border, no harsh edge
│   │   ✦ corner sparkles on hover       │     │
│   │                                    │     │
│   └────────────────────────────────────┘     │
│                                              │
│  [Top nav: logo · streak chip · avatar menu] │
└──────────────────────────────────────────────┘
```

**Container rules**
- Min 24px outer margin · cards float, never edge-to-edge
- Max content 1440px desktop · 16px gutter mobile
- Mobile: 1-col · Tablet: 2-col masonry · Desktop: 12-col fluid

**Type & color tokens** — see `DESIGN.md` § Colors / § Typography for the full spec.

---

# Screen 1 — AI Prompt Interface

**Route:** `/plan/new` · primary CTA from dashboard
**Purpose:** Capture user intent and have the AI cast it into a structured plan.

```
  ┌─ Top Nav:  ✦ Winx It!        [streak] [avatar] ┐

            ✦        What's your quest?        ✦
            Tell us your goal. We'll transform
            it into a structured adventure.

            ┌─────────────────────────────────────┐
            │                                     │
            │  E.g. "Set up Month 2 focusing on  │
            │  Medical Neuroscience modules and   │
            │  AI Brain Tumor dataset cleanups."  │
            │                                     │
            └─────────────────────────────────────┘

            Timeframe:   [ 1 month ] [ 3 months ] [ 6 months ] [ custom ]
            Energy focus: [ 🧠 deep ] [ 💪 physical ] [ ✨ creative ]
            Pillars:       [✓ Tecna] [✓ Flora] [✓ Musa] [ Bloom] [ Stella]

            [   ✦  Generate my plan   ]
```

**Inventory:** `TopNav` · `Textarea` · `Chip` group × 3 · `Button` primary · `Toast` on error

**States:** empty · typing · valid · invalid (soft red tint, no ring) · generating (3-step spinner: "Analyzing → Mapping → Casting") · success → `/plan/:id` · error toast

**Mobile:** chips wrap, textarea full-width, sticky submit

---

# Screen 2 — Structured Results + Inline Editor

**Route:** `/plan/:id`
**Purpose:** Show the AI-generated plan; let the user fine-tune inline; award XP on task complete.

```
  ┌─ Top Nav ────────────────────────────────────────┐

  ← Back to plans      Plan: "Month 2 Neuroscience"  ✎
  [ Table ]  [ Timeline ]  [ Pillars ]      💾 Save

  ┌──────────┬──────────┬─────────┬───────────────────────────┬─────────┐
  │  Done    │ Day/Week │ Date    │ Task                     │ Pillar  │
  ├──────────┼──────────┼─────────┼───────────────────────────┼─────────┤
  │  ✓       │ D1 W1    │ Mon 2/1 │ Read neuro mod 1         │ Flora   │
  │  ✓       │ D1 W1    │ Mon 2/1 │ Dataset prep             │ Tecna   │
  │  ○       │ D2 W1    │ Tue 2/2 │ Code review              │ Tecna   │
  │  ○       │ D2 W1    │ Tue 2/2 │ English podcast          │ Musa    │
  │  ...     │ ...      │ ...     │ ...                       │ ...     │
  └──────────┴──────────┴─────────┴───────────────────────────┴─────────┘
  [ + Add task ]   [ ✦ Regenerate ]   [ ✓ Mark day complete ]
```

**Inventory:** `PlanHeader` · `TabBar` · `DataTable` (inline-editable cells) · `PillBadge` · `Button` × 3 · `Toast` · `Confetti` on day-complete

**Inline editor states:** default · hover (subtle highlight) · focus (cell becomes input) · saving (light dim) · saved (✦ spark) · error (rollback + toast)

**Behaviors**
- Click any cell → in-place edit · `Enter` commits, `Esc` reverts
- Task complete → optimistic `done=true` + POST `/complete` → on success, apply XP to profile, fire confetti + XP toast
- `Regenerate` → calls `/api/plans/generate` with the existing goal context
- `Mark day complete` → confetti burst (2s) + XP awarded

**Mobile:** rows become stacked cards · edit opens full-screen sheet · sticky bottom bar

---

# Screen 3 — Gamified Profile Dashboard

**Route:** `/dashboard` · default landing after auth
**Purpose:** At-a-glance status: who you are, what you did today, how your pillars are growing, what plans are active.

```
  ┌─ Top Nav:  ✦ Winx It!   [streak] [avatar menu] ┐

  ┌── HERO PANEL ─────────────────────────────────────┐
  │  [Avatar]  Welcome back, Raisha ✦                 │
  │            Level 7 · 2,430 XP total               │
  │  XP: [▓▓▓▓▓▓▓▓░░░░] 730/1000 to L8                │
  └───────────────────────────────────────────────────┘

  ┌── TODAY (8 col) ──────────────┐  ┌── STREAK (4 col) ───┐
  │ ✦ Today's Quest               │  │  🔥 7 day streak    │
  │                               │  │  ▓▓▓▓▓▓▓░░ 7/30     │
  │ ☐ Read neuro mod 1   Flora    │  │  Longest: 14        │
  │ ☐ Dataset prep        Tecna    │  │                     │
  │ ☐ English podcast     Musa     │  │  Last 7 days:        │
  │ ☐ Cardio 30min        Stella   │  │  ▣ ▣ ▣ ▣ ▣ ▣ ▣      │
  │                               │  │                     │
  │ [ ✓ Mark all complete ]       │  │                     │
  └───────────────────────────────┘  └─────────────────────┘

  ┌── 5-PILLAR RADAR (6 col) ────┐  ┌── VELOCITY (6 col) ──┐
  │         Tecna                │  │  ▓                   │
  │           ╱╲                 │  │  ▓  ▓                │
  │   Flora ╱  ╲ Musa            │  │  ▓  ▓  ▓             │
  │         ╲  ╱                 │  │  ▓  ▓  ▓  ▓          │
  │          ╲╱                  │  │  M1 M2 M3 M4         │
  │        Bloom                 │  │  tasks/wk by month   │
  └──────────────────────────────┘  └─────────────────────┘

  ┌── ACTIVE PLANS (12 col) ────────────────────────────┐
  │  ┌────────────┐ ┌────────────┐ ┌────────────┐       │
  │  │ Month 2    │ │ + New plan │ │            │       │
  │  │ Neuro 12/90│ │    ✦       │ │            │       │
  │  │ ▓▓▓░░ 13%  │ │            │ │            │       │
  │  └────────────┘ └────────────┘ └────────────┘       │
  └─────────────────────────────────────────────────────┘
```

**Inventory:** `TopNav` · `HeroPanel` (avatar, name, level, XP bar) · `TodayQuest` (task checklist) · `StreakCard` (current, longest, 7-day dots) · `RadarChart` (5-axis) · `VelocityChart` (bar by month) · `PlanCard` × N · `Confetti` on day-complete

**States:** default · loading (skeleton cards) · level-up (full-screen burst + modal) · empty plans (illustration + CTA) · day-complete (confetti + XP toast) · error (banner + retry)

**Behaviors**
- Task checkbox → optimistic update + POST `/complete` → on success, apply XP/streak locally, fire XP toast, refresh `/api/me` in background
- Plan card click → `/plan/:id`
- `+ New plan` card → `/plan/new`

**Mobile:** all panels stack 1-col · sticky bottom-right FAB for new plan

---

# Reusable Components

| Component       | Spec (current implementation)                                                   |
|-----------------|---------------------------------------------------------------------------------|
| `TopNav`        | Glass, sticky, 64px · logo + streak chip + avatar dropdown                      |
| `GlassCard`     | backdrop-blur 12–20px, rgba(255,255,255,0.6–0.7), 16px radius, soft shadow, **no border** |
| `Button`        | Pill, 3 variants: primary (solid #854b76) / outline (glass) / ghost             |
| `Input`         | Glass background, rounded-2xl, **no border**, focus = background opacity bump  |
| `Textarea`      | Same as Input, auto-grows                                                       |
| `Chip`          | Pill, 5 color variants, blooms (scale 1.05 + glow) on select                   |
| `Avatar`        | 48/64/128px, gradient-filled circle, optional float + glow                      |
| `PillBadge`     | Task cell, colored by pillar                                                    |
| `DataTable`     | Inline-editable, sortable, sticky header, optimistic updates                    |
| `RadarChart`    | 5-axis, pink stroke + semi-transparent pink fill                                |
| `VelocityChart` | Bar chart, soft gradient fill                                                   |
| `Sparkle`       | 4-point star, random drift, ambient + celebration                              |
| `Confetti`      | Canvas, 2s burst, magic colors                                                  |
| `Toast`         | Top-right, glass, spring animation, 3s auto-dismiss                             |

---

# Interaction Patterns

**Loading** — inline shimmer skeletons for cards/tables · button morphs to ✦ spinner · full-screen casting animation for AI generation

**Empty** — single illustration + headline + one CTA · no "tips" or secondary actions

**Error** — inline soft red tint on inputs (no red border) · toast for async failures · always show recovery path

**Celebration** — day complete → confetti + XP toast + radar pulse · level up → full-screen burst + modal · streak milestone (7/30/100) → bigger burst + badge

---

# Accessibility

- All glass surfaces maintain 4.5:1 contrast for body text
- Focus indicated by **background opacity change** + text cursor (no colored ring that distracts from the Winx palette)
- All interactive elements keyboard-navigable
- Confetti respects `prefers-reduced-motion`
- ARIA labels on icon-only buttons · form errors via `aria-live="polite"`

---

# Design North Star

- Winx Club reference is for **character energy, not literal likeness** — translate into modern, original vectors
- Sparkles signal **interactivity and celebration** — not decoration
- This is a Type A productivity tool disguised as a magic app — **discipline lives in the structure, delight lives in the surface**
- Light mode is fixed · no dark mode · keep chrome calm so the ambient backdrop can shine
