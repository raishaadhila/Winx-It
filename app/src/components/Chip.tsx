import { cn } from '../lib/cn';

type Props = {
  active?: boolean;
  onClick?: () => void;
  children: React.ReactNode;
  color?: 'pink' | 'blue' | 'lime' | 'purple' | 'yellow';
  className?: string;
};

const COLORS = {
  pink: { bg: 'bg-[#ffb7e9]/30', text: 'text-[#7c436e]', active: 'bg-[#ffb7e9]/60 shadow-glow-pink' },
  blue: { bg: 'bg-[#94f1fb]/30', text: 'text-[#006f78]', active: 'bg-[#94f1fb]/60 shadow-glow-blue' },
  lime: { bg: 'bg-[#b1dd00]/30', text: 'text-[#4a5e00]', active: 'bg-[#b1dd00]/60 shadow-glow-lime' },
  purple: { bg: 'bg-[#e1d2ff]/40', text: 'text-[#5b3a8a]', active: 'bg-[#e1d2ff]/70' },
  yellow: { bg: 'bg-[#ffd7f0]/30', text: 'text-[#854b76]', active: 'bg-[#ffd7f0]/60 shadow-glow-pink' },
};

export function Chip({ active, onClick, children, color = 'pink', className }: Props) {
  const c = COLORS[color];
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'chip',
        c.bg,
        c.text,
        active && ['chip-active', c.active],
        className,
      )}
    >
      {children}
    </button>
  );
}
