import { type TextareaHTMLAttributes, forwardRef, useId } from 'react';
import { cn } from '../lib/cn';

type Props = TextareaHTMLAttributes<HTMLTextAreaElement> & {
  label?: string;
  error?: string;
};

export const Textarea = forwardRef<HTMLTextAreaElement, Props>(function Textarea(
  { label, error, className, id: idProp, ...rest },
  ref,
) {
  const autoId = useId();
  const id = idProp ?? `textarea-${autoId}`;

  return (
    <div className="w-full">
      {label && (
        <label
          htmlFor={id}
          className="block font-label text-label-caps uppercase text-on-surface-variant mb-1.5"
        >
          {label}
        </label>
      )}
      <textarea
        id={id}
        ref={ref}
        {...rest}
        className={cn(
          'glass-input rounded-lg w-full px-4 py-3 font-body text-body-md text-on-surface placeholder:text-primary/40 outline-none resize-y min-h-[140px]',
          error && 'border-error',
          className,
        )}
      />
      {error && (
        <p className="mt-1 font-label text-label-caps text-error">{error}</p>
      )}
    </div>
  );
});
