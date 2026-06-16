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

  const fetchData = async () => {
    setError(null);
    try {
      const list = await api.plans.list();
      setPlans(list);

      // Pick the first active plan, load its tasks
      const active = list.find((p) => p.status === 'active') ?? list[0];
      if (active) {
        const tasks = await api.tasks.list(active.id);
        // Show first 5 unfinished tasks (or first 5 if all done)
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

  const xpPct = profile ? ((profile.total_xp % XP_PER_LEVEL) / XP_PER_LEVEL) * 100 : 0;
  const xpInLevel = profile ? profile.total_xp % XP_PER_LEVEL : 0;

  const toggleTask = async (task: Task) => {
    if (toggling) return;
    if (task.done) return; // un-complete not supported yet
    const planId = task.plan_id;
    setToggling(task.id);
    // Optimistic
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
        if (res.leveled_up) setConfetti(true);
        else setConfetti(true);
      }
    } catch (err) {
      // Rollback
      setTodayTasks((prev) =>
        prev ? prev.map((t) => (t.id === task.id ? { ...t, done: false } : t)) : prev,
      );
      toast.error(err instanceof ApiError ? err.detail : 'Could not complete task');
    } finally {
      setToggling(null);
    }
  };

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
            <p className="font-body text-body-md text-on-error-container">
              ⚠ {error}
            </p>
            <Button variant="outline" onClick={fetchData} className="mt-2 !text-xs !px-3 !py-1.5">
              Retry
            </Button>
          </GlassCard>
        )}

        {/* Hero */}
        <GlassCard level={3} className="p-6 sm:p-8 relative overflow-hidden">
          <SparkleDots />
          <div className="flex flex-col sm:flex-row items-start sm:items-center gap-5 relative">
            <Avatar fairy={profile?.fairy ?? 'tecna'} size="xl" showGlow />
            <div className="flex-1">
              <p className="font-label text-label-caps text-on-surface-variant">Welcome back</p>
              {loading || !profile ? (
                <Skeleton rows={2} className="mt-1" />
              ) : (
                <>
                  <h1 className="font-display text-headline-lg-mobile md:text-headline-xl font-extrabold text-on-surface">
                    {profile.name} <span className="text-primary text-glow-pink">✦</span>
                  </h1>
                  <p className="font-body text-body-md text-on-surface-variant mt-1">
                    Level {profile.level} · {profile.total_xp.toLocaleString()} XP total
                  </p>
                </>
              )}
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
          </div>
        </GlassCard>

        <div className="grid lg:grid-cols-3 gap-5">
          {/* Today's Quest */}
          <GlassCard className="p-5 lg:col-span-2">
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
                <Button onClick={() => setConfetti(true)} className="animate-pulse-glow">
                  🎉 Mark all complete
                </Button>
              </div>
            )}
          </GlassCard>

          {/* Streak */}
          <GlassCard className="p-5">
            <h2 className="font-display text-headline-lg-mobile font-bold text-on-surface mb-3">
              🔥 Streak
            </h2>
            {loading || !profile ? (
              <Skeleton rows={3} />
            ) : (
              <>
                <div className="text-center py-3">
                  <p className="font-display text-5xl font-extrabold bg-gradient-to-r from-[#ff5fa2] to-[#ffaa3a] bg-clip-text text-transparent">
                    {profile.current_streak}
                  </p>
                  <p className="font-label text-label-caps text-on-surface-variant mt-1">
                    day streak
                  </p>
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
              </>
            )}
          </GlassCard>
        </div>

        <div className="grid lg:grid-cols-2 gap-5">
          {loading ? <SkeletonCard className="h-80" /> : <RadarStats profile={profile} />}
          <VelocityChart />
        </div>

        {/* Active plans */}
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
            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
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
