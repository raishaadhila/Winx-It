import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { AmbientBackground } from '../components/AmbientBackground';
import { Avatar } from '../components/Avatar';
import { Button } from '../components/Button';
import { GlassCard } from '../components/GlassCard';
import { Input } from '../components/Input';
import { SparkleField } from '../components/SparkleField';
import { useProfile } from '../contexts/ProfileContext';
import { useToast } from '../contexts/ToastContext';
import { api, ApiError } from '../lib/api';
import { FAIRIES, type FairyId, type PillarId as Pillar, PILLAR_LABELS } from '../data/mock';
import type { Accent } from '../lib/types';

const COLOR_OPTIONS: { id: Accent; hex: string }[] = [
  { id: 'pink', hex: '#ffb7e9' },
  { id: 'blue', hex: '#94f1fb' },
  { id: 'lime', hex: '#b1dd00' },
  { id: 'purple', hex: '#a78bfa' },
  { id: 'yellow', hex: '#ffd7f0' },
];

export function AvatarPickerPage() {
  const nav = useNavigate();
  const { profile, refetch, applyLocal } = useProfile();
  const toast = useToast();
  const [selected, setSelected] = useState<FairyId>(profile?.fairy ?? 'tecna');
  const [pillar, setPillar] = useState<Pillar>(profile?.pillar ?? 'tecna');
  const [name, setName] = useState(profile?.name ?? '');
  const [accent, setAccent] = useState<Accent>(profile?.accent ?? 'blue');
  const [saving, setSaving] = useState(false);

  const f = FAIRIES[selected];

  const begin = async () => {
    setSaving(true);
    try {
      await api.me.updateAvatar({
        fairy: selected,
        pillar,
        accent,
        name: name.trim() || 'Fairy',
        avatar_seed: `${selected}-${Date.now()}`,
      });
      // Optimistic local update + refetch
      applyLocal({
        fairy: selected,
        pillar,
        accent,
        name: name.trim() || 'Fairy',
      });
      await refetch();
      toast.success(`Welcome, ${name || 'Fairy'} ✦`);
      nav('/dashboard');
    } catch (err) {
      const msg =
        err instanceof ApiError
          ? err.detail
          : err instanceof Error
            ? err.message
            : 'Could not save fairy';
      toast.error(msg);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="relative min-h-screen px-4 py-10">
      <AmbientBackground />
      <SparkleField count={20} />

      <div className="max-w-5xl mx-auto">
        <div className="text-center mb-8">
          <div className="flex items-center justify-center gap-2 mb-2">
            <span className="text-primary text-xl animate-twinkle">✦</span>
            <h1 className="font-display text-headline-lg-mobile md:text-headline-xl font-extrabold text-on-surface">
              Choose Your Fairy
            </h1>
            <span className="text-primary text-xl animate-twinkle" style={{ animationDelay: '1s' }}>✦</span>
          </div>
          <p className="font-body text-body-md text-on-surface-variant">
            Pick the energy that mirrors you.
          </p>
        </div>

        <div className="grid lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2">
            <GlassCard className="p-6">
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
                {(Object.keys(FAIRIES) as FairyId[]).map((id) => {
                  const fairy = FAIRIES[id];
                  const isSel = selected === id;
                  return (
                    <button
                      key={id}
                      onClick={() => {
                        setSelected(id);
                        setPillar(fairy.pillar);
                      }}
                      className={`relative p-5 rounded-lg flex flex-col items-center gap-2 transition-all duration-300 ${
                        isSel
                          ? 'bg-white/80 -translate-y-1 shadow-glow-pink border-2 border-primary-container'
                          : 'glass hover:-translate-y-0.5'
                      }`}
                    >
                      <Avatar fairy={id} size="lg" />
                      <p className="font-display text-lg font-bold text-on-surface">{fairy.name}</p>
                      <p className="font-label text-label-caps text-on-surface-variant text-center leading-tight">
                        {fairy.tagline}
                      </p>
                      {isSel && (
                        <span className="absolute -top-2 -right-2 w-7 h-7 rounded-full bg-gradient-to-br from-[#ffb7e9] to-[#94f1fb] flex items-center justify-center text-white text-sm shadow-glow-pink">
                          ✦
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>
            </GlassCard>
          </div>

          <div className="space-y-4">
            <GlassCard level={3} className="p-6 text-center">
              <p className="font-label text-label-caps text-on-surface-variant mb-3">Preview</p>
              <div className="flex justify-center mb-4">
                <Avatar fairy={selected} size="xl" showGlow />
              </div>
              <h2 className="font-display text-2xl font-bold text-on-surface mb-1">{f.name}</h2>
              <p className="font-label text-label-caps text-primary text-glow-pink">{f.tagline}</p>
            </GlassCard>

            <GlassCard className="p-5 space-y-4">
              <div>
                <label className="block font-label text-label-caps uppercase text-on-surface-variant mb-1.5">
                  Pillar
                </label>
                <select
                  value={pillar}
                  onChange={(e) => setPillar(e.target.value as Pillar)}
                  className="glass-input rounded-lg w-full px-3 py-2.5 font-body text-body-md text-on-surface outline-none"
                >
                  {(Object.keys(PILLAR_LABELS) as Pillar[]).map((p) => (
                    <option key={p} value={p}>
                      {PILLAR_LABELS[p]}
                    </option>
                  ))}
                </select>
              </div>

              <Input label="Display name" value={name} onChange={(e) => setName(e.target.value)} />

              <div>
                <label className="block font-label text-label-caps uppercase text-on-surface-variant mb-2">
                  Accent color
                </label>
                <div className="flex gap-2">
                  {COLOR_OPTIONS.map((c) => (
                    <button
                      key={c.id}
                      onClick={() => setAccent(c.id)}
                      aria-label={c.id}
                      className={`w-9 h-9 rounded-full transition-all duration-200 ${
                        accent === c.id
                          ? 'ring-2 ring-primary scale-110 shadow-glow-pink'
                          : 'ring-1 ring-white'
                      }`}
                      style={{ background: c.hex }}
                    />
                  ))}
                </div>
              </div>
            </GlassCard>
          </div>
        </div>

        <div className="flex justify-center mt-8">
          <Button onClick={begin} loading={saving} className="px-10">
            ✦ Begin transformation
          </Button>
        </div>
      </div>
    </div>
  );
}
