import { useNavigate } from 'react-router-dom';
import { PieChart, Pie, Cell, ResponsiveContainer } from 'recharts';
import { Panel, PanelHeader } from '../ui/Panel';
import { Badge } from '../ui/Badge';

interface DeviceHealthChartProps {
  online: number;
  offline: number;
  error: number;
}

const STATUS = [
  { key: 'Online', color: '#34d399' },
  { key: 'Offline', color: '#fbbf24' },
  { key: 'Error', color: '#f87171' },
] as const;

export default function DeviceHealthChart({ online, offline, error }: DeviceHealthChartProps) {
  const navigate = useNavigate();
  const data = [
    { name: 'Online', value: online },
    { name: 'Offline', value: offline },
    { name: 'Error', value: error },
  ].filter((d) => d.value > 0);

  const total = online + offline + error;

  return (
    <Panel
      className="rise cursor-pointer transition-colors hover:border-line-strong"
      style={{ animationDelay: '0.12s' }}
      onClick={() => navigate('/devices')}
    >
      <PanelHeader
        kicker="Devices"
        title="Device health"
        right={<Badge tone="neutral">{total} total</Badge>}
      />

      {total === 0 ? (
        <div className="flex h-44 items-center justify-center">
          <p className="text-sm text-slate-600">No devices reporting yet</p>
        </div>
      ) : (
        <div className="flex items-center gap-6">
          {/* Donut */}
          <div className="relative h-40 w-40 shrink-0">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={data}
                  cx="50%"
                  cy="50%"
                  innerRadius={52}
                  outerRadius={72}
                  paddingAngle={3}
                  dataKey="value"
                  stroke="none"
                  animationDuration={700}
                  animationEasing="ease-out"
                >
                  {data.map((entry) => (
                    <Cell
                      key={entry.name}
                      fill={STATUS.find((s) => s.key === entry.name)?.color}
                      style={{ filter: 'drop-shadow(0 0 4px rgba(0,0,0,0.4))' }}
                    />
                  ))}
                </Pie>
              </PieChart>
            </ResponsiveContainer>
            <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
              <span className="font-mono text-xl font-semibold text-slate-900">{total}</span>
              <span className="text-[9px] uppercase tracking-wider text-slate-500">devices</span>
            </div>
          </div>

          {/* Legend */}
          <div className="min-w-0 flex-1 space-y-2.5">
            {data.map((item) => {
              const pct = Math.round((item.value / total) * 100);
              return (
                <div key={item.name} className="flex items-center gap-2.5">
                  <span
                    className="h-2 w-2 shrink-0 rounded-full"
                    style={{ backgroundColor: STATUS.find((s) => s.key === item.name)?.color }}
                  />
                  <span className="w-14 text-xs text-slate-400">{item.name}</span>
                  <span className="font-mono text-sm font-semibold text-slate-100">{item.value}</span>
                  <span className="ml-auto font-mono text-[11px] text-slate-600">{pct}%</span>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </Panel>
  );
}
