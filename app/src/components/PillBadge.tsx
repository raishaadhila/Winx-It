import { PILLAR_COLORS, PILLAR_LABELS, type PillarId } from '../data/mock';
import { cn } from '../lib/cn';

type Props = {
  pillar: PillarId;
  className?: string;
};

export function PillBadge({ pillar, className }: Props) {
  const c = PILLAR_COLORS[pillar];
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 px-2 py-0.5 rounded-full font-label text-[10px] uppercase tracking-wider',
        c.bg,
        c.text,
        className,
      )}
    >
      <span className="w-1.5 h-1.5 rounded-full bg-current" />
      {PILLAR_LABELS[pillar].split(' · ')[0]}
    </span>
  );
}
