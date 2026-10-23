import { motion } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { Panel, PanelHeader } from '../ui/Panel';
import { Badge } from '../ui/Badge';

interface IssueSummaryProps {
  critical: number;
  high: number;
  medium: number;
  low: number;
}

const LANES = [
  { label: 'Critical', bar: 'bg-red-400', glow: 'rgba(248,113,113,0.5)' },
  { label: 'High', bar: 'bg-orange-400', glow: 'rgba(251,146,60,0.5)' },
  { label: 'Medium', bar: 'bg-amber-400', glow: 'rgba(251,191,36,0.45)' },
  { label: 'Low', bar: 'bg-sky-400', glow: 'rgba(56,189,248,0.45)' },
] as const;

export default function IssueSummary({ critical, high, medium, low }: IssueSummaryProps) {
  const navigate = useNavigate();
  const values = [critical, high, medium, low];
  const total = critical + high + medium + low;

  return (
    <Panel
      className="rise cursor-pointer transition-colors hover:border-line-strong"
      style={{ animationDelay: '0.16s' }}
      onClick={() => navigate('/issues')}
    >
      <PanelHeader
        kicker="Issues"
        title="By severity"
        right={<Badge tone={total > 0 ? 'danger' : 'neutral'} dot={total > 0}>{total} open</Badge>}
      />

      {total === 0 ? (
        <div className="flex h-44 flex-col items-center justify-center text-center">
          <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-full border border-emerald-400/20 bg-emerald-400/10">
            <svg className="h-5 w-5 text-emerald-300" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75 11.25 15 15 9.75M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" />
            </svg>
          </div>
          <p className="text-sm text-slate-400">All clear</p>
          <p className="mt-0.5 text-xs text-slate-600">No open issues across the fleet</p>
        </div>
      ) : (
        <div className="space-y-4">
          {LANES.map((lane, i) => {
            const count = values[i];
            const pct = Math.round((count / total) * 100);
            return (
              <div key={lane.label}>
                <div className="mb-1.5 flex items-baseline justify-between text-xs">
                  <span className="text-slate-400">{lane.label}</span>
                  <span className="font-mono text-slate-300">
                    {count}
                    <span className="ml-1.5 text-slate-600">{pct}%</span>
                  </span>
                </div>
                <div className="h-1.5 overflow-hidden rounded-full bg-white/[0.06]">
                  <motion.div
                    initial={{ width: 0 }}
                    animate={{ width: `${pct}%` }}
                    transition={{ duration: 0.3, delay: 0.08 + i * 0.07, ease: [0.22, 1, 0.36, 1] }}
                    className={`h-full rounded-full ${lane.bar}`}
                    style={{ boxShadow: count > 0 ? `0 0 8px ${lane.glow}` : undefined }}
                  />
                </div>
              </div>
            );
          })}
        </div>
      )}
    </Panel>
  );
}
