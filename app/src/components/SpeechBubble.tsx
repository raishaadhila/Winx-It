import { motion, AnimatePresence } from 'framer-motion';
import type { ReactNode } from 'react';

type Props = {
  /** Message shown inside the bubble. Pass a string or rich node. */
  message: ReactNode;
  /** Direction the bubble points toward the avatar. */
  side?: 'right' | 'left';
};

/**
 * A speech bubble that points toward an avatar. Animates in when the
 * message changes (used by the dashboard sidebar for live stats).
 */
export function SpeechBubble({ message, side = 'right' }: Props) {
  return (
    <div
      className={`relative inline-block max-w-[220px] glass-l3 rounded-2xl px-4 py-3 ${
        side === 'right' ? 'ml-2' : 'mr-2'
      }`}
    >
      <span
        aria-hidden
        className={`absolute top-4 w-3 h-3 glass-l3 rotate-45 ${
          side === 'right' ? '-left-1.5' : '-right-1.5'
        }`}
      />
      <AnimatePresence mode="wait">
        <motion.p
          key={typeof message === 'string' ? message : 'msg'}
          initial={{ opacity: 0, y: 4 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -4 }}
          transition={{ duration: 0.25 }}
          className="font-body text-body-md text-on-surface leading-snug"
        >
          {message}
        </motion.p>
      </AnimatePresence>
    </div>
  );
}
