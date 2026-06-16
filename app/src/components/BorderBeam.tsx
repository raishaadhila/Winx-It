import { motion, type MotionStyle, type Transition } from 'framer-motion';
import { cn } from '../lib/cn';

export type BorderBeamProps = {
  /** Square size of the beam in px. */
  size?: number;
  /** Loop duration in seconds. */
  duration?: number;
  /** Negative delay (so beams can be offset in time). */
  delay?: number;
  /** Gradient start color. */
  colorFrom?: string;
  /** Gradient end color (fades to transparent). */
  colorTo?: string;
  /** Custom motion transition. */
  transition?: Transition;
  className?: string;
  style?: React.CSSProperties;
  /** Reverse the path direction. */
  reverse?: boolean;
  /** Starting offset (0–100). */
  initialOffset?: number;
  /** Border width in px (parent must have a transparent border of this width). */
  borderWidth?: number;
};

/**
 * An animated beam of light that travels along the border of its parent.
 * The parent must have `position: relative` and a transparent border of
 * the configured width so the beam has somewhere to ride.
 *
 * Implementation note: uses CSS `offset-path` to travel a rounded-rect path
 * around the parent's perimeter, and a layered `mask` with `exclude`
 * composite to clip the beam to the border ring only.
 */
export function BorderBeam({
  className,
  size = 60,
  delay = 0,
  duration = 6,
  colorFrom = '#ffb7e9',
  colorTo = '#94f1fb',
  transition,
  style,
  reverse = false,
  initialOffset = 0,
  borderWidth = 1,
}: BorderBeamProps) {
  return (
    <div
      className="pointer-events-none absolute inset-0 rounded-[inherit] border-transparent"
      style={
        {
          borderWidth: `${borderWidth}px`,
          // Mask: keep only the border ring (border-box minus padding-box)
          WebkitMask:
            'linear-gradient(#fff 0 0) content-box, linear-gradient(#fff 0 0)',
          WebkitMaskComposite: 'xor',
          maskComposite: 'exclude',
          '--border-beam-width': `${borderWidth}px`,
        } as React.CSSProperties
      }
    >
      <motion.div
        className={cn('absolute aspect-square', className)}
        style={
          {
            width: size,
            offsetPath: `rect(0 auto auto 0 round ${size}px)`,
            background: `linear-gradient(to left, ${colorFrom}, ${colorTo}, transparent)`,
            filter: `blur(${borderWidth * 0.5}px)`,
            '--color-from': colorFrom,
            '--color-to': colorTo,
            ...style,
          } as MotionStyle
        }
        initial={{ offsetDistance: `${initialOffset}%` }}
        animate={{
          offsetDistance: reverse
            ? [`${100 - initialOffset}%`, `${-initialOffset}%`]
            : [`${initialOffset}%`, `${100 + initialOffset}%`],
        }}
        transition={{
          repeat: Infinity,
          ease: 'linear',
          duration,
          delay: -delay,
          ...transition,
        }}
      />
    </div>
  );
}
