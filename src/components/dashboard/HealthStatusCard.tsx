import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { getHealthSummary, type HealthSummary } from '../../api/deviceApi';
import { Panel, PanelHeader } from '../ui/Panel';
import { Badge } from '../ui/Badge';
import { Skeleton } from '../ui/Skeleton';

export default function HealthStatusCard() {
  const navigate = useNavigate();
  const [health, setHealth] = useState<HealthSummary | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getHealthSummary()
      .then(setHealth)
      .catch(() => setHealth(null))
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <Panel className="rise" style={{ animationDelay: '0.08s' }}>
        <Skeleton className="mb-4 h-3 w-32" />
        <div className="flex items-center gap-6">
          <Skeleton className="h-20 w-20 rounded-full" />
          <div className="grid flex-1 grid-cols-2 gap-3">
            <Skeleton className="h-8" />
            <Skeleton className="h-8" />
            <Skeleton className="h-8" />
            <Skeleton className="h-8" />
          </div>
        </div>
      </Panel>
    );
  }

  if (!health) return null;

  const healthPercentage =
    health.totalAgents > 0 ? Math.round((health.onlineAgents / health.totalAgents) * 100) : 0;
  const healthy = health.overallHealthy;

  return (
    <Panel
      className="rise cursor-pointer transition-colors hover:border-line-strong"
      style={{ animationDelay: '0.08s' }}
      onClick={() => navigate('/devices')}
    >
      <PanelHeader
        kicker="Fleet"
        title="System health"
        right={
          <Badge tone={healthy ? 'success' : 'warning'} dot pulse>
            {healthy ? 'Healthy' : 'Attention'}
          </Badge>
        }
      />

      <div className="flex items-center gap-6">
        {/* Ring */}
        <div className="relative h-[104px] w-[104px] shrink-0">
          <svg className="h-full w-full -rotate-90" viewBox="0 0 104 104">
            <circle cx="52" cy="52" r="44" fill="none" stroke="rgba(148,163,184,0.12)" strokeWidth="9" />
            <circle
              cx="52"
              cy="52"
              r="44"
              fill="none"
              stroke={healthy ? '#34d399' : '#fbbf24'}
              strokeWidth="9"
              strokeLinecap="round"
              strokeDasharray={`${(healthPercentage / 100) * 276.5} 276.5`}
              className="transition-all duration-1000 ease-out"
              style={{ filter: `drop-shadow(0 0 6px ${healthy ? 'rgba(52,211,153,0.5)' : 'rgba(251,191,36,0.4)'})` }}
            />
          </svg>
          <div className="absolute inset-0 flex flex-col items-center justify-center">
            <span className="font-mono text-lg font-semibold text-slate-900">{healthPercentage}%</span>
            <span className="text-[9px] uppercase tracking-wider text-slate-500">online</span>
          </div>
        </div>

        {/* Stats */}
        <div className="grid flex-1 grid-cols-2 gap-x-4 gap-y-3">
          <Stat label="Online" value={health.onlineAgents} tone="text-emerald-300" />
          <Stat label="Offline" value={health.offlineAgents} tone="text-red-300" />
          <Stat label="Total" value={health.totalAgents} tone="text-slate-900" />
          <Stat label="Open issues" value={health.openIssues} tone="text-amber-300" />
        </div>
      </div>
    </Panel>
  );
}

function Stat({ label, value, tone }: { label: string; value: number; tone: string }) {
  return (
    <div>
      <p className="font-mono text-xl font-semibold tabular-nums leading-none text-slate-900">
        <span className={tone}>{value}</span>
      </p>
      <p className="mt-1 text-[10px] uppercase tracking-wider text-slate-500">{label}</p>
    </div>
  );
}
