import { useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { Panel, PanelHeader } from '../ui/Panel';
import { Badge } from '../ui/Badge';
import { Skeleton } from '../ui/Skeleton';
import type { IssueTrendPoint } from '../../api/issueApi';

interface IssueTrendChartProps {
  data: IssueTrendPoint[];
  loading?: boolean;
}

function shortDate(iso: string): string {
  const d = new Date(`${iso}T00:00:00`);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

export default function IssueTrendChart({ data, loading = false }: IssueTrendChartProps) {
  const navigate = useNavigate();
  const total = useMemo(() => data.reduce((sum, p) => sum + (Number(p.count) || 0), 0), [data]);
  const chartData = useMemo(
    () => data.map((p) => ({ date: p.date, label: shortDate(p.date), count: Number(p.count) || 0 })),
    [data]
  );

  return (
    <Panel className="rise h-full" style={{ animationDelay: '0.2s' }}>
      <PanelHeader
        kicker="Trend"
        title="Issue volume · last 14 days"
        right={<Badge tone={total > 0 ? 'danger' : 'success'}>{total} detected</Badge>}
      />

      {loading ? (
        <div className="space-y-2 pt-2">
          <Skeleton className="h-48 w-full" />
        </div>
      ) : chartData.length === 0 ? (
        <div className="flex h-52 flex-col items-center justify-center text-center">
          <p className="text-sm text-slate-500">No issue data yet</p>
          <p className="mt-0.5 text-xs text-slate-400">Detection history will appear here.</p>
        </div>
      ) : (
        <div className="h-52 pt-1">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={chartData} margin={{ top: 6, right: 8, left: -18, bottom: 0 }}>
              <defs>
                <linearGradient id="dexTrendFill" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#38bdf8" stopOpacity={0.35} />
                  <stop offset="100%" stopColor="#38bdf8" stopOpacity={0.02} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" vertical={false} />
              <XAxis
                dataKey="label"
                tick={{ fontSize: 10, fill: '#64748b' }}
                tickLine={false}
                axisLine={{ stroke: '#cbd5e1' }}
                minTickGap={28}
              />
              <YAxis
                allowDecimals={false}
                tick={{ fontSize: 10, fill: '#64748b' }}
                tickLine={false}
                axisLine={false}
              />
              <Tooltip
                cursor={{ stroke: '#bae6fd', strokeWidth: 1 }}
                contentStyle={{
                  borderRadius: 12,
                  border: '1px solid #e2e8f0',
                  boxShadow: '0 10px 30px -12px rgb(15 23 42 / 0.25)',
                  fontSize: 12,
                }}
                labelStyle={{ color: '#475569', fontWeight: 600 }}
                itemStyle={{ color: '#0284c7', fontWeight: 600 }}
              />
              <Area
                name="Issues"
                type="monotone"
                dataKey="count"
                stroke="#0284c7"
                strokeWidth={2}
                fill="url(#dexTrendFill)"
                activeDot={{ r: 4, fill: '#0284c7', strokeWidth: 0 }}
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      )}

      <div className="mt-3 flex items-center justify-between border-t border-line pt-3">
        <p className="text-xs text-slate-400">Issues detected per day across the fleet</p>
        <button
          onClick={() => navigate('/issues')}
          className="text-xs font-semibold text-primary-600 transition-colors hover:text-primary-700"
        >
          View all issues →
        </button>
      </div>
    </Panel>
  );
}
