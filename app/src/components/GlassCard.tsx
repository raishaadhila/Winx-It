import { type ReactNode } from 'react';
import { cn } from '../lib/cn';

type Props = {
  children: ReactNode;
  className?: string;
  level?: 1 | 2 | 3;
  hoverable?: boolean;
  onClick?: () => void;
};

export function GlassCard({ children, className, level = 2, hoverable, onClick }: Props) {
  return (
    <div
      onClick={onClick}
      className={cn(
        'relative rounded-lg overflow-hidden transition-all duration-300',
        level === 1 && 'bg-white/40 backdrop-blur-glass border border-white/60',
        level === 2 && 'glass',
        level === 3 && 'glass-l3',
        hoverable && 'cursor-pointer hover:shadow-glass-hover hover:-translate-y-0.5',
        className,
      )}
    >
      {children}
      {hoverable && (
        <>
          <span className="absolute top-1.5 left-1.5 text-[10px] text-primary/60 animate-twinkle pointer-events-none">✦</span>
          <span className="absolute top-1.5 right-1.5 text-[10px] text-secondary/60 animate-twinkle pointer-events-none" style={{ animationDelay: '1s' }}>✦</span>
          <span className="absolute bottom-1.5 left-1.5 text-[10px] text-tertiary-container/80 animate-twinkle pointer-events-none" style={{ animationDelay: '2s' }}>✦</span>
          <span className="absolute bottom-1.5 right-1.5 text-[10px] text-primary/60 animate-twinkle pointer-events-none" style={{ animationDelay: '0.5s' }}>✦</span>
        </>
      )}
    </div>
  );
}
