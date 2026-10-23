import { useId, type InputHTMLAttributes, type ReactNode } from 'react';

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
  hint?: string;
  /** Optional icon rendered at the leading edge */
  leftIcon?: ReactNode;
  /** Optional element (eye toggle, unit…) rendered at the trailing edge */
  rightSlot?: ReactNode;
}

export function Input({
  label,
  error,
  hint,
  leftIcon,
  rightSlot,
  className = '',
  id,
  ...rest
}: InputProps) {
  const autoId = useId();
  const inputId = id ?? (label ? `field-${autoId}` : undefined);

  return (
    <div className="w-full">
      {label && (
        <label htmlFor={inputId} className="mb-1.5 block text-[13px] font-medium text-slate-700">
          {label}
        </label>
      )}
      <div className="relative">
        {leftIcon && (
          <span className="pointer-events-none absolute inset-y-0 left-3.5 flex items-center text-slate-500 [&>svg]:h-[18px] [&>svg]:w-[18px]">
            {leftIcon}
          </span>
        )}
        <input
          id={inputId}
          className={[
            'h-10 w-full rounded-lg border bg-panel text-sm text-slate-800 transition-all duration-150',
            'placeholder:text-slate-400 hover:border-line-strong',
            'focus:outline-none focus:border-primary-400/60 focus:ring-2 focus:ring-primary-500/20',
            'disabled:cursor-not-allowed disabled:opacity-50',
            leftIcon ? 'pl-10' : 'pl-3.5',
            rightSlot ? 'pr-10' : 'pr-3.5',
            error
              ? 'border-red-500/50 focus:border-red-400/70 focus:ring-red-500/20'
              : 'border-line',
            className,
          ].join(' ')}
          aria-invalid={!!error}
          {...rest}
        />
        {rightSlot && (
          <span className="absolute inset-y-0 right-2.5 flex items-center">{rightSlot}</span>
        )}
      </div>
      {error ? (
        <p className="mt-1.5 flex items-center gap-1 text-xs text-red-600">
          <svg className="h-3.5 w-3.5 shrink-0" viewBox="0 0 20 20" fill="currentColor">
            <path
              fillRule="evenodd"
              d="M18 10a8 8 0 1 1-16 0 8 8 0 0 1 16 0Zm-8-5a.75.75 0 0 1 .75.75v4.5a.75.75 0 0 1-1.5 0v-4.5A.75.75 0 0 1 10 5Zm0 10a1 1 0 1 0 0-2 1 1 0 0 0 0 2Z"
              clipRule="evenodd"
            />
          </svg>
          {error}
        </p>
      ) : hint ? (
        <p className="mt-1.5 text-xs text-slate-500">{hint}</p>
      ) : null}
    </div>
  );
}
