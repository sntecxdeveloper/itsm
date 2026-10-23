import { useEffect, useState, type ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';

interface MetricCardProps {
  title: string;
  value: number;
  icon: ReactNode;
  color?: string;
  trend?: { value: number; isUp: boolean };
  /** Small caption under the value, e.g. "2 offline · 1 error" */
  sub?: string;
  delay?: number;
  /** Route to drill into when the card is clicked */
  to?: string;
}

const tones: Record<string, string> = {
  primary: 'bg-primary-500/[0.13] text-primary-300 ring-primary-400/25',
  emerald: 'bg-emerald-400/10 text-emerald-300 ring-emerald-400/25',
  amber: 'bg-amber-400/10 text-amber-300 ring-amber-400/25',
  red: 'bg-red-400/10 text-red-300 ring-red-400/25',
  purple: 'bg-purple-400/10 text-purple-300 ring-purple-400/25',
  cyan: 'bg-cyan-400/10 text-cyan-300 ring-cyan-400/25',
};

function useCountUp(target: number, duration = 700) {
  const [count, setCount] = useState(0);

  useEffect(() => {
    const start = Date.now();
    let raf = 0;

    const step = () => {
      const progress = Math.min((Date.now() - start) / duration, 1);
      const eased = 1 - Math.pow(1 - progress, 3);
      setCount(Math.round(target * eased));
      if (progress < 1) raf = requestAnimationFrame(step);
    };

    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [target, duration]);

  return count;
}

export default function MetricCard({ title, value, icon, color = 'primary', trend, sub, delay = 0, to }: MetricCardProps) {
  const animatedValue = useCountUp(value);
  const tone = tones[color] || tones.primary;
  const navigate = useNavigate();

  return (
    <div
      role={to ? 'link' : undefined}
      tabIndex={to ? 0 : undefined}
      onClick={to ? () => navigate(to) : undefined}
      onKeyDown={to ? (e) => { if (e.key === 'Enter') navigate(to); } : undefined}
      className={`rise group relative overflow-hidden rounded-xl border border-line bg-panel p-5 shadow-card transition-all duration-200 hover:border-line-strong ${
        to ? 'cursor-pointer hover:-translate-y-px' : ''
      }`}
      style={{ animationDelay: `${delay}s` }}
    >
      {/* hover glow */}
      <div className="pointer-events-none absolute -right-8 -top-8 h-24 w-24 rounded-full bg-primary-500/[0.06] opacity-0 blur-2xl transition-opacity duration-300 group-hover:opacity-100" />

      <div className="relative flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="font-mono text-[10px] font-medium uppercase tracking-[0.18em] text-slate-500">
            {title}
          </p>
          <p className="mt-2.5 font-mono text-[30px] font-semibold leading-none text-slate-900 tabular-nums">
            {animatedValue.toLocaleString()}
          </p>

          {trend ? (
            <p className={`mt-2 inline-flex items-center gap-1 text-[11px] font-medium ${trend.isUp ? 'text-emerald-400' : 'text-red-400'}`}>
              <svg
                className={`h-3 w-3 ${trend.isUp ? '' : 'rotate-180'}`}
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth={2}
              >
                <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 19.5l15-15m0 0H8.25m11.25 0v11.25" />
              </svg>
              {trend.value}%
            </p>
          ) : sub ? (
            <p className="mt-2 truncate text-[11px] text-slate-500">{sub}</p>
          ) : null}
        </div>

        <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-lg ring-1 ring-inset [&>svg]:h-5 [&>svg]:w-5 ${tone}`}>
          {icon}
        </div>
      </div>

      {/* drill-in hint */}
      {to && (
        <span className="absolute bottom-4 right-4 flex h-5 w-5 items-center justify-center rounded-md border border-line text-slate-600 opacity-0 transition-all duration-200 group-hover:border-line-strong group-hover:text-slate-300 group-hover:opacity-100">
          <svg className="h-3 w-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 19.5l15-15m0 0H8.25m11.25 0v11.25" />
          </svg>
        </span>
      )}
    </div>
  );
}
