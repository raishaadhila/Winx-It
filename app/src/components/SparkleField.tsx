import { useEffect, useState } from 'react';

type Star = {
  id: number;
  x: number;
  y: number;
  size: number;
  delay: number;
  duration: number;
  color: string;
};

const COLORS = ['#ffb7e9', '#94f1fb', '#b1dd00', '#f8b1e2', '#ffd7f0'];

function generateStars(count: number): Star[] {
  return Array.from({ length: count }, (_, i) => ({
    id: i,
    x: Math.random() * 100,
    y: Math.random() * 100,
    size: 4 + Math.random() * 8,
    delay: Math.random() * 3,
    duration: 2 + Math.random() * 3,
    color: COLORS[Math.floor(Math.random() * COLORS.length)],
  }));
}

type Props = {
  count?: number;
  className?: string;
};

export function SparkleField({ count = 25, className }: Props) {
  const [stars, setStars] = useState<Star[]>(() => generateStars(count));

  useEffect(() => {
    setStars(generateStars(count));
  }, [count]);

  return (
    <div className={`pointer-events-none absolute inset-0 overflow-hidden ${className ?? ''}`}>
      {stars.map((s) => (
        <span
          key={s.id}
          aria-hidden
          className="absolute animate-twinkle"
          style={{
            left: `${s.x}%`,
            top: `${s.y}%`,
            fontSize: `${s.size}px`,
            color: s.color,
            animationDelay: `${s.delay}s`,
            animationDuration: `${s.duration}s`,
            textShadow: `0 0 8px ${s.color}`,
          }}
        >
          ✦
        </span>
      ))}
    </div>
  );
}
