import { motion } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import type { Remediation } from '../../types';
import { Panel, PanelHeader } from '../ui/Panel';
import { Badge } from '../ui/Badge';

interface RemediationSummaryProps {
  remediations: Remediation[];
}

export default function RemediationSummary({ remediations }: RemediationSummaryProps) {
  const navigate = useNavigate();
  const recentCount = remediations.length;
  const completedCount = remediations.filter((r) => r.status === 'SUCCESS').length;
  const failedCount = remediations.filter((r) => r.status === 'FAILED').length;
  const successRate = recentCount > 0 ? Math.round((completedCount / recentCount) * 100) : 0;

  return (
    <Panel
      className="rise cursor-pointer transition-colors hover:border-line-strong"
      style={{ animationDelay: '0.24s' }}
      onClick={() => navigate('/remediation')}
    >
      <PanelHeader
        kicker="Remediation"
        title="Run performance"
        right={
          <Badge tone={successRate >= 80 ? 'success' : successRate >= 50 ? 'warning' : 'danger'} dot>
            {successRate}% success
          </Badge>
        }
      />

      {recentCount === 0 ? (
        <div className="py-6 text-center">
          <p className="text-sm text-slate-500">No remediation runs yet</p>
          <p className="mt-1 text-xs text-slate-600">Trigger a fix from any issue to see it here.</p>
        </div>
      ) : (
        <>
          {/* Success rate */}
          <div className="mb-5">
            <div className="mb-2 flex items-center justify-between text-xs">
              <span className="text-slate-500">Success rate</span>
              <span className="font-mono font-semibold text-slate-200">{successRate}%</span>
            </div>
            <div className="h-2 overflow-hidden rounded-full bg-slate-100">
              <motion.div
                initial={{ width: 0 }}
                animate={{ width: `${successRate}%` }}
                transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1], delay: 0.25 }}
                className="h-full rounded-full bg-gradient-to-r from-primary-600 to-emerald-400"
                style={{ boxShadow: '0 0 10px rgba(52,211,153,0.35)' }}
              />
            </div>
          </div>

          {/* Stats */}
          <div className="grid grid-cols-3 gap-3">
            <SummaryStat label="Total runs" value={recentCount} tone="text-slate-900" />
            <SummaryStat label="Succeeded" value={completedCount} tone="text-emerald-300" />
            <SummaryStat label="Failed" value={failedCount} tone="text-red-300" />
          </div>
        </>
      )}
    </Panel>
  );
}

function SummaryStat({ label, value, tone }: { label: string; value: number; tone: string }) {
  return (
    <div className="rounded-lg border border-line bg-slate-50 px-3 py-3 text-center">
      <p className={`font-mono text-2xl font-semibold tabular-nums leading-none ${tone}`}>{value}</p>
      <p className="mt-1.5 text-[10px] uppercase tracking-wider text-slate-600">{label}</p>
    </div>
  );
}
