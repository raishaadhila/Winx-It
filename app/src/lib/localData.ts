/**
 * Local data layer used when the user is not authenticated (or Supabase
 * is not configured). Mirrors the backend's API shape so pages can call
 * `api.foo()` and get the same return type whether the data lives in
 * localStorage or in Postgres.
 */
import type {
  GeneratedPlan,
  GeneratedTask,
  Pillar,
  Plan,
  PlanCreate,
  PlanGenerateRequest,
  PlanSummary,
  Profile,
  Task,
  TaskCompleteResponse,
  TaskUpdate,
} from './types';
import { XP_PER_LEVEL } from '../data/mock';

const PLANS_KEY = 'winx-it:local-plans';
const STATS_KEY = 'winx-it:local-stats';
const PROFILE_KEY = 'winx-it:local-profile';

export type LocalStats = {
  total_xp: number;
  level: number;
  current_streak: number;
  longest_streak: number;
  last_completed_date: string | null;
  pillar_xp: Record<Pillar, number>;
};

export type LocalProfile = {
  name: string;
  fairy: 'tecna' | 'bloom' | 'stella' | 'flora' | 'musa' | 'layla';
  pillar: Pillar;
  accent: 'pink' | 'blue' | 'lime' | 'purple' | 'yellow';
};

const defaultStats = (): LocalStats => ({
  total_xp: 0,
  level: 1,
  current_streak: 0,
  longest_streak: 0,
  last_completed_date: null,
  pillar_xp: { tecna: 0, flora: 0, musa: 0, bloom: 0, stella: 0 },
});

const defaultProfile = (): LocalProfile => ({
  name: 'Raisha',
  fairy: 'tecna',
  pillar: 'tecna',
  accent: 'blue',
});

function readJson<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return fallback;
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

function writeJson<T>(key: string, value: T) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    /* quota or private mode */
  }
}

// ---------- Plans ----------
export function listLocalPlans(): Plan[] {
  return readJson<Plan[]>(PLANS_KEY, []);
}

export function getLocalPlan(id: string): Plan | null {
  return listLocalPlans().find((p) => p.id === id) ?? null;
}

export function saveLocalPlan(plan: Plan) {
  const all = listLocalPlans();
  const idx = all.findIndex((p) => p.id === plan.id);
  if (idx >= 0) all[idx] = plan;
  else all.unshift(plan);
  writeJson(PLANS_KEY, all);
}

export function deleteLocalPlan(id: string) {
  const all = listLocalPlans().filter((p) => p.id !== id);
  writeJson(PLANS_KEY, all);
}

function planToSummary(p: Plan): PlanSummary {
  const total = p.tasks.length;
  const done = p.tasks.filter((t) => t.done).length;
  return {
    id: p.id,
    title: p.title,
    timeframe: p.timeframe,
    start_date: p.start_date,
    end_date: p.end_date,
    status: p.status,
    total_tasks: total,
    done_tasks: done,
    progress: total ? done / total : 0,
    created_at: p.created_at,
  };
}

// ---------- Stats ----------
export function getLocalStats(): LocalStats {
  return readJson<LocalStats>(STATS_KEY, defaultStats());
}

export function saveLocalStats(s: LocalStats) {
  writeJson(STATS_KEY, s);
}

const XP_PER_TASK = 50;
const STREAK_BONUS = 200;

export function applyTaskComplete(stats: LocalStats, pillar: Pillar, today: string) {
  const last = stats.last_completed_date;
  let newStreak = stats.current_streak;
  let bonus = 0;
  if (last !== today) {
    if (last) {
      const diff = Math.round(
        (new Date(today).getTime() - new Date(last).getTime()) / 86400000,
      );
      newStreak = diff === 1 ? stats.current_streak + 1 : 1;
    } else {
      newStreak = 1;
    }
    bonus = STREAK_BONUS * newStreak;
  }
  const newTotal = stats.total_xp + XP_PER_TASK + bonus;
  const newLevel = Math.floor(newTotal / XP_PER_LEVEL) + 1;
  const newPillarXp = { ...stats.pillar_xp };
  newPillarXp[pillar] = (newPillarXp[pillar] || 0) + XP_PER_TASK;
  return {
    stats: {
      ...stats,
      total_xp: newTotal,
      level: newLevel,
      current_streak: newStreak,
      longest_streak: Math.max(stats.longest_streak, newStreak),
      last_completed_date: today,
      pillar_xp: newPillarXp,
    },
    xpAwarded: XP_PER_TASK,
    streakBonus: bonus,
    leveledUp: newLevel > stats.level,
  };
}

// ---------- Profile ----------
export function getLocalProfile(): LocalProfile {
  return readJson<LocalProfile>(PROFILE_KEY, defaultProfile());
}

export function saveLocalProfile(p: Partial<LocalProfile>) {
  const cur = getLocalProfile();
  writeJson(PROFILE_KEY, { ...cur, ...p });
}

// ---------- Public local API (used by api.ts dispatcher) ----------
export const local = {
  me: {
    get: async (): Promise<Profile> => {
      const stats = getLocalStats();
      const profile = getLocalProfile();
      const xpInLevel = stats.total_xp % XP_PER_LEVEL;
      return {
        id: 'local-user',
        email: 'guest@local',
        name: profile.name,
        fairy: profile.fairy,
        pillar: profile.pillar,
        accent: profile.accent,
        avatar_seed: null,
        level: stats.level,
        total_xp: stats.total_xp,
        current_streak: stats.current_streak,
        longest_streak: stats.longest_streak,
        last_completed_date: stats.last_completed_date,
        pillar_xp: stats.pillar_xp,
        xp_to_next_level: XP_PER_LEVEL - xpInLevel,
      };
    },
    updateAvatar: async (body: Partial<LocalProfile>): Promise<Profile> => {
      saveLocalProfile(body);
      return local.me.get();
    },
  },
  plans: {
    list: async (): Promise<PlanSummary[]> => listLocalPlans().map(planToSummary),
    get: async (id: string): Promise<Plan> => {
      const plan = getLocalPlan(id);
      if (!plan) throw new Error('Plan not found');
      return plan;
    },
    generate: async (req: PlanGenerateRequest): Promise<GeneratedPlan> =>
      generateLocalPlan(req),
    create: async (body: PlanCreate): Promise<Plan> => {
      const id = crypto.randomUUID();
      const now = new Date().toISOString();
      const plan: Plan = {
        id,
        title: body.title,
        goal_text: body.goal_text,
        timeframe: body.timeframe,
        start_date: body.start_date,
        end_date: body.end_date,
        status: 'active',
        tasks: body.tasks.map((t, i) => ({
          id: crypto.randomUUID(),
          plan_id: id,
          day: t.day,
          week: t.week,
          month: t.month,
          date: t.date,
          description: t.description,
          pillar: t.pillar,
          hours: t.hours,
          energy: t.energy,
          done: false,
          completed_at: null,
          position: i,
        })),
        created_at: now,
        updated_at: now,
      };
      saveLocalPlan(plan);
      return plan;
    },
    update: async (id: string, body: Partial<Plan>): Promise<Plan> => {
      const plan = getLocalPlan(id);
      if (!plan) throw new Error('Plan not found');
      const updated = { ...plan, ...body, updated_at: new Date().toISOString() };
      saveLocalPlan(updated);
      return updated;
    },
    remove: async (id: string): Promise<void> => {
      deleteLocalPlan(id);
    },
  },
  tasks: {
    list: async (planId: string): Promise<Task[]> => {
      const plan = getLocalPlan(planId);
      if (!plan) throw new Error('Plan not found');
      return plan.tasks;
    },
    create: async (planId: string, body: Omit<Task, 'id' | 'plan_id' | 'done' | 'completed_at' | 'position'>): Promise<Task> => {
      const plan = getLocalPlan(planId);
      if (!plan) throw new Error('Plan not found');
      const task: Task = {
        id: crypto.randomUUID(),
        plan_id: planId,
        done: false,
        completed_at: null,
        position: plan.tasks.length,
        ...body,
      };
      plan.tasks.push(task);
      plan.updated_at = new Date().toISOString();
      saveLocalPlan(plan);
      return task;
    },
    update: async (planId: string, taskId: string, body: TaskUpdate): Promise<Task> => {
      const plan = getLocalPlan(planId);
      if (!plan) throw new Error('Plan not found');
      const idx = plan.tasks.findIndex((t) => t.id === taskId);
      if (idx < 0) throw new Error('Task not found');
      const updated: Task = { ...plan.tasks[idx], ...body };
      plan.tasks[idx] = updated;
      plan.updated_at = new Date().toISOString();
      saveLocalPlan(plan);
      return updated;
    },
    remove: async (planId: string, taskId: string): Promise<void> => {
      const plan = getLocalPlan(planId);
      if (!plan) return;
      plan.tasks = plan.tasks.filter((t) => t.id !== taskId);
      plan.updated_at = new Date().toISOString();
      saveLocalPlan(plan);
    },
    complete: async (planId: string, taskId: string): Promise<TaskCompleteResponse> => {
      const plan = getLocalPlan(planId);
      if (!plan) throw new Error('Plan not found');
      const task = plan.tasks.find((t) => t.id === taskId);
      if (!task) throw new Error('Task not found');

      if (task.done) {
        // idempotent — return current stats without re-awarding XP
        const stats = getLocalStats();
        return {
          task,
          xp_awarded: 0,
          pillar_xp_awarded: 0,
          new_total_xp: stats.total_xp,
          new_level: stats.level,
          leveled_up: false,
          streak: stats.current_streak,
        };
      }

      const today = new Date().toISOString().slice(0, 10);
      const stats = getLocalStats();
      const result = applyTaskComplete(stats, task.pillar, today);
      saveLocalStats(result.stats);

      task.done = true;
      task.completed_at = new Date().toISOString();
      plan.updated_at = new Date().toISOString();
      saveLocalPlan(plan);

      return {
        task,
        xp_awarded: result.xpAwarded,
        pillar_xp_awarded: result.xpAwarded,
        new_total_xp: result.stats.total_xp,
        new_level: result.stats.level,
        leveled_up: result.leveledUp,
        streak: result.stats.current_streak,
      };
    },
  },
};

// ---------- Local AI planner (mirrors backend _stub_plan) ----------
const DESCS: Record<Pillar, string[]> = {
  tecna: [
    'Ship a feature',
    'Review PRs',
    'Refactor module',
    'Run benchmarks',
    'Write tests',
    'Pair on architecture',
  ],
  flora: [
    'Read research module',
    'Cardio session',
    'Stretch + breathe',
    'Brain imaging notes',
    'Hydration check',
    'Sleep routine',
  ],
  musa: [
    'Read English journal',
    'Listen to podcast',
    'Write summary',
    'Vocab drill',
    'Speaking practice',
    'Watch lecture',
  ],
  bloom: [
    'Outreach sequence',
    'Ship launch update',
    'User interview',
    'Marketing post',
    'Cold email batch',
    'Metrics review',
  ],
  stella: [
    'Cycle 30min',
    'Swim laps',
    'Meditate 10min',
    'Walk + reflect',
    'Gym session',
    'Yoga flow',
  ],
};

function daysFor(req: PlanGenerateRequest): number {
  if (req.timeframe === '1 month') return 30;
  if (req.timeframe === '3 months') return 90;
  if (req.timeframe === '6 months') return 180;
  if (req.custom_days) return Math.min(req.custom_days, 365);
  return 90;
}

function generateLocalPlan(req: PlanGenerateRequest): GeneratedPlan {
  const days = daysFor(req);
  const start = new Date();
  const end = new Date(start.getTime() + (days - 1) * 86400000);
  const pillars = req.pillars.length ? req.pillars : (['tecna', 'flora'] as Pillar[]);

  const tasks: GeneratedTask[] = [];
  const stubDays = Math.min(days, 21); // 3 weeks of seeded tasks (matches backend)
  for (let d = 1; d <= stubDays; d++) {
    const pillar = pillars[(d - 1) % pillars.length];
    const descs = DESCS[pillar];
    const desc = descs[(d - 1) % descs.length];
    const hours = d % 3 === 0 ? 2 : d % 2 === 0 ? 1.5 : 0.75;
    const energy: GeneratedTask['energy'] = d % 5 === 0 ? 'high' : d % 2 === 0 ? 'medium' : 'low';
    const date = new Date(start.getTime() + (d - 1) * 86400000);
    tasks.push({
      day: d,
      week: Math.ceil(d / 7),
      month: Math.ceil(d / 30),
      date: date.toISOString().slice(0, 10),
      description: desc,
      pillar,
      hours,
      energy,
    });
  }

  const titleSeed = req.goal.split('.')[0].slice(0, 60).trim() || 'New Quest';
  const title = titleSeed
    .split(' ')
    .map((w) => (w.length > 0 ? w[0].toUpperCase() + w.slice(1) : w))
    .join(' ');

  return {
    title,
    start_date: start.toISOString().slice(0, 10),
    end_date: end.toISOString().slice(0, 10),
    tasks,
  };
}
