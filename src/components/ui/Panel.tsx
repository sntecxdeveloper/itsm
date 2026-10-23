import type { CSSProperties, ReactNode } from 'react';

interface PanelProps {
  children: ReactNode;
  className?: string;
  /** Inner padding — set false when a table/list owns its own spacing */
  padded?: boolean;
  style?: CSSProperties;
  onClick?: () => void;
}

export function Panel({ children, className = '', padded = true, style, onClick }: PanelProps) {
  return (
    <section
      className={`rounded-xl border border-line bg-panel shadow-card ${padded ? 'p-5' : ''} ${className}`}
      style={style}
      onClick={onClick}
    >
      {children}
    </section>
  );
}

interface PanelHeaderProps {
  title: string;
  /** Tiny mono label above the title */
  kicker?: string;
  right?: ReactNode;
  className?: string;
}

export function PanelHeader({ title, kicker, right, className = '' }: PanelHeaderProps) {
  return (
    <div className={`mb-4 flex items-start justify-between gap-3 ${className}`}>
      <div className="min-w-0">
        {kicker && (
          <p className="font-mono text-[10px] font-medium uppercase tracking-[0.18em] text-slate-600">
            {kicker}
          </p>
        )}
        <h3 className={`text-sm font-semibold text-slate-800 ${kicker ? 'mt-1' : ''}`}>{title}</h3>
      </div>
      {right && <div className="shrink-0">{right}</div>}
    </div>
  );
}
