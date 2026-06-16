import { passwordStrength } from '../lib/validation';
import { cn } from '../lib/cn';

type Props = { password: string; className?: string };

export function PasswordStrengthMeter({ password, className }: Props) {
  const s = passwordStrength(password);
  const pct = (s.score / 4) * 100;

  return (
    <div className={cn('mt-2', className)}>
      <div className="h-1 rounded-full bg-outline-variant/30 overflow-hidden">
        <div
          className="h-full rounded-full transition-all duration-300"
          style={{ width: `${pct}%`, background: s.color }}
        />
      </div>
      <div className="flex items-center justify-between mt-1">
        <span
          className="font-label text-[10px] uppercase tracking-wider transition-colors"
          style={{ color: s.color }}
        >
          {s.label}
        </span>
        {s.hint && (
          <span className="font-body text-[11px] text-on-surface-variant">{s.hint}</span>
        )}
      </div>
    </div>
  );
}
