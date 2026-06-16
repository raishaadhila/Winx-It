import { useRef, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { cn } from '../lib/cn';
import type { Attachment, AttachmentKind } from '../lib/types';

const KIND_EMOJI: Record<AttachmentKind, string> = {
  image: '🖼️',
  file: '📄',
  link: '🔗',
};

// Match http(s) URLs up to the next whitespace or angle bracket.
const URL_RE = /\bhttps?:\/\/[^\s<>"]+/gi;

// Strip common trailing punctuation that doesn't belong to a URL.
const TRAILING_PUNCT = /[.,!?)\]}]+$/;

type Props = {
  attachments: Attachment[];
  onChange: (next: Attachment[]) => void;
};

/**
 * Attachments panel: shows attached items as removable chips, and has
 * controls to add a file, image, or link. No enforced size limit.
 *
 * Files/images are read as data URLs so they can be sent to the AI
 * without a separate upload backend.
 */
export function AttachmentsPanel({ attachments, onChange }: Props) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [linkInput, setLinkInput] = useState('');
  const [showLinkInput, setShowLinkInput] = useState(false);

  const addFiles = async (files: FileList | null) => {
    if (!files || files.length === 0) return;
    const next: Attachment[] = [...attachments];
    for (const f of Array.from(files)) {
      const isImage = f.type.startsWith('image/');
      const kind: AttachmentKind = isImage ? 'image' : 'file';
      const value = await readAsDataUrl(f);
      next.push({
        id: crypto.randomUUID(),
        kind,
        name: f.name,
        value,
        size: f.size,
        mime: f.type || undefined,
      });
    }
    onChange(next);
  };

  const addLink = () => {
    const url = linkInput.trim();
    if (!url) return;
    // Auto-prepend https:// if no protocol
    const normalized = /^https?:\/\//i.test(url) ? url : `https://${url}`;
    onChange([
      ...attachments,
      { id: crypto.randomUUID(), kind: 'link', name: normalized, value: normalized },
    ]);
    setLinkInput('');
    setShowLinkInput(false);
  };

  const remove = (id: string) => onChange(attachments.filter((a) => a.id !== id));

  return (
    <div className="space-y-2">
      <label className="block font-label text-label-caps uppercase text-on-surface-variant">
        Attachments
      </label>

      {/* Chips */}
      {attachments.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          <AnimatePresence>
            {attachments.map((a) => (
              <motion.div
                key={a.id}
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.9 }}
                transition={{ duration: 0.15 }}
                className="inline-flex items-center gap-1.5 pl-2 pr-1 py-1 rounded-full bg-white/55 border border-white/60"
              >
                <span aria-hidden className="text-sm leading-none">
                  {KIND_EMOJI[a.kind]}
                </span>
                <span className="font-label text-label-caps text-on-surface max-w-[180px] truncate">
                  {a.name}
                </span>
                <button
                  type="button"
                  onClick={() => remove(a.id)}
                  className="ml-0.5 w-5 h-5 rounded-full hover:bg-error/15 text-on-surface-variant hover:text-error flex items-center justify-center"
                  aria-label={`Remove ${a.name}`}
                >
                  ✕
                </button>
              </motion.div>
            ))}
          </AnimatePresence>
        </div>
      )}

      {/* Add controls */}
      <div className="flex flex-wrap items-center gap-2">
        <input
          ref={fileRef}
          type="file"
          multiple
          className="hidden"
          onChange={(e) => addFiles(e.target.files)}
        />
        <button
          type="button"
          onClick={() => fileRef.current?.click()}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-white/55 hover:bg-white/75 font-label text-label-caps uppercase text-primary transition"
        >
          📎 Attach file or image
        </button>
        <button
          type="button"
          onClick={() => setShowLinkInput((v) => !v)}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-white/55 hover:bg-white/75 font-label text-label-caps uppercase text-primary transition"
        >
          🔗 Add link
        </button>
        {attachments.length > 0 && (
          <button
            type="button"
            onClick={() => onChange([])}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full font-label text-label-caps uppercase text-on-surface-variant hover:text-error transition"
          >
            Clear all
          </button>
        )}
      </div>

      <AnimatePresence>
        {showLinkInput && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="overflow-hidden"
          >
            <div className="flex gap-2 pt-1">
              <input
                type="url"
                value={linkInput}
                onChange={(e) => setLinkInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    addLink();
                  }
                }}
                placeholder="https://example.com/article"
                className={cn(
                  'flex-1 px-3 py-2 rounded-lg bg-white/55 backdrop-blur-[8px]',
                  'font-body text-body-md text-on-surface placeholder:text-primary/40',
                  'outline-none transition-all',
                )}
                autoFocus
              />
              <button
                type="button"
                onClick={addLink}
                className="btn-primary !py-2 !px-4"
              >
                Add
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function readAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

/** Extract URLs from a string. */
export function extractUrls(text: string): string[] {
  const found = text.match(URL_RE) ?? [];
  const cleaned = found.map((u) => u.replace(TRAILING_PUNCT, '').trim());
  return Array.from(new Set(cleaned));
}
