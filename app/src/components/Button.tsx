import { type ButtonHTMLAttributes, type ReactNode } from 'react';
import { cn } from '../lib/cn';

type Variant = 'primary' | 'outline' | 'ghost';

type Props = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: Variant;
  loading?: boolean;
  children: ReactNode;
};

export function Button({ variant = 'primary', loading, children, className, disabled, ...rest }: Props) {
  return (
    <button
      {...rest}
      disabled={disabled || loading}
      className={cn(
        variant === 'primary' && 'btn-primary',
        variant === 'outline' && 'btn-outline',
        variant === 'ghost' && 'btn-ghost',
        (disabled || loading) && 'opacity-60 cursor-not-allowed pointer-events-none',
        className,
      )}
    >
      {loading ? (
        <span className="flex items-center gap-2">
          <span className="inline-block animate-spin text-lg">✦</span>
          <span>Loading…</span>
        </span>
      ) : (
        children
      )}
    </button>
  );
}
