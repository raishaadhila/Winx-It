import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { AmbientBackground } from '../components/AmbientBackground';
import { Avatar } from '../components/Avatar';
import { Button } from '../components/Button';
import { GlassCard } from '../components/GlassCard';
import { Input } from '../components/Input';
import { SparkleField } from '../components/SparkleField';
import { TopNav } from '../components/TopNav';
import { useProfile } from '../contexts/ProfileContext';
import { useToast } from '../contexts/ToastContext';
import { api, ApiError } from '../lib/api';
import { FAIRIES, PILLAR_LABELS, type FairyId, type PillarId } from '../data/mock';
import type { Accent } from '../lib/types';

const COLOR_OPTIONS: { id: Accent; hex: string }[] = [
  { id: 'pink', hex: '#ffb7e9' },
  { id: 'blue', hex: '#94f1fb' },
  { id: 'lime', hex: '#b1dd00' },
  { id: 'purple', hex: '#a78bfa' },
  { id: 'yellow', hex: '#ffd7f0' },
];

const MAX_AVATAR_BYTES = 1_500_000; // 1.5 MB

function readFileAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

export function SettingsPage() {
  const nav = useNavigate();
  const { profile, refetch, applyLocal } = useProfile();
  const toast = useToast();
  const fileRef = useRef<HTMLInputElement>(null);

  const [name, setName] = useState(profile?.name ?? '');
  const [fairy, setFairy] = useState<FairyId>(profile?.fairy ?? 'tecna');
  const [pillar, setPillar] = useState<PillarId>(profile?.pillar ?? 'tecna');
  const [accent, setAccent] = useState<Accent>(profile?.accent ?? 'blue');
  const [goals, setGoals] = useState(profile?.goal_text ?? '');
  const [avatarUrl, setAvatarUrl] = useState<string | null>(
    profile?.avatar_data_url ?? null,
  );
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);

  // Keep the form in sync if the profile refreshes from elsewhere
  useEffect(() => {
    if (!profile) return;
    setName(profile.name);
    setFairy(profile.fairy);
    setPillar(profile.pillar);
    setAccent(profile.accent);
    setGoals(profile.goal_text ?? '');
    setAvatarUrl(profile.avatar_data_url ?? null);
  }, [profile]);

  const onPickFairy = (id: FairyId) => {
    setFairy(id);
    // Mirror the onboarding behavior: switching fairy defaults the pillar
    setPillar(FAIRIES[id].pillar);
  };

  const onUploadAvatar = async (file: File | null) => {
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      toast.error('Please pick an image file');
      return;
    }
    if (file.size > MAX_AVATAR_BYTES) {
      toast.error('Image must be under 1.5 MB');
      return;
    }
    setUploading(true);
    try {
      const dataUrl = await readFileAsDataUrl(file);
      setAvatarUrl(dataUrl);
      toast.success('Avatar loaded — hit Save to apply ✦');
    } catch {
      toast.error('Could not read that file');
    } finally {
      setUploading(false);
    }
  };

  const onRemoveAvatar = () => {
    setAvatarUrl(null);
  };

  const dirty =
    name !== (profile?.name ?? '') ||
    fairy !== (profile?.fairy ?? 'tecna') ||
    pillar !== (profile?.pillar ?? 'tecna') ||
    accent !== (profile?.accent ?? 'blue') ||
    goals !== (profile?.goal_text ?? '') ||
    avatarUrl !== (profile?.avatar_data_url ?? null);

  const save = async () => {
    if (!dirty || saving) return;
    const trimmedName = name.trim();
    if (!trimmedName) {
      toast.error('Name cannot be empty');
      return;
    }
    setSaving(true);
    try {
      const updated = await api.me.update({
        name: trimmedName,
        fairy,
        pillar,
        accent,
        goal_text: goals,
        avatar_data_url: avatarUrl,
      });
      applyLocal({
        name: updated.name,
        fairy: updated.fairy,
        pillar: updated.pillar,
        accent: updated.accent,
        goal_text: updated.goal_text,
        avatar_data_url: updated.avatar_data_url,
      });
      await refetch();
      toast.success('Profile updated ✦');
    } catch (err) {
      const msg =
        err instanceof ApiError
          ? err.detail
          : err instanceof Error
            ? err.message
            : 'Could not save profile';
      toast.error(msg);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="relative min-h-screen pb-20">
      <AmbientBackground />
      <TopNav />
      <SparkleField count={20} />

      <main className="max-w-4xl mx-auto px-4 sm:px-6 py-8 space-y-6">
        <div>
          <button
            type="button"
            onClick={() => nav('/dashboard')}
            className="font-label text-label-caps uppercase text-primary hover:underline"
          >
            ← Back to dashboard
          </button>
          <h1 className="font-display text-headline-lg-mobile md:text-headline-lg font-extrabold text-on-surface mt-1">
            ✦ Settings
          </h1>
          <p className="font-body text-body-md text-on-surface-variant mt-1">
            Tune your fairy, your goals, and how you show up.
          </p>
        </div>

        {/* ---------- Identity ---------- */}
        <GlassCard className="p-6" level={3}>
          <h2 className="font-display text-headline-lg-mobile font-bold text-on-surface mb-4">
            Identity
          </h2>
          <div className="grid sm:grid-cols-[160px_1fr] gap-6 items-start">
            <div className="flex flex-col items-center gap-3">
              <Avatar
                fairy={fairy}
                size="xl"
                showGlow
                imageUrl={avatarUrl}
              />
              <input
                ref={fileRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={(e) => onUploadAvatar(e.target.files?.[0] ?? null)}
              />
              <div className="flex flex-col gap-2 w-full">
                <Button
                  onClick={() => fileRef.current?.click()}
                  loading={uploading}
                  className="!py-1.5 !px-3 !text-sm"
                >
                  📷 Upload image
                </Button>
                {avatarUrl && (
                  <Button
                    variant="ghost"
                    onClick={onRemoveAvatar}
                    className="!py-1.5 !px-3 !text-sm"
                  >
                    Remove image
                  </Button>
                )}
              </div>
              <p className="font-label text-label-caps text-on-surface-variant text-center">
                PNG / JPG · max 1.5 MB
              </p>
            </div>

            <div className="space-y-4">
              <Input
                label="Display name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Your fairy name"
                maxLength={80}
              />
              <div>
                <label className="block font-label text-label-caps uppercase text-on-surface-variant mb-2">
                  Personality · Fairy
                </label>
                <div className="grid grid-cols-3 sm:grid-cols-6 gap-2">
                  {(Object.keys(FAIRIES) as FairyId[]).map((id) => {
                    const isSel = fairy === id;
                    return (
                      <button
                        key={id}
                        type="button"
                        onClick={() => onPickFairy(id)}
                        aria-pressed={isSel}
                        className={`p-2 rounded-lg flex flex-col items-center gap-1 transition-all ${
                          isSel
                            ? 'bg-white/80 -translate-y-0.5 shadow-glow-pink border-2 border-primary-container'
                            : 'glass hover:-translate-y-0.5'
                        }`}
                      >
                        <Avatar fairy={id} size="sm" imageUrl={isSel ? avatarUrl : null} />
                        <span className="font-label text-[10px] uppercase text-on-surface">
                          {FAIRIES[id].name}
                        </span>
                      </button>
                    );
                  })}
                </div>
                <p className="font-body text-body-sm text-on-surface-variant mt-2">
                  {FAIRIES[fairy].tagline}
                </p>
              </div>
              <div className="grid sm:grid-cols-2 gap-4">
                <div>
                  <label
                    htmlFor="settings-pillar"
                    className="block font-label text-label-caps uppercase text-on-surface-variant mb-1.5"
                  >
                    Primary pillar
                  </label>
                  <select
                    id="settings-pillar"
                    value={pillar}
                    onChange={(e) => setPillar(e.target.value as PillarId)}
                    className="glass-input rounded-lg w-full px-3 py-2.5 font-body text-body-md text-on-surface outline-none"
                  >
                    {(Object.keys(PILLAR_LABELS) as PillarId[]).map((p) => (
                      <option key={p} value={p}>
                        {PILLAR_LABELS[p]}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block font-label text-label-caps uppercase text-on-surface-variant mb-2">
                    Accent color
                  </label>
                  <div className="flex gap-2">
                    {COLOR_OPTIONS.map((c) => (
                      <button
                        key={c.id}
                        type="button"
                        onClick={() => setAccent(c.id)}
                        aria-label={c.id}
                        aria-pressed={accent === c.id}
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
              </div>
            </div>
          </div>
        </GlassCard>

        {/* ---------- Goals ---------- */}
        <GlassCard className="p-6" level={3}>
          <h2 className="font-display text-headline-lg-mobile font-bold text-on-surface mb-2">
            My Goals
          </h2>
          <p className="font-body text-body-sm text-on-surface-variant mb-4">
            What are you casting toward? These are the long-term intentions
            that anchor every quest you spin up.
          </p>
          <textarea
            id="settings-goals"
            value={goals}
            onChange={(e) => setGoals(e.target.value)}
            rows={6}
            maxLength={2000}
            aria-label="My goals"
            placeholder={`e.g.\n- Ship the Chatty SaaS by Q3\n- Read 12 neuro papers this quarter\n- Run a 10k by August`}
            className="w-full rounded-lg bg-white/55 backdrop-blur-[8px] border border-white/60 px-3 py-2.5 font-body text-body-md text-on-surface placeholder:text-primary/40 outline-none focus:border-primary resize-y"
          />
          <p className="mt-1 text-right font-label text-label-caps text-on-surface-variant">
            {goals.length}/2000
          </p>
        </GlassCard>

        {/* ---------- Footer ---------- */}
        <div className="flex justify-end gap-3">
          <Button variant="ghost" onClick={() => nav('/dashboard')}>
            Cancel
          </Button>
          <Button onClick={save} loading={saving} disabled={!dirty}>
            ✦ Save changes
          </Button>
        </div>
      </main>
    </div>
  );
}
