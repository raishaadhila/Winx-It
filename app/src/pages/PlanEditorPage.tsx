import { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { AmbientBackground } from '../components/AmbientBackground';
import { Button } from '../components/Button';
import { Confetti } from '../components/Confetti';
import { GlassCard } from '../components/GlassCard';
import { PillBadge } from '../components/PillBadge';
import { Skeleton, SkeletonCard } from '../components/Skeleton';
import { TopNav } from '../components/TopNav';
import { useProfile } from '../contexts/ProfileContext';
import { useToast } from '../contexts/ToastContext';
import { api, ApiError } from '../lib/api';
import { cn } from '../lib/cn';
import type { Plan, Task } from '../lib/types';

type Tab = 'table' | 'timeline' | 'pillars';

export function PlanEditorPage() {
  const { id } = useParams<{ id: string }>();
  const toast = useToast();
  const { applyLocal } = useProfile();

  const [plan, setPlan] = useState<Plan | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [tab, setTab] = useState<Tab>('table');
  const [editing, setEditing] = useState<string | null>(null);
  const [confetti, setConfetti] = useState(false);
  const [saving, setSaving] = useState<string | null>(null);
  const [completing, setCompleting] = useState<string | null>(null);

  useEffect(() => {
    if (!id) return;
    setLoading(true);
    setError(null);
    api.plans
      .get(id)
      .then(setPlan)
      .catch((err) => setError(err instanceof ApiError ? err.detail : (err as Error).message))
      .finally(() => setLoading(false));
  }, [id]);

  const updateTaskLocal = (taskId: string, patch: Partial<Task>) => {
    setPlan((p) =>
      p
        ? { ...p, tasks: p.tasks.map((t) => (t.id === taskId ? { ...t, ...patch } : t)) }
        : p,
    );
  };

  const startEdit = (taskId: string) => setEditing(taskId);
  const commitEdit = async (taskId: string, value: string) => {
    setEditing(null);
    if (!plan) return;
    const original = plan.tasks.find((t) => t.id === taskId)?.description;
    if (original === value) return;
    updateTaskLocal(taskId, { description: value });
    setSaving(taskId);
    try {
      const updated = await api.tasks.update(plan.id, taskId, { description: value });
      updateTaskLocal(taskId, updated);
    } catch (err) {
      updateTaskLocal(taskId, { description: original });
      toast.error(err instanceof ApiError ? err.detail : 'Failed to save task');
    } finally {
      setSaving(null);
    }
  };

  const completeTask = async (task: Task) => {
    if (task.done) return;
    if (!plan) return;
    setCompleting(task.id);
    updateTaskLocal(task.id, { done: true });
    try {
      const res = await api.tasks.complete(plan.id, task.id);
      updateTaskLocal(task.id, res.task);
      applyLocal({
        total_xp: res.new_total_xp,
        level: res.new_level,
        current_streak: res.streak,
      });
      if (res.leveled_up) {
        toast.success(`🎉 Level ${res.new_level} unlocked! +${res.xp_awarded} XP`);
        setConfetti(true);
      } else {
        toast.success(`+${res.xp_awarded} XP ✦`);
      }
    } catch (err) {
      updateTaskLocal(task.id, { done: false });
      toast.error(err instanceof ApiError ? err.detail : 'Failed to complete task');
    } finally {
      setCompleting(null);
    }
  };

  const todayTasks = plan?.tasks.filter((t) => t.day <= 3) ?? [];
  const allTodayDone = todayTasks.length > 0 && todayTasks.every((t) => t.done);

  const handleDayComplete = () => {
    if (allTodayDone) setConfetti(true);
  };

  if (loading) {
    return (
      <div className="relative min-h-screen pb-20">
        <AmbientBackground />
        <TopNav />
        <main className="max-w-content mx-auto px-4 sm:px-6 py-6 space-y-4">
          <Skeleton rows={2} />
          <SkeletonCard className="h-96" />
        </main>
      </div>
    );
  }

  if (error || !plan) {
    return (
      <div className="relative min-h-screen pb-20">
        <AmbientBackground />
        <TopNav />
        <main className="max-w-content mx-auto px-4 sm:px-6 py-6">
          <GlassCard className="p-8 text-center border border-error/30 bg-error-container/20">
            <span className="text-3xl">⚠</span>
            <p className="mt-2 font-display text-lg font-bold text-on-surface">
              Couldn't load plan
            </p>
            <p className="mt-1 font-body text-body-md text-on-surface-variant">
              {error ?? 'Plan not found.'}
            </p>
            <Link to="/dashboard" className="mt-4 inline-block">
              <Button variant="outline">← Back to dashboard</Button>
            </Link>
          </GlassCard>
        </main>
      </div>
    );
  }

  return (
    <div className="relative min-h-screen pb-20">
      <AmbientBackground />
      <TopNav />
      <Confetti fire={confetti} onDone={() => setConfetti(false)} />

      <main className="max-w-content mx-auto px-4 sm:px-6 py-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
          <div>
            <Link
              to="/dashboard"
              className="font-label text-label-caps uppercase text-primary hover:underline"
            >
              ← Back to dashboard
            </Link>
            <h1 className="font-display text-headline-lg-mobile md:text-headline-lg font-extrabold text-on-surface mt-1">
              {plan.title}
            </h1>
            <p className="font-body text-body-md text-on-surface-variant">
              {plan.start_date} → {plan.end_date} · {plan.tasks.length} tasks ·{' '}
              {plan.tasks.filter((t) => t.done).length} done
            </p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline">✎ Edit title</Button>
            <Button>💾 Save</Button>
          </div>
        </div>

        <div className="flex gap-1 p-1 glass rounded-full w-fit mb-4">
          {(['table', 'timeline', 'pillars'] as Tab[]).map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={cn(
                'px-4 py-1.5 rounded-full font-label text-label-caps uppercase transition-all',
                tab === t
                  ? 'bg-gradient-to-r from-[#ffb7e9] to-[#94f1fb] text-white shadow-glow-pink'
                  : 'text-on-surface-variant hover:bg-white/40',
              )}
            >
              {t}
            </button>
          ))}
        </div>

        {tab === 'table' && (
          <GlassCard className="overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-outline-variant/40">
                    <th className="px-4 py-3 text-left font-label text-label-caps text-on-surface-variant">Done</th>
                    <th className="px-4 py-3 text-left font-label text-label-caps text-on-surface-variant">Day</th>
                    <th className="px-4 py-3 text-left font-label text-label-caps text-on-surface-variant">Week</th>
                    <th className="px-4 py-3 text-left font-label text-label-caps text-on-surface-variant">Date</th>
                    <th className="px-4 py-3 text-left font-label text-label-caps text-on-surface-variant">Task</th>
                    <th className="px-4 py-3 text-left font-label text-label-caps text-on-surface-variant">Pillar</th>
                    <th className="px-4 py-3 text-left font-label text-label-caps text-on-surface-variant">Hrs</th>
                  </tr>
                </thead>
                <tbody>
                  {plan.tasks.map((t) => (
                    <tr
                      key={t.id}
                      className={cn(
                        'border-b border-outline-variant/20 hover:bg-white/30 transition-colors',
                        t.done && 'opacity-60',
                        saving === t.id && 'opacity-50',
                      )}
                    >
                      <td className="px-4 py-2.5">
                        <button
                          onClick={() => completeTask(t)}
                          disabled={t.done || completing === t.id}
                          aria-label={t.done ? 'Done' : 'Mark done'}
                          className={cn(
                            'w-5 h-5 rounded-md border-2 flex items-center justify-center transition-all',
                            t.done
                              ? 'bg-gradient-to-br from-[#ffb7e9] to-[#94f1fb] border-transparent'
                              : 'border-outline-variant hover:border-primary',
                            completing === t.id && 'animate-pulse',
                          )}
                        >
                          {t.done && <span className="text-white text-xs">✓</span>}
                        </button>
                      </td>
                      <td className="px-4 py-2.5 font-label text-label-caps text-on-surface-variant">D{t.day}</td>
                      <td className="px-4 py-2.5 font-label text-label-caps text-on-surface-variant">W{t.week}</td>
                      <td className="px-4 py-2.5 font-body text-body-md text-on-surface-variant">{t.date}</td>
                      <td
                        className="px-4 py-2.5 font-body text-body-md text-on-surface cursor-pointer"
                        onClick={() => !t.done && startEdit(t.id)}
                      >
                        {editing === t.id ? (
                          <input
                            autoFocus
                            defaultValue={t.description}
                            onBlur={(e) => commitEdit(t.id, e.target.value)}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter') commitEdit(t.id, e.currentTarget.value);
                              if (e.key === 'Escape') setEditing(null);
                            }}
                            className="w-full bg-white/60 border border-primary/40 rounded px-2 py-1 outline-none"
                          />
                        ) : (
                          <span className={cn(t.done && 'line-through')}>{t.description}</span>
                        )}
                      </td>
                      <td className="px-4 py-2.5">
                        <PillBadge pillar={t.pillar} />
                      </td>
                      <td className="px-4 py-2.5 font-label text-label-caps text-on-surface-variant">{t.hours}h</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="p-4 border-t border-outline-variant/30 flex flex-wrap gap-2 justify-between items-center">
              <div className="flex gap-2">
                <Button variant="ghost">+ Add task</Button>
                <Button variant="outline">✦ Regenerate AI</Button>
              </div>
              <Button
                onClick={handleDayComplete}
                disabled={!allTodayDone}
                className={allTodayDone ? 'animate-pulse-glow' : ''}
              >
                ✓ Mark day complete
              </Button>
            </div>
          </GlassCard>
        )}

        {tab === 'timeline' && (
          <GlassCard className="p-6">
            <div className="space-y-4">
              {Array.from(new Set(plan.tasks.map((t) => t.day))).map((day) => {
                const dayTasks = plan.tasks.filter((t) => t.day === day);
                const dayDate = dayTasks[0]?.date;
                return (
                  <div key={day} className="flex gap-4">
                    <div className="flex flex-col items-center pt-1">
                      <div className="w-10 h-10 rounded-full bg-gradient-to-br from-[#ffb7e9] to-[#94f1fb] flex items-center justify-center text-white font-display font-bold shadow-glow-pink">
                        D{day}
                      </div>
                      <div className="w-px flex-1 bg-gradient-to-b from-primary/40 to-transparent mt-1" />
                    </div>
                    <div className="flex-1 pb-2">
                      <p className="font-label text-label-caps text-on-surface-variant mb-1">{dayDate}</p>
                      <div className="space-y-2">
                        {dayTasks.map((t) => (
                          <div
                            key={t.id}
                            className={cn(
                              'flex items-center gap-2 p-2 rounded-lg bg-white/40 border border-white/60',
                              t.done && 'opacity-60',
                            )}
                          >
                            <button
                              onClick={() => completeTask(t)}
                              disabled={t.done}
                              className={cn(
                                'w-4 h-4 rounded border-2 shrink-0',
                                t.done ? 'bg-primary border-primary' : 'border-outline-variant',
                              )}
                            />
                            <span className={cn('flex-1 font-body text-body-md', t.done && 'line-through')}>
                              {t.description}
                            </span>
                            <PillBadge pillar={t.pillar} />
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </GlassCard>
        )}

        {tab === 'pillars' && (
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {(['tecna', 'flora', 'musa', 'bloom', 'stella'] as const).map((pillar) => {
              const pTasks = plan.tasks.filter((t) => t.pillar === pillar);
              return (
                <GlassCard key={pillar} className="p-5" hoverable>
                  <div className="flex items-center justify-between mb-3">
                    <h3 className="font-display text-xl font-bold capitalize">{pillar}</h3>
                    <PillBadge pillar={pillar} />
                  </div>
                  <p className="font-label text-label-caps text-on-surface-variant mb-3">
                    {pTasks.length} tasks
                  </p>
                  <div className="space-y-1.5">
                    {pTasks.slice(0, 4).map((t) => (
                      <div
                        key={t.id}
                        className={cn('text-sm font-body text-on-surface', t.done && 'line-through opacity-60')}
                      >
                        · {t.description}
                      </div>
                    ))}
                    {pTasks.length > 4 && (
                      <p className="text-xs text-on-surface-variant">+ {pTasks.length - 4} more</p>
                    )}
                  </div>
                </GlassCard>
              );
            })}
          </div>
        )}

        {allTodayDone && (
          <div className="mt-4 p-4 glass-l3 rounded-lg text-center">
            <p className="font-display text-lg font-bold text-primary text-glow-pink">
              ✦ Day complete!
            </p>
          </div>
        )}

        {/* Sticky floating Save — per the wireframe, pinned to the base corner */}
        <div className="fixed bottom-6 right-6 z-30">
          <Button
            className="shadow-glow-pink animate-pulse-glow"
            onClick={() => toast.success('Plan saved ✦')}
          >
            💾 Save
          </Button>
        </div>
      </main>
    </div>
  );
}
