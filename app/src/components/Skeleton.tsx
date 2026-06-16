import type { ReactNode } from 'react';
import { cn } from '../lib/cn';

type Props = {
  className?: string;
  rows?: number;
};

export function Skeleton({ className, rows = 1 }: Props) {
  return (
    <div className={cn('space-y-2', className)}>
      {Array.from({ length: rows }).map((_, i) => (
        <div
          key={i}
          className="shimmer-bg rounded-md h-4 w-full"
          style={{ width: `${100 - i * 8}%` }}
        />
      ))}
    </div>
  );
}

export function SkeletonCard({ children, className }: { children?: ReactNode; className?: string }) {
  return <div className={cn('glass rounded-lg p-5', className)}>{children ?? <Skeleton rows={3} />}</div>;
}
