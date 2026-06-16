import { PolarAngleAxis, PolarGrid, Radar, RadarChart as RC, ResponsiveContainer } from 'recharts';
import { PILLAR_LABELS, type PillarId } from '../data/mock';
import type { Profile } from '../lib/types';
import { GlassCard } from './GlassCard';

const PILLAR_ORDER: PillarId[] = ['tecna', 'flora', 'musa', 'bloom', 'stella'];
const SWATCH: Record<PillarId, string> = {
  tecna: '#94f1fb',
  flora: '#b1dd00',
  musa: '#f8b1e2',
  bloom: '#ffb7e9',
  stella: '#ffd7f0',
};

type Props = { profile: Profile | null };

export function RadarStats({ profile }: Props) {
  const data = PILLAR_ORDER.map((p) => ({
    pillar: PILLAR_LABELS[p].split(' · ')[0],
    value: profile?.pillar_xp[p] ?? 0,
    fullMark: 1000,
  }));

  return (
    <GlassCard className="p-5">
      <div className="flex items-center justify-between mb-2">
        <h3 className="font-display text-headline-lg-mobile md:text-headline-lg font-bold text-on-surface">
          Pillar Matrix
        </h3>
        <span className="font-label text-label-caps text-on-surface-variant">5-axis</span>
      </div>
      <div className="h-72 w-full">
        <ResponsiveContainer>
          <RC data={data} outerRadius="75%">
            <PolarGrid stroke="#d3c2cb" strokeDasharray="3 3" />
            <PolarAngleAxis
              dataKey="pillar"
              tick={{ fill: '#4f434b', fontSize: 12, fontFamily: 'Space Grotesk', fontWeight: 600 }}
            />
            <Radar
              name="XP"
              dataKey="value"
              stroke="#854b76"
              fill="#ffb7e9"
              fillOpacity={0.45}
              strokeWidth={2}
            />
          </RC>
        </ResponsiveContainer>
      </div>
      <div className="grid grid-cols-5 gap-1 mt-2">
        {PILLAR_ORDER.map((p) => (
          <div key={p} className="text-center">
            <div className="w-2 h-2 rounded-full mx-auto mb-1" style={{ background: SWATCH[p] }} />
            <p className="font-label text-[9px] uppercase text-on-surface-variant leading-tight">
              {p}
            </p>
          </div>
        ))}
      </div>
    </GlassCard>
  );
}
