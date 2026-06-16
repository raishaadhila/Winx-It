import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { AmbientBackground } from '../components/AmbientBackground';
import { Button } from '../components/Button';
import { Chip } from '../components/Chip';
import { GlassCard } from '../components/GlassCard';
import { Textarea } from '../components/Textarea';
import { TopNav } from '../components/TopNav';
import { useToast } from '../contexts/ToastContext';
import { api, ApiError } from '../lib/api';
import { ENERGIES, TIMEFRAMES, type PillarId as Pillar, PILLAR_LABELS } from '../data/mock';

const PILLAR_OPTIONS: Pillar[] = ['tecna', 'flora', 'musa', 'bloom', 'stella'];
const PILLAR_COLORS: Record<Pillar, 'pink' | 'blue' | 'lime' | 'purple' | 'yellow'> = {
  tecna: 'blue',
  flora: 'lime',
  musa: 'pink',
  bloom: 'pink',
  stella: 'yellow',
};

const ENERGY_MAP: Record<string, 'deep' | 'physical' | 'creative' | 'balanced'> = {
  deep: 'deep',
  physical: 'physical',
  creative: 'creative',
  balanced: 'balanced',
};

export function PromptPage() {
  const nav = useNavigate();
  const toast = useToast();
  const [goal, setGoal] = useState('');
  const [timeframe, setTimeframe] = useState('3 months');
  const [energy, setEnergy] = useState('deep');
  const [pillars, setPillars] = useState<Set<Pillar>>(new Set(['tecna', 'flora']));
  const [generating, setGenerating] = useState(false);
  const [step, setStep] = useState(0);
  const [saving, setSaving] = useState(false);

  const togglePillar = (p: Pillar) => {
    const next = new Set(pillars);
    next.has(p) ? next.delete(p) : next.add(p);
    setPillars(next);
  };

  const generate = async () => {
    if (!goal.trim()) return;
    setGenerating(true);
    setSaving(false);
    setStep(0);

    // Animate the 3 steps
    const messages = ['Analyzing goal…', 'Mapping pillars…', 'Casting structure…'];
    let i = 0;
    const tick = () => {
      setStep(i);
      i++;
      if (i < messages.length) setTimeout(tick, 600);
    };
    setTimeout(tick, 600);

    try {
      const customDays = timeframe === 'custom' ? 60 : undefined;
      const generated = await api.plans.generate({
        goal,
        timeframe: timeframe as '1 month' | '3 months' | '6 months' | 'custom',
        custom_days: customDays,
        energy_focus: ENERGY_MAP[energy] ?? 'balanced',
        pillars: Array.from(pillars),
      });

      setSaving(true);
      setStep(3);
      const created = await api.plans.create({
        title: generated.title,
        goal_text: goal,
        timeframe,
        start_date: generated.start_date,
        end_date: generated.end_date,
        tasks: generated.tasks,
      });

      toast.success(`Plan created with ${created.tasks.length} tasks ✦`);
      nav('/dashboard');
    } catch (err) {
      setGenerating(false);
      setSaving(false);
      toast.error(err instanceof ApiError ? err.detail : 'Failed to generate plan');
    }
  };

  return (
    <div className="relative min-h-screen">
      <AmbientBackground />
      <TopNav />

      <main className="max-w-3xl mx-auto px-4 py-10">
        <GlassCard level={3} className="p-8 sm:p-10">
          <div className="text-center mb-8">
            <div className="flex items-center justify-center gap-2 mb-2">
              <span className="text-primary text-xl animate-twinkle">✦</span>
              <h1 className="font-display text-headline-lg-mobile md:text-headline-lg font-bold text-on-surface">
                What's your quest?
              </h1>
              <span className="text-primary text-xl animate-twinkle" style={{ animationDelay: '1s' }}>✦</span>
            </div>
            <p className="font-body text-body-md text-on-surface-variant">
              Tell us your goal. We'll transform it into a structured adventure.
            </p>
          </div>

          {!generating ? (
            <div className="space-y-6">
              <Textarea
                label="Your goal"
                placeholder={`E.g. "Set up Month 2 focusing on Medical Neuroscience modules and AI Brain Tumor dataset cleanups."`}
                value={goal}
                onChange={(e) => setGoal(e.target.value)}
                rows={6}
              />

              <div>
                <label className="block font-label text-label-caps uppercase text-on-surface-variant mb-2">
                  Timeframe
                </label>
                <div className="flex flex-wrap gap-2">
                  {TIMEFRAMES.map((t) => (
                    <Chip
                      key={t}
                      color="pink"
                      active={timeframe === t}
                      onClick={() => setTimeframe(t)}
                    >
                      ◯ {t}
                    </Chip>
                  ))}
                </div>
              </div>

              <div>
                <label className="block font-label text-label-caps uppercase text-on-surface-variant mb-2">
                  Energy focus
                </label>
                <div className="flex flex-wrap gap-2">
                  {ENERGIES.map((e) => (
                    <Chip
                      key={e.id}
                      color="blue"
                      active={energy === e.id}
                      onClick={() => setEnergy(e.id)}
                    >
                      {e.emoji} {e.label}
                    </Chip>
                  ))}
                </div>
              </div>

              <div>
                <label className="block font-label text-label-caps uppercase text-on-surface-variant mb-2">
                  Pillars to focus on
                </label>
                <div className="flex flex-wrap gap-2">
                  {PILLAR_OPTIONS.map((p) => (
                    <Chip
                      key={p}
                      color={PILLAR_COLORS[p]}
                      active={pillars.has(p)}
                      onClick={() => togglePillar(p)}
                    >
                      {pillars.has(p) ? '✓' : '+'} {PILLAR_LABELS[p].split(' · ')[0]}
                    </Chip>
                  ))}
                </div>
              </div>

              <div className="flex justify-end pt-2">
                <Button onClick={generate} disabled={!goal.trim()} className="px-8">
                  ✦ Generate my plan
                </Button>
              </div>
            </div>
          ) : (
            <div className="py-16 flex flex-col items-center justify-center gap-4">
              <div className="relative">
                <div className="w-20 h-20 rounded-full bg-gradient-to-br from-[#ffb7e9] to-[#94f1fb] animate-pulse-glow" />
                <span className="absolute inset-0 flex items-center justify-center text-3xl animate-spin">✦</span>
              </div>
              <p className="font-display text-xl font-bold text-primary text-glow-pink">
                {saving
                  ? 'Saving your quest…'
                  : ['Analyzing goal…', 'Mapping pillars…', 'Casting structure…'][step]}
              </p>
              <div className="flex gap-2 mt-2">
                {(saving ? [0, 1, 2, 3] : [0, 1, 2]).map((i) => (
                  <span
                    key={i}
                    className={`w-2 h-2 rounded-full transition-all ${
                      i === step
                        ? 'bg-primary scale-150'
                        : i < step
                          ? 'bg-primary/60'
                          : 'bg-primary/20'
                    }`}
                  />
                ))}
              </div>
            </div>
          )}
        </GlassCard>
      </main>
    </div>
  );
}
