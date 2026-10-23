import { useEffect, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { getHealthSummary } from '../../api/commandApi';
import { getDevices } from '../../api/deviceApi';
import { getLatestTelemetry } from '../../api/telemetryApi';
import { useWebSocket } from '../../hooks/useWebSocket';
import { Panel } from '../ui/Panel';
import { Badge } from '../ui/Badge';
import { Skeleton } from '../ui/Skeleton';
import type { Device } from '../../types';

interface HealthSummary {
  totalAgents: number;
  onlineAgents: number;
  offlineAgents: number;
  openIssues: number;
  overallHealthy: boolean;
}

interface AgentRow {
  agentId: string;
  hostname: string;
  status: string;
  healthy: boolean;
  cpuUsage: number | null;
  memoryUsage: number | null;
  diskUsage: number | null;
  lastHeartbeat: string | null;
}

const STATUS_META: Record<string, { label: string; text: string; dot: string }> = {
  ONLINE: { label: 'Healthy', text: 'text-emerald-300', dot: 'bg-emerald-400' },
  OFFLINE: { label: 'Offline', text: 'text-amber-300', dot: 'bg-amber-400' },
  ERROR: { label: 'Error', text: 'text-red-300', dot: 'bg-red-400' },
  ENROLLING: { label: 'Enrolling', text: 'text-sky-300', dot: 'bg-sky-400' },
};

export default function AgentHealthTable() {
  const navigate = useNavigate();
  const [summary, setSummary] = useState<HealthSummary | null>(null);
  const [agents, setAgents] = useState<AgentRow[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchData = useCallback(async () => {
    try {
      const [summaryData, devices] = await Promise.allSettled([getHealthSummary(), getDevices()]);

      if (summaryData.status === 'fulfilled') {
        setSummary(summaryData.value);
      }

      if (devices.status === 'fulfilled') {
        const deviceList = devices.value as Device[];

        // Fetch latest telemetry for every device in parallel so the
        // CPU / RAM / Disk bars show real values on first render instead
        // of waiting for the first WebSocket TELEMETRY_UPDATE push.
        const telemetryResults = await Promise.allSettled(
          deviceList.map((d) => getLatestTelemetry(d.agentId))
        );

        const telemetryMap = new Map<
          string,
          { cpuUsage: number | null; memoryUsage: number | null; diskUsage: number | null }
        >();
        telemetryResults.forEach((result, i) => {
          if (result.status === 'fulfilled') {
            const t = result.value;
            telemetryMap.set(deviceList[i].agentId, {
              cpuUsage: t.cpuUsage ?? null,
              memoryUsage: t.memoryUsage ?? null,
              diskUsage: t.diskUsage ?? null,
            });
          }
        });

        const rows: AgentRow[] = deviceList.map((d) => {
          const telem = telemetryMap.get(d.agentId);
          return {
            agentId: d.agentId,
            hostname: d.hostname,
            status: d.status,
            healthy: d.status === 'ONLINE',
            cpuUsage: telem?.cpuUsage ?? null,
            memoryUsage: telem?.memoryUsage ?? null,
            diskUsage: telem?.diskUsage ?? null,
            lastHeartbeat: d.lastHeartbeat ?? null,
          };
        });
        setAgents(rows);
      }
    } catch {
      // silent — health widgets tolerate offline backend
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
    const interval = setInterval(fetchData, 15000);
    return () => clearInterval(interval);
  }, [fetchData]);

  useWebSocket({
    topics: ['/topic/telemetry', '/topic/agents', '/topic/dashboard'],
    onMessage: useCallback(
      (data: unknown) => {
        const msg = data as Record<string, unknown>;
        const type = msg.type as string;

        if (type === 'TELEMETRY_UPDATE') {
          const agentId = msg.agentId as string;
          setAgents((prev) =>
            prev.map((a) =>
              a.agentId === agentId
                ? {
                    ...a,
                    cpuUsage: msg.cpuUsage as number,
                    memoryUsage: msg.memoryUsage as number,
                    diskUsage: msg.diskUsage as number,
                    lastHeartbeat: msg.recordedAt as string,
                    healthy: true,
                  }
                : a
            )
          );
        } else if (type === 'AGENT_STATUS_CHANGE') {
          const agentId = msg.agentId as string;
          const status = msg.status as string;
          setAgents((prev) =>
            prev.map((a) => (a.agentId === agentId ? { ...a, status, healthy: status === 'ONLINE' } : a))
          );
          getHealthSummary()
            .then(setSummary)
            .catch(() => {});
        } else if (type === 'REFRESH') {
          fetchData();
        }
      },
      [fetchData]
    ),
  });

  if (loading) {
    return (
      <Panel padded={false} className="rise" style={{ animationDelay: '0.2s' }}>
        <div className="space-y-4 p-5">
          <Skeleton className="h-3 w-44" />
          <div className="flex gap-3">
            <Skeleton className="h-16 flex-1" />
            <Skeleton className="h-16 flex-1" />
            <Skeleton className="h-16 flex-1" />
          </div>
          <Skeleton className="h-24 w-full" />
        </div>
      </Panel>
    );
  }

  return (
    <Panel padded={false} className="rise overflow-hidden" style={{ animationDelay: '0.2s' }}>
      {/* Header */}
      <div className="flex items-center justify-between px-5 pb-3 pt-5">
        <div className="flex items-center gap-3">
          <div>
            <p className="font-mono text-[10px] font-medium uppercase tracking-[0.18em] text-slate-600">Agents</p>
            <h3 className="mt-1 text-sm font-semibold text-slate-100">Fleet health</h3>
          </div>
          {summary && (
            <Badge tone={summary.overallHealthy ? 'success' : 'warning'} dot pulse className="ml-2">
              {summary.overallHealthy ? 'All healthy' : 'Attention needed'}
            </Badge>
          )}
        </div>
        {summary && (
          <span className="hidden font-mono text-[11px] text-slate-600 sm:block">
            {summary.totalAgents} enrolled
          </span>
        )}
      </div>

      {/* Summary tiles */}
      {summary && (
        <div className="grid grid-cols-3 gap-3 px-5 pb-5">
          <Tile label="Online" value={summary.onlineAgents} className="border-emerald-400/20 bg-emerald-400/[0.06] text-emerald-300" />
          <Tile label="Offline" value={summary.offlineAgents} className="border-red-400/20 bg-red-400/[0.06] text-red-300" />
          <Tile label="Open issues" value={summary.openIssues} className="border-amber-400/20 bg-amber-400/[0.06] text-amber-300" />
        </div>
      )}

      {/* Agent list */}
      {agents.length === 0 ? (
        <div className="border-t border-line px-5 py-14 text-center">
          <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-xl border border-line bg-panel-2">
            <svg className="h-6 w-6 text-slate-600" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 17.25v1.007a3 3 0 0 1-.879 2.122L7.5 21h9l-.621-.621A3 3 0 0 1 15 18.257V17.25m6-12V15a2.25 2.25 0 0 1-2.25 2.25H5.25A2.25 2.25 0 0 1 3 15V5.25m18 0A2.25 2.25 0 0 0 18.75 3H5.25A2.25 2.25 0 0 0 3 5.25m18 0v.243a2.25 2.25 0 0 1-1.07 1.916l-7.5 4.615a2.25 2.25 0 0 1-2.36 0L3.32 7.41A2.25 2.25 0 0 1 2.25 5.494V5.25" />
            </svg>
          </div>
          <p className="text-sm text-slate-400">No agents enrolled yet</p>
          <p className="mt-1 text-xs text-slate-600">Install the DEX agent on a machine to start monitoring it</p>
        </div>
      ) : (
        <div className="overflow-x-auto border-t border-line">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-white/[0.015]">
                <th className="px-5 py-3 text-left font-mono text-[10px] font-semibold uppercase tracking-[0.16em] text-slate-500">
                  Agent
                </th>
                <th className="px-5 py-3 text-left font-mono text-[10px] font-semibold uppercase tracking-[0.16em] text-slate-500">
                  Status
                </th>
                <th className="hidden px-5 py-3 text-left font-mono text-[10px] font-semibold uppercase tracking-[0.16em] text-slate-500 sm:table-cell">
                  CPU
                </th>
                <th className="hidden px-5 py-3 text-left font-mono text-[10px] font-semibold uppercase tracking-[0.16em] text-slate-500 sm:table-cell">
                  RAM
                </th>
                <th className="hidden px-5 py-3 text-left font-mono text-[10px] font-semibold uppercase tracking-[0.16em] text-slate-500 md:table-cell">
                  Disk
                </th>
                <th className="hidden px-5 py-3 text-left font-mono text-[10px] font-semibold uppercase tracking-[0.16em] text-slate-500 lg:table-cell">
                  Last seen
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {agents.map((agent) => {
                const meta = STATUS_META[agent.status] || { label: agent.status, text: 'text-slate-300', dot: 'bg-slate-400' };
                return (
                  <tr
                    key={agent.agentId}
                    onClick={() => navigate(`/devices?agent=${agent.agentId}`)}
                    className="cursor-pointer transition-colors duration-100 hover:bg-slate-50"
                  >
                    <td className="px-5 py-3.5">
                      <p className="font-medium text-slate-200">{agent.hostname}</p>
                      <p className="mt-0.5 font-mono text-[11px] text-slate-600">{agent.agentId}</p>
                    </td>
                    <td className="px-5 py-3.5">
                      <span className={`inline-flex items-center gap-1.5 text-xs font-medium ${meta.text}`}>
                        <span className={`h-1.5 w-1.5 rounded-full ${meta.dot}`} />
                        {meta.label}
                      </span>
                    </td>
                    <td className="hidden px-5 py-3.5 sm:table-cell">
                      <HealthBar value={agent.cpuUsage} threshold={80} />
                    </td>
                    <td className="hidden px-5 py-3.5 sm:table-cell">
                      <HealthBar value={agent.memoryUsage} threshold={85} />
                    </td>
                    <td className="hidden px-5 py-3.5 md:table-cell">
                      <HealthBar value={agent.diskUsage} threshold={90} />
                    </td>
                    <td className="hidden px-5 py-3.5 font-mono text-[11px] text-slate-500 lg:table-cell">
                      {agent.lastHeartbeat ? new Date(agent.lastHeartbeat).toLocaleString() : '—'}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </Panel>
  );
}

function Tile({ label, value, className }: { label: string; value: number; className: string }) {
  return (
    <div className={`rounded-lg border px-4 py-2.5 ${className}`}>
      <p className="font-mono text-xl font-semibold tabular-nums leading-none">{value}</p>
      <p className="mt-1 text-[10px] uppercase tracking-wider text-slate-500">{label}</p>
    </div>
  );
}

function HealthBar({ value, threshold }: { value: number | null; threshold: number }) {
  if (value === null) return <span className="font-mono text-xs text-slate-600">—</span>;

  const color = value >= threshold ? 'bg-red-400' : value >= threshold - 10 ? 'bg-amber-400' : 'bg-emerald-400';

  return (
    <div className="flex items-center gap-2.5">
      <div className="h-1.5 w-16 overflow-hidden rounded-full bg-slate-100">
        <div
          className={`h-full rounded-full transition-all duration-500 ${color}`}
          style={{ width: `${Math.min(value, 100)}%` }}
        />
      </div>
      <span className="font-mono text-xs tabular-nums text-slate-400">{value.toFixed(0)}%</span>
    </div>
  );
}
