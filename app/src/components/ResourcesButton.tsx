import { useEffect, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { cn } from '../lib/cn';

export type Resource = {
  id: string;
  name: string;
  kind: 'link' | 'doc' | 'dataset';
  preview: string;
};

const SAMPLE_RESOURCES: Resource[] = [
  { id: '1', name: 'OpenStax Biology', kind: 'doc', preview: 'OpenStax textbook archive' },
  { id: '2', name: 'Hugging Face datasets', kind: 'dataset', preview: 'Curated ML datasets' },
  { id: '3', name: 'Notion workspace', kind: 'link', preview: 'Personal knowledge base' },
  { id: '4', name: 'Anki deck', kind: 'doc', preview: 'Spaced-repetition cards' },
];

type Props = {
  /** Called when a resource is picked; the planner will include it in the prompt context. */
  onPick?: (resource: Resource) => void;
};

const KIND_EMOJI: Record<Resource['kind'], string> = {
  link: '🔗',
  doc: '📄',
  dataset: '📊',
};

/**
 * "+ Resources" button that opens an overlay menu of pre-cataloged web
 * links, document archives, and datasets. Per the wireframe, clicking
 * toggles the menu; selecting a resource attaches it to the prompt.
 */
export function ResourcesButton({ onPick }: Props) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    function onClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener('mousedown', onClick);
    return () => document.removeEventListener('mousedown', onClick);
  }, [open]);

  return (
    <div ref={ref} className="relative inline-block">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        className={cn(
          'inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full font-label text-label-caps uppercase transition',
          'bg-white/55 hover:bg-white/75 text-primary',
        )}
      >
        <span className="text-base leading-none">+</span>
        Resources
      </button>

      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: -4, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -4, scale: 0.97 }}
            transition={{ duration: 0.12 }}
            className="absolute z-20 left-0 top-full mt-2 w-72 glass-l3 rounded-lg p-2"
          >
            <p className="px-3 py-1.5 font-label text-label-caps text-on-surface-variant">
              Attach to your quest
            </p>
            <ul className="space-y-0.5">
              {SAMPLE_RESOURCES.map((r) => (
                <li key={r.id}>
                  <button
                    type="button"
                    onClick={() => {
                      onPick?.(r);
                      setOpen(false);
                    }}
                    className="w-full text-left px-3 py-2 rounded flex items-center gap-2 hover:bg-white/50 transition"
                  >
                    <span aria-hidden className="text-lg">
                      {KIND_EMOJI[r.kind]}
                    </span>
                    <div className="flex-1 min-w-0">
                      <p className="font-body text-body-md text-on-surface truncate">
                        {r.name}
                      </p>
                      <p className="font-label text-label-caps text-on-surface-variant truncate">
                        {r.preview}
                      </p>
                    </div>
                  </button>
                </li>
              ))}
            </ul>
            <p className="px-3 py-1.5 mt-1 border-t border-outline-variant/30 font-label text-label-caps text-on-surface-variant text-center">
              More coming soon
            </p>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
