import { FAIRIES, type FairyId, PILLAR_COLORS, type PillarId } from '../data/mock';
import { cn } from '../lib/cn';

type Props = {
  fairy: FairyId;
  size?: 'sm' | 'md' | 'lg' | 'xl';
  ringColor?: PillarId;
  showGlow?: boolean;
  className?: string;
};

const SIZES = {
  sm: 'w-10 h-10 text-xl',
  md: 'w-16 h-16 text-3xl',
  lg: 'w-24 h-24 text-5xl',
  xl: 'w-36 h-36 text-7xl',
};

export function Avatar({ fairy, size = 'md', ringColor, showGlow, className }: Props) {
  const f = FAIRIES[fairy];
  const ring = ringColor ? PILLAR_COLORS[ringColor] : null;

  return (
    <div
      className={cn(
        'relative inline-flex items-center justify-center rounded-full transition-transform duration-300',
        'border-2 border-white',
        SIZES[size],
        showGlow && 'animate-float',
        className,
      )}
      style={{
        background: `radial-gradient(circle at 30% 30%, ${f.colors.from}, ${f.colors.to})`,
        boxShadow: showGlow
          ? `0 0 24px ${f.colors.from}80, 0 0 48px ${f.colors.to}40`
          : '0 4px 16px rgba(133, 75, 118, 0.2)',
        outline: ring ? `3px solid currentColor` : undefined,
        color: ring ? (PILLAR_COLORS[ringColor!].text.includes('#006f78') ? '#94f1fb' : '#ffb7e9') : undefined,
      }}
      aria-label={`${f.name} avatar`}
    >
      <span aria-hidden className="drop-shadow-sm">
        {f.emoji}
      </span>
      <span
        aria-hidden
        className="absolute -top-1 -right-1 text-white text-xs animate-twinkle"
        style={{ color: f.colors.from }}
      >
        ✦
      </span>
    </div>
  );
}
