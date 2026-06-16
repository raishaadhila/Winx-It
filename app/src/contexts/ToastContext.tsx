import { createContext, useCallback, useContext, useState, type ReactNode } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { cn } from '../lib/cn';

export type ToastVariant = 'success' | 'error' | 'info';

export type Toast = {
  id: number;
  message: string;
  variant: ToastVariant;
};

type ToastCtx = {
  show: (message: string, variant?: ToastVariant) => void;
  success: (message: string) => void;
  error: (message: string) => void;
};

const Ctx = createContext<ToastCtx | null>(null);

const ICONS: Record<ToastVariant, string> = {
  success: '✦',
  error: '⚠',
  info: 'ℹ',
};

const COLORS: Record<ToastVariant, string> = {
  success: 'border-[#b1dd00]/50 shadow-glow-lime',
  error: 'border-error/50',
  info: 'border-[#94f1fb]/50 shadow-glow-blue',
};

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const dismiss = useCallback((id: number) => {
    setToasts((t) => t.filter((x) => x.id !== id));
  }, []);

  const show = useCallback(
    (message: string, variant: ToastVariant = 'info') => {
      const id = Date.now() + Math.random();
      setToasts((t) => [...t, { id, message, variant }]);
      setTimeout(() => dismiss(id), 4000);
    },
    [dismiss],
  );

  const value: ToastCtx = {
    show,
    success: (m) => show(m, 'success'),
    error: (m) => show(m, 'error'),
  };

  return (
    <Ctx.Provider value={value}>
      {children}
      <div className="fixed top-4 right-4 z-[100] flex flex-col gap-2 max-w-sm pointer-events-none">
        <AnimatePresence>
          {toasts.map((t) => (
            <motion.button
              key={t.id}
              type="button"
              onClick={() => dismiss(t.id)}
              initial={{ opacity: 0, x: 40, scale: 0.95 }}
              animate={{ opacity: 1, x: 0, scale: 1 }}
              exit={{ opacity: 0, x: 40, scale: 0.95 }}
              transition={{ type: 'spring', stiffness: 350, damping: 28 }}
              className={cn(
                'glass-l3 pointer-events-auto text-left px-4 py-3 rounded-lg flex items-start gap-2 cursor-pointer',
                COLORS[t.variant],
              )}
            >
              <span
                className={cn(
                  'text-lg leading-none mt-0.5',
                  t.variant === 'success' && 'text-[#506600]',
                  t.variant === 'error' && 'text-error',
                  t.variant === 'info' && 'text-secondary',
                )}
              >
                {ICONS[t.variant]}
              </span>
              <p className="font-body text-body-md text-on-surface flex-1">{t.message}</p>
            </motion.button>
          ))}
        </AnimatePresence>
      </div>
    </Ctx.Provider>
  );
}

export function useToast() {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error('useToast must be used within ToastProvider');
  return ctx;
}
