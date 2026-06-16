import { useEffect, useRef } from 'react';
import confetti from 'canvas-confetti';

type Props = {
  fire: boolean;
  onDone?: () => void;
  duration?: number;
};

export function Confetti({ fire, onDone, duration = 2000 }: Props) {
  const onDoneRef = useRef(onDone);
  onDoneRef.current = onDone;

  useEffect(() => {
    if (!fire) return;
    const end = Date.now() + duration;
    const colors = ['#ffb7e9', '#94f1fb', '#b1dd00', '#f8b1e2', '#ffd7f0', '#854b76'];

    const frame = () => {
      confetti({
        particleCount: 4,
        angle: 60,
        spread: 55,
        origin: { x: 0, y: 0.7 },
        colors,
        shapes: ['circle', 'square'],
        scalar: 0.9,
      });
      confetti({
        particleCount: 4,
        angle: 120,
        spread: 55,
        origin: { x: 1, y: 0.7 },
        colors,
        shapes: ['circle', 'square'],
        scalar: 0.9,
      });
      if (Date.now() < end) {
        requestAnimationFrame(frame);
      } else {
        onDoneRef.current?.();
      }
    };
    frame();
  }, [fire, duration]);

  return null;
}
