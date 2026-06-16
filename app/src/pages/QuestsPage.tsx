import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { AmbientBackground } from '../components/AmbientBackground';
import { Button } from '../components/Button';
import { GlassCard } from '../components/GlassCard';
import { Skeleton } from '../components/Skeleton';
import { TopNav } from '../components/TopNav';
import { api, ApiError } from '../lib/api';
import type { PlanSummary } from '../lib/types';

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
  // Strip the time so we count whole days
  end.setHours(0, 0, 0, 0);
  now.setHours(0, 0, 0, 0);
  const diff = Math.round((end.getTime() - now.getTime()) / 86400000);
  return diff;
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
  const elapsed = Math.max(
    0,
    Math.min(total, Math.round((now.getTime() - start.getTime()) / 86400000) + 1),
  );
  return elapsed;
}

export function QuestsPage() {
  const [plans, setPlans] = useState<PlanSummary[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchData = async () => {
    setError(null);
    setLoading(true);
    try {
      const list = await api.plans.list();
      setPlans(list);
    } catch (err) {
      setError(err instanceof ApiError ? err.detail : (err as Error).message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  return (
    <div className="relative min-h-screen pb-20">
      <AmbientBackground />
      <TopNav />

      <main className="max-w-content mx-auto px-4 sm:px-6 py-6 space-y-5">
        <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-3">
          <div>
            <Link
              to="/dashboard"
              className="font-label text-label-caps uppercase text-primary hover:underline"
            >
              ← Back to dashboard
            </Link>
            <h1 className="font-display text-headline-lg-mobile md:text-headline-lg font-extrabold text-on-surface mt-1">
              ✦ Your Quests
            </h1>
            <p className="font-body text-body-md text-on-surface-variant mt-1">
              Every plan you cast, with days left and progress at a glance.
            </p>
          </div>
          <Link to="/plan/new">
            <Button>+ New quest</Button>
          </Link>
        </div>

        {error && (
          <GlassCard className="p-4 border border-error/30 bg-error-container/30">
            <p className="font-body text-body-md text-on-error-container">⚠ {error}</p>
            <Button variant="outline" onClick={fetchData} className="mt-2 !text-xs !px-3 !py-1.5">
              Retry
            </Button>
          </GlassCard>
        )}

        {loading ? (
          <Skeleton rows={3} />
        ) : !plans || plans.length === 0 ? (
          <GlassCard className="p-8 text-center">
            <span className="text-4xl text-primary">✦</span>
            <p className="mt-2 font-display text-lg font-bold text-on-surface">
              No quests yet
            </p>
            <p className="mt-1 font-body text-body-md text-on-surface-variant">
              Transform your first goal into a magical adventure.
            </p>
            <Link to="/plan/new" className="mt-4 inline-block">
              <Button>+ Create your first quest</Button>
            </Link>
          </GlassCard>
        ) : (
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {plans.map((p) => {
              const total = todayDaysIn(p.start_date, p.end_date);
              const elapsed = todayDaysElapsed(p.start_date, p.end_date);
              const left = todayDaysLeft(p.end_date);
              return (
                <Link to={`/plan/${p.id}`} key={p.id}>
                  <GlassCard hoverable className="p-5 h-full flex flex-col">
                    <div className="flex items-start justify-between mb-2">
                      <span className="text-3xl">{pickEmoji(p.title)}</span>
                      <span className="font-label text-label-caps text-on-surface-variant">
                        {p.done_tasks}/{p.total_tasks}
                      </span>
                    </div>
                    <h3 className="font-display text-lg font-bold text-on-surface leading-tight mb-2">
                      {p.title}
                    </h3>
                    <p className="font-label text-label-caps text-on-surface-variant">
                      {p.timeframe}
                    </p>
                    <div className="mt-4 space-y-2">
                      <div>
                        <div className="flex items-center justify-between mb-1 font-label text-label-caps">
                          <span className="text-on-surface-variant">Progress</span>
                          <span className="text-on-surface">
                            {Math.round(p.progress * 100)}%
                          </span>
                        </div>
                        <div className="h-1.5 rounded-full bg-primary/10 overflow-hidden">
                          <div
                            className="h-full rounded-full bg-gradient-to-r from-[#ffb7e9] to-[#94f1fb]"
                            style={{ width: `${p.progress * 100}%` }}
                          />
                        </div>
                      </div>
                      <div>
                        <div className="flex items-center justify-between mb-1 font-label text-label-caps">
                          <span className="text-on-surface-variant">Time</span>
                          <span className="text-on-surface">
                            {left >= 0 ? `${left}d left` : `${Math.abs(left)}d over`}
                          </span>
                        </div>
                        <div className="h-1.5 rounded-full bg-primary/10 overflow-hidden">
                          <div
                            className="h-full rounded-full bg-gradient-to-r from-[#94f1fb] to-[#b1dd00]"
                            style={{ width: `${Math.min(100, (elapsed / total) * 100)}%` }}
                          />
                        </div>
                      </div>
                    </div>
                  </GlassCard>
                </Link>
              );
            })}
            <Link to="/plan/new">
              <GlassCard
                hoverable
                className="p-5 h-full flex flex-col items-center justify-center text-center border-dashed border-2 border-primary/30 bg-white/20"
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
      </main>

      {/* Mobile FAB */}
      <Link
        to="/plan/new"
        className="sm:hidden fixed bottom-6 right-6 z-40 btn-primary !rounded-full !p-4 shadow-glow-pink"
        aria-label="New quest"
      >
        <span className="text-xl">✦</span>
      </Link>
    </div>
  );
}
