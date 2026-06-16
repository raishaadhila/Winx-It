import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
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
import { VelocityChart } from '../components/VelocityChart';
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

export function DashboardPage() {
  const { profile, applyLocal } = useProfile();
  const toast = useToast();
  const [plans, setPlans] = useState<PlanSummary[] | null>(null);
  const [todayTasks, setTodayTasks] = useState<Task[] | null>(null);
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
      } else {
        setTodayTasks([]);
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
      ? `Day ${profile.current_streak} of your streak! +${xpInLevel} XP this level ✨`
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
                className="mt-3"
              />
              <p className="mt-3 font-display text-xl font-bold text-on-surface">
                {profile?.name ?? '…'}
              </p>
              <p className="font-label text-label-caps text-on-surface-variant">
                Level {profile?.level ?? 1} · {profile?.current_streak ?? 0}d streak
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

            {/* Velocity — kept here for analytics density */}
            {loading ? (
              <SkeletonCard className="h-56" />
            ) : (
              <VelocityChart />
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

            {/* Streak panel — UNCHANGED streak style (moved here so it stays in the user's face) */}
            <StreakPanel loading={loading} />

            {/* Active plans grid */}
            <GlassCard className="p-5">
              <div className="flex items-center justify-between mb-4">
                <h2 className="font-display text-headline-lg-mobile font-bold text-on-surface">
                  ✦ Active Plans
                </h2>
                <Link to="/plan/new">
                  <Button>+ New plan</Button>
                </Link>
              </div>
              {loading ? (
                <Skeleton rows={2} />
              ) : !plans || plans.length === 0 ? (
                <div className="py-8 text-center text-on-surface-variant">
                  <p className="font-body text-body-md">No plans yet. Create your first quest ✦</p>
                </div>
              ) : (
                <div className="grid sm:grid-cols-2 gap-4">
                  {plans.map((p) => (
                    <Link to={`/plan/${p.id}`} key={p.id}>
                      <GlassCard hoverable className="p-4 h-full">
                        <div className="flex items-start justify-between mb-2">
                          <span className="text-2xl">{pickEmoji(p.title)}</span>
                          <span className="font-label text-label-caps text-on-surface-variant">
                            {p.done_tasks}/{p.total_tasks}
                          </span>
                        </div>
                        <h3 className="font-display text-lg font-bold text-on-surface leading-tight mb-3">
                          {p.title}
                        </h3>
                        <div className="h-1.5 rounded-full bg-primary/10 overflow-hidden">
                          <div
                            className="h-full rounded-full bg-gradient-to-r from-[#ffb7e9] to-[#94f1fb]"
                            style={{ width: `${p.progress * 100}%` }}
                          />
                        </div>
                        <p className="mt-1 font-label text-label-caps text-on-surface-variant text-right">
                          {Math.round(p.progress * 100)}%
                        </p>
                      </GlassCard>
                    </Link>
                  ))}
                  <Link to="/plan/new">
                    <GlassCard
                      hoverable
                      className="p-4 h-full flex flex-col items-center justify-center text-center border-dashed border-2 border-primary/30 bg-white/20"
                    >
                      <span className="text-3xl text-primary mb-2">✦</span>
                      <p className="font-display text-lg font-bold text-primary">New quest</p>
                      <p className="font-label text-label-caps text-on-surface-variant mt-1">
                        Transform a new goal
                      </p>
                    </GlassCard>
                  </Link>
                </div>
              )}
            </GlassCard>
          </section>
        </div>
      </main>

      <Link
        to="/plan/new"
        className="sm:hidden fixed bottom-6 right-6 z-40 btn-primary !rounded-full !p-4 shadow-glow-pink"
        aria-label="New plan"
      >
        <span className="text-xl">✦</span>
      </Link>
    </div>
  );
}

/* ---------- Subcomponents ---------- */

function StreakPanel({ loading }: { loading: boolean }) {
  const { profile } = useProfile();
  if (loading || !profile) {
    return <SkeletonCard className="h-40" />;
  }
  return (
    <GlassCard className="p-5">
      <div className="flex items-center justify-between mb-3">
        <h2 className="font-display text-headline-lg-mobile font-bold text-on-surface">
          🔥 Streak
        </h2>
        <span className="font-label text-label-caps text-on-surface-variant">
          {profile.current_streak}d
        </span>
      </div>
      <div className="text-center py-2">
        <p className="font-display text-5xl font-extrabold bg-gradient-to-r from-[#ff5fa2] to-[#ffaa3a] bg-clip-text text-transparent">
          {profile.current_streak}
        </p>
        <p className="font-label text-label-caps text-on-surface-variant mt-1">day streak</p>
      </div>
      <div className="my-3 h-1.5 rounded-full bg-outline-variant/30 overflow-hidden">
        <div
          className="h-full rounded-full bg-gradient-to-r from-[#ffb7e9] to-[#ffaa3a]"
          style={{ width: `${(profile.current_streak / 30) * 100}%` }}
        />
      </div>
      <div className="flex justify-between font-label text-label-caps text-on-surface-variant">
        <span>Longest: {profile.longest_streak}d</span>
        <span>{30 - profile.current_streak}d to badge</span>
      </div>
      <div className="mt-4 grid grid-cols-7 gap-1">
        {Array.from({ length: 7 }).map((_, i) => (
          <div
            key={i}
            className={cn(
              'aspect-square rounded-md flex items-center justify-center text-xs',
              i < profile.current_streak % 7
                ? 'bg-gradient-to-br from-[#ffb7e9] to-[#ffaa3a] text-white shadow-glow-pink'
                : 'bg-white/30 text-on-surface-variant',
            )}
          >
            {i < profile.current_streak % 7 ? '✦' : '·'}
          </div>
        ))}
      </div>
    </GlassCard>
  );
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
