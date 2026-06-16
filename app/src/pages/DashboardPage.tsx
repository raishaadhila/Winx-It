import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { AmbientBackground } from '../components/AmbientBackground';
import { Avatar } from '../components/Avatar';
import { Button } from '../components/Button';
import { Confetti } from '../components/Confetti';
import { GlassCard } from '../components/GlassCard';
import { PillBadge } from '../components/PillBadge';
import { RadarStats } from '../components/RadarStats';
import { Skeleton, SkeletonCard } from '../components/Skeleton';
import { SpeechBubble } from '../components/SpeechBubble';
import { TopNav } from '../components/TopNav';
import { useProfile } from '../contexts/ProfileContext';
import { useToast } from '../contexts/ToastContext';
import { api, ApiError } from '../lib/api';
import { XP_PER_LEVEL } from '../data/mock';
import { cn } from '../lib/cn';
import type { PlanSummary, Task } from '../lib/types';

const PILLAR_EMOJI: Record<string, string> = {
  Month: '🗓',
  Launch: '🚀',
  Quest: '✨',
};

function pickEmoji(title: string): string {
  for (const [key, emoji] of Object.entries(PILLAR_EMOJI)) {
    if (title.toLowerCase().includes(key.toLowerCase())) return emoji;
  }
  return '✦';
}

function todayDaysLeft(endDate: string): number {
  const end = new Date(endDate);
  const now = new Date();
  end.setHours(0, 0, 0, 0);
  now.setHours(0, 0, 0, 0);
  return Math.round((end.getTime() - now.getTime()) / 86400000);
}

function todayDaysIn(startDate: string, endDate: string): number {
  const start = new Date(startDate);
  const end = new Date(endDate);
  start.setHours(0, 0, 0, 0);
  end.setHours(0, 0, 0, 0);
  return Math.max(1, Math.round((end.getTime() - start.getTime()) / 86400000) + 1);
}

function todayDaysElapsed(startDate: string, endDate: string): number {
  const start = new Date(startDate);
  const end = new Date(endDate);
  const now = new Date();
  start.setHours(0, 0, 0, 0);
  end.setHours(0, 0, 0, 0);
  now.setHours(0, 0, 0, 0);
  const total = Math.max(1, Math.round((end.getTime() - start.getTime()) / 86400000) + 1);
  return Math.max(
    0,
    Math.min(total, Math.round((now.getTime() - start.getTime()) / 86400000) + 1),
  );
}

export function DashboardPage() {
  const { profile, applyLocal } = useProfile();
  const toast = useToast();
  const [plans, setPlans] = useState<PlanSummary[] | null>(null);
  const [todayTasks, setTodayTasks] = useState<Task[] | null>(null);
  const [completionTasks, setCompletionTasks] = useState<Task[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [confetti, setConfetti] = useState(false);
  const [toggling, setToggling] = useState<string | null>(null);

  const xpPct = profile ? ((profile.total_xp % XP_PER_LEVEL) / XP_PER_LEVEL) * 100 : 0;
  const xpInLevel = profile ? profile.total_xp % XP_PER_LEVEL : 0;

  const fetchData = async () => {
    setError(null);
    try {
      const list = await api.plans.list();
      setPlans(list);
      const active = list.find((p) => p.status === 'active') ?? list[0];
      if (active) {
        const tasks = await api.tasks.list(active.id);
        const open = tasks.filter((t) => !t.done);
        setTodayTasks(open.length ? open.slice(0, 5) : tasks.slice(0, 5));
        setCompletionTasks(tasks);
      } else {
        setTodayTasks([]);
        setCompletionTasks([]);
      }
    } catch (err) {
      setError(err instanceof ApiError ? err.detail : (err as Error).message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const toggleTask = async (task: Task) => {
    if (toggling) return;
    if (task.done) return;
    const planId = task.plan_id;
    setToggling(task.id);
    setTodayTasks((prev) =>
      prev ? prev.map((t) => (t.id === task.id ? { ...t, done: true } : t)) : prev,
    );
    try {
      const res = await api.tasks.complete(planId, task.id);
      if (res.xp_awarded > 0) {
        applyLocal({
          total_xp: res.new_total_xp,
          level: res.new_level,
          current_streak: res.streak,
        });
        toast.success(
          res.leveled_up
            ? `🎉 Level up! Welcome to Level ${res.new_level}! +${res.xp_awarded} XP`
            : `+${res.xp_awarded} XP earned ✦`,
        );
        setConfetti(true);
      }
    } catch (err) {
      setTodayTasks((prev) =>
        prev ? prev.map((t) => (t.id === task.id ? { ...t, done: false } : t)) : prev,
      );
      toast.error(err instanceof ApiError ? err.detail : 'Could not complete task');
    } finally {
      setToggling(null);
    }
  };

  const markAllComplete = async () => {
    if (!todayTasks) return;
    const pending = todayTasks.filter((t) => !t.done);
    if (pending.length === 0) {
      setConfetti(true);
      return;
    }
    // Optimistic local flip
    setTodayTasks((prev) =>
      prev ? prev.map((t) => (t.done ? t : { ...t, done: true })) : prev,
    );
    setConfetti(true);
    // Fire all completes in parallel; surface any errors
    const results = await Promise.allSettled(
      pending.map((t) => api.tasks.complete(t.plan_id, t.id)),
    );
    let totalXp = 0;
    let leveledUp = false;
    let lastStreak = 0;
    let lastLevel = 0;
    let lastTotalXp = 0;
    let lastFailure: string | null = null;
    for (let i = 0; i < results.length; i++) {
      const r = results[i];
      if (r.status === 'fulfilled') {
        totalXp += r.value.xp_awarded;
        if (r.value.leveled_up) leveledUp = true;
        lastStreak = r.value.streak;
        lastLevel = r.value.new_level;
        lastTotalXp = r.value.new_total_xp;
      } else {
        const t = pending[i];
        const reason =
          r.reason instanceof ApiError
            ? r.reason.detail
            : r.reason instanceof Error
              ? r.reason.message
              : 'Could not complete task';
        lastFailure = reason;
        // Roll back this task
        setTodayTasks((prev) =>
          prev ? prev.map((x) => (x.id === t.id ? { ...x, done: false } : x)) : prev,
        );
      }
    }
    if (lastTotalXp > 0) {
      applyLocal({
        total_xp: lastTotalXp,
        level: lastLevel,
        current_streak: lastStreak,
      });
    }
    if (totalXp > 0) {
      toast.success(
        leveledUp
          ? `🎉 Day crushed! Level ${lastLevel}! +${totalXp} XP`
          : `+${totalXp} XP earned ✦`,
      );
    }
    if (lastFailure) toast.error(lastFailure);
  };

  // Speech bubble message — changes with current stats.
  const bubbleMsg = profile
    ? profile.level >= 5
      ? `Level ${profile.level} and climbing! +${xpInLevel} XP this level ✨`
      : `Welcome back! You're Level ${profile.level} — keep casting! ✦`
    : 'Loading your stats…';

  const allDone =
    todayTasks !== null && todayTasks.length > 0 && todayTasks.every((t) => t.done);

  return (
    <div className="relative min-h-screen pb-20">
      <AmbientBackground />
      <TopNav />
      <Confetti fire={confetti} onDone={() => setConfetti(false)} />

      <main className="max-w-content mx-auto px-4 sm:px-6 py-6 space-y-5">
        {error && (
          <GlassCard className="p-4 border border-error/30 bg-error-container/30">
            <p className="font-body text-body-md text-on-error-container">⚠ {error}</p>
            <Button variant="outline" onClick={fetchData} className="mt-2 !text-xs !px-3 !py-1.5">
              Retry
            </Button>
          </GlassCard>
        )}

        {/* ============================================================
            SPLIT-COLUMN DASHBOARD
            Left  = "Chart About Productivity" sidebar (avatar + bubble + matrix + streak)
            Right = "Dashboard" main (today's quest + active plans)
            Matrix and streak keep their exact visual style from before.
           ============================================================ */}
        <div className="grid grid-cols-1 lg:grid-cols-[340px_1fr] gap-5">
          {/* ============ LEFT SIDEBAR — Chart About Productivity ============ */}
          <aside className="space-y-4">
            {/* Avatar + speech bubble per the wireframe */}
            <GlassCard level={3} className="p-5 flex flex-col items-center text-center relative">
              <span aria-hidden className="text-xs font-label text-label-caps uppercase text-on-surface-variant tracking-widest absolute top-3 left-4">
                Chart About Productivity
              </span>
              <Avatar
                fairy={profile?.fairy ?? 'tecna'}
                size="xl"
                showGlow
                imageUrl={profile?.avatar_data_url ?? null}
                className="mt-3"
              />
              <p className="mt-3 font-display text-xl font-bold text-on-surface">
                {profile?.name ?? '…'}
              </p>
              <p className="font-label text-label-caps text-on-surface-variant">
                Level {profile?.level ?? 1} · {profile?.total_xp.toLocaleString() ?? 0} XP
              </p>
              <div className="mt-3">
                <SpeechBubble message={bubbleMsg} side="right" />
              </div>
            </GlassCard>

            {/* 5-pillar radar — UNCHANGED matrix style */}
            {loading ? (
              <SkeletonCard className="h-80" />
            ) : (
              <RadarStats profile={profile} />
            )}
          </aside>

          {/* ============ RIGHT MAIN — Dashboard ============ */}
          <section className="space-y-4">
            {/* Hero with XP bar (kept compact since avatar is now in sidebar) */}
            <GlassCard level={3} className="p-5 sm:p-6 relative overflow-hidden">
              <SparkleDots />
              <div className="relative">
                <p className="font-label text-label-caps uppercase text-on-surface-variant">
                  Dashboard
                </p>
                <h1 className="font-display text-headline-lg-mobile md:text-headline-lg font-extrabold text-on-surface mt-1">
                  Welcome back, {profile?.name ?? '…'} ✦
                </h1>
                <p className="font-body text-body-md text-on-surface-variant mt-1">
                  Level {profile?.level ?? 1} · {profile?.total_xp.toLocaleString() ?? 0} XP total
                </p>
                <div className="mt-3 max-w-md">
                  <div className="flex items-center justify-between mb-1">
                    <span className="font-label text-label-caps text-on-surface-variant">
                      Progress to L{(profile?.level ?? 1) + 1}
                    </span>
                    <span className="font-label text-label-caps text-primary">
                      {XP_PER_LEVEL - xpInLevel} XP to go
                    </span>
                  </div>
                  <div className="h-3 rounded-full bg-primary/10 overflow-hidden relative">
                    <div
                      className="h-full rounded-full bg-gradient-to-r from-[#ffb7e9] via-[#94f1fb] to-[#b1dd00] transition-all duration-700"
                      style={{ width: `${xpPct}%` }}
                    />
                    <div className="absolute inset-0 shimmer-bg opacity-30 rounded-full" />
                  </div>
                </div>
              </div>
            </GlassCard>

            {/* Today's quest */}
            <GlassCard className="p-5">
              <div className="flex items-center justify-between mb-4">
                <h2 className="font-display text-headline-lg-mobile font-bold text-on-surface">
                  ✦ Today's Quest
                </h2>
                <span className="font-label text-label-caps text-on-surface-variant">
                  {todayTasks
                    ? `${todayTasks.filter((t) => t.done).length}/${todayTasks.length} done`
                    : '—'}
                </span>
              </div>
              {loading ? (
                <Skeleton rows={4} />
              ) : !todayTasks || todayTasks.length === 0 ? (
                <div className="py-8 text-center">
                  <span className="text-4xl text-primary">✦</span>
                  <p className="mt-2 font-display text-lg font-bold text-on-surface">
                    No active quest yet
                  </p>
                  <p className="mt-1 font-body text-body-md text-on-surface-variant">
                    Transform your first goal into a magical adventure.
                  </p>
                  <Link to="/plan/new" className="mt-4 inline-block">
                    <Button>+ Create your first plan</Button>
                  </Link>
                </div>
              ) : (
                <div className="space-y-2">
                  {todayTasks.map((t) => (
                    <label
                      key={t.id}
                      className={cn(
                        'flex items-center gap-3 p-3 rounded-lg bg-white/40 border border-white/60 transition cursor-pointer',
                        t.done ? 'opacity-60' : 'hover:bg-white/60',
                        toggling === t.id && 'opacity-50',
                      )}
                    >
                      <input
                        type="checkbox"
                        checked={t.done}
                        disabled={t.done || !!toggling}
                        onChange={() => toggleTask(t)}
                        className="w-4 h-4 accent-primary"
                      />
                      <span className={cn('flex-1 font-body text-body-md', t.done && 'line-through')}>
                        {t.description}
                      </span>
                      <PillBadge pillar={t.pillar} />
                      <span className="font-label text-label-caps text-on-surface-variant shrink-0">
                        {t.hours}h
                      </span>
                    </label>
                  ))}
                </div>
              )}
              {allDone && (
                <div className="mt-4 flex justify-end">
                  <Button onClick={markAllComplete} className="animate-pulse-glow">
                    🎉 Mark all complete
                  </Button>
                </div>
              )}
            </GlassCard>

            {/* Days Left — replaces the old streak panel */}
            <DaysLeftPanel plans={plans} loading={loading} />

            {/* Completion chart — tasks done per day */}
            <CompletionChart tasks={completionTasks} loading={loading} />
          </section>
        </div>
      </main>

      <Link
        to="/quests"
        className="sm:hidden fixed bottom-6 right-6 z-40 btn-primary !rounded-full !p-4 shadow-glow-pink"
        aria-label="Your quests"
      >
        <span className="text-xl">✦</span>
      </Link>
    </div>
  );
}

/* ---------- Subcomponents ---------- */

function DaysLeftPanel({
  plans,
  loading,
}: {
  plans: PlanSummary[] | null;
  loading: boolean;
}) {
  if (loading) {
    return <SkeletonCard className="h-40" />;
  }
  if (!plans || plans.length === 0) {
    return (
      <GlassCard className="p-5">
        <div className="flex items-center justify-between mb-2">
          <h2 className="font-display text-headline-lg-mobile font-bold text-on-surface">
            ⏳ Days Left
          </h2>
        </div>
        <p className="font-body text-body-md text-on-surface-variant text-center py-4">
          No active quests — cast your first to start the clock ✦
        </p>
        <div className="flex justify-center">
          <Link to="/plan/new">
            <Button>+ New quest</Button>
          </Link>
        </div>
      </GlassCard>
    );
  }

  return (
    <GlassCard className="p-5">
      <div className="flex items-center justify-between mb-3">
        <h2 className="font-display text-headline-lg-mobile font-bold text-on-surface">
          ⏳ Days Left
        </h2>
        <Link
          to="/quests"
          className="font-label text-label-caps uppercase text-primary hover:underline"
        >
          View all →
        </Link>
      </div>
      <div className="space-y-3">
        {plans.map((p) => {
          const total = todayDaysIn(p.start_date, p.end_date);
          const elapsed = todayDaysElapsed(p.start_date, p.end_date);
          const left = todayDaysLeft(p.end_date);
          const pct = Math.min(100, (elapsed / total) * 100);
          const over = left < 0;
          return (
            <Link
              to={`/plan/${p.id}`}
              key={p.id}
              className="block hover:opacity-90 transition"
            >
              <div className="flex items-center gap-3">
                <span className="text-2xl shrink-0">{pickEmoji(p.title)}</span>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between mb-1 gap-2">
                    <p className="font-display text-body-md font-bold text-on-surface truncate">
                      {p.title}
                    </p>
                    <span
                      className={cn(
                        'font-label text-label-caps shrink-0',
                        over
                          ? 'text-error'
                          : left <= 3
                            ? 'text-primary text-glow-pink'
                            : 'text-on-surface-variant',
                      )}
                    >
                      {over
                        ? `${Math.abs(left)}d over`
                        : left === 0
                          ? 'Last day!'
                          : `${left}d left`}
                    </span>
                  </div>
                  <div className="h-2 rounded-full bg-primary/10 overflow-hidden">
                    <div
                      className={cn(
                        'h-full rounded-full transition-all',
                        over
                          ? 'bg-error/70'
                          : 'bg-gradient-to-r from-[#ffb7e9] via-[#94f1fb] to-[#b1dd00]',
                      )}
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                  <p className="mt-1 font-label text-label-caps text-on-surface-variant">
                    Day {elapsed} of {total} · {p.timeframe}
                  </p>
                </div>
              </div>
            </Link>
          );
        })}
      </div>
    </GlassCard>
  );
}

function CompletionChart({
  tasks,
  loading,
}: {
  tasks: Task[] | null;
  loading: boolean;
}) {
  const data = buildCompletionSeries(tasks);
  const totalDone = data.reduce((s, d) => s + d.tasks, 0);
  return (
    <GlassCard className="p-5">
      <div className="flex items-center justify-between mb-2">
        <h2 className="font-display text-headline-lg-mobile font-bold text-on-surface">
          ✦ Completion Chart
        </h2>
        <span className="font-label text-label-caps text-on-surface-variant">
          last 14 days · {totalDone} done
        </span>
      </div>
      {loading ? (
        <SkeletonCard className="h-56" />
      ) : data.every((d) => d.tasks === 0) ? (
        <p className="font-body text-body-md text-on-surface-variant text-center py-6">
          No completions yet. Finish a task to light up the chart ✦
        </p>
      ) : (
        <div className="h-56 w-full">
          <ResponsiveContainer>
            <BarChart data={data} margin={{ top: 10, right: 0, left: -20, bottom: 0 }}>
              <defs>
                <linearGradient id="completion-grad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#ffb7e9" stopOpacity={1} />
                  <stop offset="100%" stopColor="#94f1fb" stopOpacity={0.8} />
                </linearGradient>
              </defs>
              <CartesianGrid stroke="#d3c2cb" strokeDasharray="3 3" vertical={false} />
              <XAxis
                dataKey="day"
                tick={{ fill: '#4f434b', fontSize: 11, fontFamily: 'Space Grotesk' }}
                axisLine={false}
                tickLine={false}
              />
              <YAxis
                allowDecimals={false}
                tick={{ fill: '#4f434b', fontSize: 11, fontFamily: 'Space Grotesk' }}
                axisLine={false}
                tickLine={false}
              />
              <Tooltip
                cursor={{ fill: 'rgba(255,183,233,0.1)' }}
                contentStyle={{
                  background: 'rgba(255,255,255,0.85)',
                  backdropFilter: 'blur(12px)',
                  border: '1px solid rgba(255,255,255,0.8)',
                  borderRadius: '8px',
                  fontFamily: 'Plus Jakarta Sans',
                  fontSize: '13px',
                }}
              />
              <Bar dataKey="tasks" fill="url(#completion-grad)" radius={[8, 8, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}
    </GlassCard>
  );
}

function buildCompletionSeries(tasks: Task[] | null): { day: string; tasks: number }[] {
  const days: { day: string; tasks: number; sort: number }[] = [];
  const now = new Date();
  now.setHours(0, 0, 0, 0);
  for (let i = 13; i >= 0; i--) {
    const d = new Date(now);
    d.setDate(d.getDate() - i);
    days.push({
      day: d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' }),
      tasks: 0,
      sort: d.getTime(),
    });
  }
  if (!tasks) return days.map(({ day, tasks }) => ({ day, tasks }));
  const map = new Map(days.map((d) => [d.sort, d]));
  for (const t of tasks) {
    if (!t.done || !t.completed_at) continue;
    const c = new Date(t.completed_at);
    c.setHours(0, 0, 0, 0);
    const day = map.get(c.getTime());
    if (day) day.tasks += 1;
  }
  return days.map(({ day, tasks }) => ({ day, tasks }));
}

function SparkleDots() {
  return (
    <div className="absolute inset-0 pointer-events-none">
      {[
        { x: '15%', y: '20%', d: '0s' },
        { x: '80%', y: '15%', d: '1s' },
        { x: '90%', y: '70%', d: '0.5s' },
        { x: '10%', y: '80%', d: '1.5s' },
        { x: '50%', y: '10%', d: '2s' },
      ].map((s, i) => (
        <span
          key={i}
          aria-hidden
          className="absolute text-primary text-lg animate-twinkle"
          style={{ left: s.x, top: s.y, animationDelay: s.d }}
        >
          ✦
        </span>
      ))}
    </div>
  );
}
