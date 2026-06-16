import { type InputHTMLAttributes, forwardRef, useId } from 'react';
import { cn } from '../lib/cn';

type Props = InputHTMLAttributes<HTMLInputElement> & {
  label?: string;
  error?: string;
  icon?: React.ReactNode;
  invalid?: boolean;
};

export const Input = forwardRef<HTMLInputElement, Props>(function Input(
  { label, error, icon, invalid, className, id: idProp, ...rest },
  ref,
) {
  const autoId = useId();
  const id = idProp ?? `input-${autoId}`;

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
      <div
        className={cn(
          'glass-input flex items-center gap-2 px-4 py-3 transition-all',
          (error || invalid) && 'invalid',
        )}
      >
        {icon && <span className="text-primary/70 text-lg shrink-0">{icon}</span>}
        <input
          id={id}
          ref={ref}
          {...rest}
          className={cn(
            'w-full bg-transparent outline-none font-body text-body-md text-on-surface placeholder:text-primary/40',
            className,
          )}
        />
      </div>
      {error && (
        <p className="mt-1 font-label text-label-caps text-error">{error}</p>
      )}
    </div>
  );
});
