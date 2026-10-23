import type { ReactNode } from 'react';

type Tone = 'neutral' | 'success' | 'warning' | 'danger' | 'info' | 'primary';

interface BadgeProps {
  tone?: Tone;
  dot?: boolean;
  pulse?: boolean;
  children: ReactNode;
  className?: string;
}

const tones: Record<Tone, string> = {
  neutral: 'bg-slate-100 text-slate-600 ring-slate-200',
  success: 'bg-emerald-50 text-emerald-700 ring-emerald-200',
  warning: 'bg-amber-50 text-amber-700 ring-amber-200',
  danger: 'bg-red-50 text-red-600 ring-red-200',
  info: 'bg-sky-50 text-sky-700 ring-sky-200',
  primary: 'bg-primary-50 text-primary-700 ring-primary-200',
};

const dotColors: Record<Tone, string> = {
  neutral: 'bg-slate-400',
  success: 'bg-emerald-400',
  warning: 'bg-amber-400',
  danger: 'bg-red-400',
  info: 'bg-sky-400',
  primary: 'bg-primary-400',
};

export function Badge({ tone = 'neutral', dot = false, pulse = false, children, className = '' }: BadgeProps) {
  return (
    <span
      className={[
        'inline-flex h-5 items-center gap-1.5 rounded-full px-2 text-[11px] font-medium ring-1 ring-inset',
        tones[tone],
        className,
      ].join(' ')}
    >
      {dot && (
        <span className="relative flex h-1.5 w-1.5">
          {pulse && (
            <span className={`absolute inline-flex h-full w-full animate-ping rounded-full opacity-60 ${dotColors[tone]}`} />
          )}
          <span className={`relative inline-flex h-1.5 w-1.5 rounded-full ${dotColors[tone]}`} />
        </span>
      )}
      {children}
    </span>
  );
}
