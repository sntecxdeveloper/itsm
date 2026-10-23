import { useDeferredValue, useMemo, useState } from 'react';
import { useProgressiveList } from '../../hooks/useProgressiveList';

export interface ServiceRow {
  name: string;
  displayName: string;
  status: string;
  startType: string;
}

export type ServiceAction = 'RESTART_SERVICE' | 'START_SERVICE';

/** Per-service feedback while an action is in flight or just finished. */
export interface ServiceActionState {
  state: 'running' | 'done' | 'failed';
  message: string;
}

interface ServiceListProps {
  services: ServiceRow[];
  onAction?: (serviceName: string, action: ServiceAction) => void;
  actionStates?: Record<string, ServiceActionState>;
}

const statusTone: Record<string, { chip: string; dot: string }> = {
  Running: { chip: 'bg-emerald-500/10 text-emerald-600 ring-emerald-400/30', dot: 'bg-emerald-500' },
  Stopped: { chip: 'bg-red-500/10 text-red-600 ring-red-400/30', dot: 'bg-red-500' },
  Paused: { chip: 'bg-amber-500/10 text-amber-600 ring-amber-400/30', dot: 'bg-amber-500' },
};
const unknownTone = { chip: 'bg-slate-100 text-slate-500 ring-line-strong', dot: 'bg-slate-400' };

type Filter = 'all' | 'Running' | 'Stopped';

export const ServiceList: React.FC<ServiceListProps> = ({ services, onAction, actionStates = {} }) => {
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState<Filter>('all');

  const counts = useMemo(
    () => ({
      all: services.length,
      Running: services.filter((s) => s.status === 'Running').length,
      Stopped: services.filter((s) => s.status === 'Stopped').length,
    }),
    [services],
  );

  // Deferred so typing stays instant even with hundreds of services.
  const deferredQuery = useDeferredValue(query);
  const visible = useMemo(() => {
    const q = deferredQuery.trim().toLowerCase();
    return services.filter(
      (s) =>
        (filter === 'all' || s.status === filter) &&
        (!q || s.name.toLowerCase().includes(q) || s.displayName?.toLowerCase().includes(q)),
    );
  }, [services, deferredQuery, filter]);
  const rows = useProgressiveList(visible, 60, `${deferredQuery}|${filter}`);

  if (services.length === 0) {
    return (
      <div className="flex flex-col items-center px-6 py-12 text-center">
        <p className="text-sm text-slate-500">No service data reported yet</p>
        <p className="mt-1 text-xs text-slate-600">The agent reports services every couple of minutes while it's online.</p>
      </div>
    );
  }

  return (
    <div>
      <div className="flex flex-wrap items-center gap-2 px-5 py-3">
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search services…"
          className="w-56 rounded-lg border border-line bg-canvas px-3 py-1.5 text-[13px] text-slate-800 placeholder:text-slate-400 focus:border-primary-400/60 focus:outline-none focus:ring-2 focus:ring-primary-500/20"
        />
        {(['all', 'Running', 'Stopped'] as Filter[]).map((f) => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={`rounded-full px-3 py-1 text-[12px] font-medium transition-colors ${
              filter === f ? 'bg-primary-500 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
            }`}
          >
            {f === 'all' ? 'All' : f} <span className="opacity-70">{counts[f]}</span>
          </button>
        ))}
      </div>

      <div className="overflow-x-auto border-t border-line">
        <table className="w-full text-left">
          <thead>
            <tr className="border-b border-line">
              {['Service', 'Display name', 'Status', 'Start type'].map((h) => (
                <th key={h} className="px-5 py-2.5 font-mono text-[10px] font-medium uppercase tracking-[0.16em] text-slate-600">
                  {h}
                </th>
              ))}
              {onAction && <th className="px-5 py-2.5 text-right" />}
            </tr>
          </thead>
          <tbody className="divide-y divide-line/60">
            {rows.visible.map((service) => {
              const tone = statusTone[service.status] ?? unknownTone;
              const act = actionStates[service.name];
              return (
                <tr key={service.name} className="group transition-colors hover:bg-slate-50">
                  <td className="px-5 py-3 font-mono text-[13px] text-slate-700">{service.name}</td>
                  <td className="px-5 py-3 text-[13px] text-slate-500">{service.displayName}</td>
                  <td className="px-5 py-3">
                    <span className={`inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-[11px] font-medium ring-1 ring-inset ${tone.chip}`}>
                      <span className={`h-1 w-1 rounded-full ${tone.dot}`} />
                      {service.status || 'Unknown'}
                    </span>
                  </td>
                  <td className="px-5 py-3 font-mono text-xs text-slate-500">{service.startType}</td>
                  {onAction && (
                    <td className="px-5 py-3 text-right">
                      {act ? (
                        <span
                          title={act.message}
                          className={`text-xs ${
                            act.state === 'running' ? 'text-amber-600' : act.state === 'done' ? 'text-emerald-600' : 'text-red-600'
                          }`}
                        >
                          {act.state === 'running' ? 'Waiting for approval…' : act.state === 'done' ? 'Done' : 'Failed'}
                        </span>
                      ) : service.status === 'Running' ? (
                        <button
                          onClick={() => onAction(service.name, 'RESTART_SERVICE')}
                          className="rounded-md px-2 py-1 text-xs font-medium text-slate-500 opacity-0 transition-all hover:bg-primary-500/10 hover:text-primary-600 group-hover:opacity-100"
                        >
                          Restart
                        </button>
                      ) : service.status === 'Stopped' ? (
                        <button
                          onClick={() => onAction(service.name, 'START_SERVICE')}
                          className="rounded-md px-2 py-1 text-xs font-medium text-slate-500 opacity-0 transition-all hover:bg-primary-500/10 hover:text-primary-600 group-hover:opacity-100"
                        >
                          Start
                        </button>
                      ) : (
                        <span className="text-slate-400">—</span>
                      )}
                    </td>
                  )}
                </tr>
              );
            })}
            {rows.hasMore && (
              <tr ref={rows.sentinelRef}>
                <td colSpan={5} className="px-5 py-3 text-center text-xs text-slate-400">
                  Showing {rows.visible.length} of {rows.total}…
                </td>
              </tr>
            )}
            {visible.length === 0 && (
              <tr>
                <td colSpan={5} className="px-5 py-8 text-center text-xs text-slate-500">
                  No services match.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default ServiceList;
