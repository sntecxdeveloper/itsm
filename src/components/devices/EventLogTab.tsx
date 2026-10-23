import { useDeferredValue, useMemo, useState } from 'react';
import { useProgressiveList } from '../../hooks/useProgressiveList';
import type { SystemEvent } from '../../types/device';

interface EventLogTabProps {
  events: SystemEvent[];
  loading?: boolean;
}

const levelTone: Record<string, { chip: string; dot: string }> = {
  Critical: { chip: 'bg-red-500/10 text-red-600 ring-red-400/30', dot: 'bg-red-500' },
  Error: { chip: 'bg-red-500/10 text-red-600 ring-red-400/30', dot: 'bg-red-500' },
  Warning: { chip: 'bg-amber-500/10 text-amber-600 ring-amber-400/30', dot: 'bg-amber-500' },
  Information: { chip: 'bg-sky-500/10 text-sky-600 ring-sky-400/30', dot: 'bg-sky-500' },
};

const LEVELS = ['Error', 'Warning', 'Information'] as const;
type LevelFilter = 'all' | (typeof LEVELS)[number];

/** Critical counts with Error; anything unrecognised counts as Information. */
const bucket = (level: string): (typeof LEVELS)[number] =>
  level === 'Critical' || level === 'Error' ? 'Error' : level === 'Warning' ? 'Warning' : 'Information';

function formatTime(timeStr: string): string {
  const d = new Date(timeStr);
  return Number.isNaN(d.getTime()) ? timeStr : d.toLocaleString();
}

export const EventLogTab: React.FC<EventLogTabProps> = ({ events, loading }) => {
  const [level, setLevel] = useState<LevelFilter>('all');
  const [query, setQuery] = useState('');
  const [expanded, setExpanded] = useState<Set<string>>(new Set());

  const counts = useMemo(() => {
    const c = { all: events.length, Error: 0, Warning: 0, Information: 0 };
    events.forEach((e) => c[bucket(e.level)]++);
    return c;
  }, [events]);

  const deferredQuery = useDeferredValue(query);
  const visible = useMemo(() => {
    const q = deferredQuery.trim().toLowerCase();
    return events.filter(
      (e) =>
        (level === 'all' || bucket(e.level) === level) &&
        (!q || e.message?.toLowerCase().includes(q) || e.source?.toLowerCase().includes(q)),
    );
  }, [events, level, deferredQuery]);
  const rows = useProgressiveList(visible, 40, `${deferredQuery}|${level}`);

  if (loading && events.length === 0) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="h-6 w-6 animate-spin rounded-full border-2 border-primary-400 border-t-transparent" />
      </div>
    );
  }

  if (events.length === 0) {
    return (
      <div className="flex flex-col items-center px-6 py-12 text-center">
        <p className="text-sm text-slate-500">No Windows errors or warnings reported</p>
        <p className="mt-1 text-xs text-slate-600">
          Every few minutes the agent sends errors and warnings from the last 15 minutes. None usually means the machine is healthy.
        </p>
      </div>
    );
  }

  const toggle = (key: string) =>
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });

  return (
    <div>
      <div className="flex flex-wrap items-center gap-2 px-5 py-3">
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search message or source…"
          className="w-64 rounded-lg border border-line bg-canvas px-3 py-1.5 text-[13px] text-slate-800 placeholder:text-slate-400 focus:border-primary-400/60 focus:outline-none focus:ring-2 focus:ring-primary-500/20"
        />
        {(['all', ...LEVELS] as LevelFilter[]).map((l) => (
          <button
            key={l}
            onClick={() => setLevel(l)}
            className={`rounded-full px-3 py-1 text-[12px] font-medium transition-colors ${
              level === l ? 'bg-primary-500 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
            }`}
          >
            {l === 'all' ? 'All' : l === 'Information' ? 'Info' : `${l}s`} <span className="opacity-70">{counts[l]}</span>
          </button>
        ))}
      </div>

      <div className="space-y-2 border-t border-line p-5">
        {visible.length === 0 && <p className="py-6 text-center text-xs text-slate-500">No events match.</p>}
        {rows.visible.map((event, idx) => {
          const key = `${event.id ?? event.recordId ?? idx}`;
          const tone = levelTone[event.level] ?? levelTone.Information;
          const open = expanded.has(key);
          return (
            <button
              type="button"
              key={key}
              onClick={() => toggle(key)}
              className="block w-full rounded-lg border border-line bg-white px-4 py-3 text-left transition-colors hover:border-line-strong"
            >
              <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                <span className={`inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide ring-1 ring-inset ${tone.chip}`}>
                  <span className={`h-1 w-1 rounded-full ${tone.dot}`} />
                  {event.level}
                </span>
                <span className="font-mono text-xs text-slate-600">{event.source}</span>
                {event.recordId != null && <span className="text-[11px] text-slate-400">Event {event.recordId}</span>}
                <span className="text-[11px] text-slate-400">{event.logName}</span>
                <span className="ml-auto font-mono text-[11px] text-slate-500">{formatTime(event.timeCreated)}</span>
              </div>
              <p className={`mt-2 whitespace-pre-wrap text-[13px] leading-relaxed text-slate-700 ${open ? '' : 'line-clamp-3'}`}>
                {event.message}
              </p>
            </button>
          );
        })}
        {rows.hasMore && (
          <div ref={rows.sentinelRef} className="py-3 text-center text-xs text-slate-400">
            Showing {rows.visible.length} of {rows.total}…
          </div>
        )}
      </div>
    </div>
  );
};

export default EventLogTab;
