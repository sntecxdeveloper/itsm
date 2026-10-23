import { Fragment, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import DeviceStatusBadge from './DeviceStatusBadge';
import { Skeleton } from '../ui/Skeleton';
import type { Field, RowGroup } from '../../utils/listView';
import type { Device } from '../../types';

interface DeviceTableProps {
  /** The columns to show, in order. */
  columns: Field<Device>[];
  /** The rows, already split into sections (one section with no label when the list is not grouped). */
  sections: RowGroup<Device>[];
  grouped: boolean;
  loading: boolean;
  selectedIds?: number[];
  onToggleSelect?: (id: number) => void;
  onToggleSelectAll?: (checked: boolean) => void;
  /** Sorting: the field keys in order with their direction, and what to do when a heading is clicked. */
  sorts: { field: string; dir: 'asc' | 'desc' }[];
  onSort: (key: string, additive: boolean) => void;
  /** Shown instead of the table when there are no rows. */
  emptyMessage: string;
}

/** Width and when each column shows. The device column stretches; the rest are fixed. */
const WIDTH: Record<string, string> = {
  device: 'min-w-[220px] flex-1',
  agentId: 'w-40',
  ip: 'w-36',
  os: 'w-48',
  osVersion: 'w-32',
  location: 'w-36',
  region: 'w-28',
  groups: 'w-48',
  agentVersion: 'w-28',
  enrolled: 'w-28',
  cpu: 'w-56',
  ram: 'w-20',
  disk: 'w-20',
  status: 'w-28 shrink-0',
  lastSeen: 'w-32',
  issues: 'w-28 shrink-0',
};

const headerText = 'font-mono text-[10px] font-semibold uppercase tracking-[0.16em] text-slate-500';
const cellText = 'block truncate text-xs text-slate-500';

const text = (f: Field<Device>, d: Device): string => {
  if (f.text) return f.text(d);
  const v = f.value(d);
  return Array.isArray(v) ? v.join(', ') : v === null || v === undefined ? '' : String(v);
};

export default function DeviceTable({ columns, sections, grouped, loading, selectedIds = [], onToggleSelect, onToggleSelectAll, sorts, onSort, emptyMessage }: DeviceTableProps) {
  const navigate = useNavigate();
  const [closed, setClosed] = useState<Set<string>>(new Set());
  const devices = sections.flatMap((s) => s.rows);

  if (loading) {
    return (
      <div className="rounded-xl border border-line bg-panel">
        {[0, 1, 2, 3, 4, 5].map((i) => (
          <div key={i} className="flex items-center gap-4 border-b border-line/60 px-5 py-4 last:border-b-0">
            <Skeleton className="h-9 w-9 rounded-lg" />
            <div className="flex-1 space-y-2">
              <Skeleton className="h-3.5 w-40" />
              <Skeleton className="h-3 w-24" />
            </div>
            <Skeleton className="hidden h-5 w-24 md:block" />
            <Skeleton className="hidden h-5 w-20 lg:block" />
          </div>
        ))}
      </div>
    );
  }

  if (devices.length === 0) {
    return (
      <div className="flex flex-col items-center rounded-xl border border-line bg-panel px-6 py-16 text-center">
        <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-xl border border-line bg-panel-2">
          <svg className="h-6 w-6 text-slate-600" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M9 17.25v1.007a3 3 0 0 1-.879 2.122L7.5 21h9l-.621-.621A3 3 0 0 1 15 18.257V17.25m6-12V15a2.25 2.25 0 0 1-2.25 2.25H5.25A2.25 2.25 0 0 1 3 15V5.25m18 0A2.25 2.25 0 0 0 18.75 3H5.25A2.25 2.25 0 0 0 3 5.25m18 0v.243a2.25 2.25 0 0 1-1.07 1.916l-7.5 4.615a2.25 2.25 0 0 1-2.36 0L3.32 7.41A2.25 2.25 0 0 1 2.25 5.494V5.25" />
          </svg>
        </div>
        <p className="text-sm font-medium text-slate-300">No devices found</p>
        <p className="mt-1 text-xs text-slate-600">{emptyMessage}</p>
      </div>
    );
  }

  const cellFor = (f: Field<Device>, d: Device) => {
    switch (f.key) {
      case 'device':
        return (
          <div className="flex items-center gap-3">
            <span
              className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg ring-1 ring-inset ${
                d.status === 'ONLINE'
                  ? 'bg-emerald-400/10 text-emerald-300 ring-emerald-400/25'
                  : d.status === 'ERROR'
                    ? 'bg-red-400/10 text-red-300 ring-red-400/25'
                    : d.status === 'ENROLLING'
                      ? 'bg-sky-400/10 text-sky-300 ring-sky-400/25'
                      : 'bg-amber-400/10 text-amber-300 ring-amber-400/25'
              }`}
            >
              <svg className="h-[18px] w-[18px]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 17.25v1.007a3 3 0 0 1-.879 2.122L7.5 21h9l-.621-.621A3 3 0 0 1 15 18.257V17.25m6-12V15a2.25 2.25 0 0 1-2.25 2.25H5.25A2.25 2.25 0 0 1 3 15V5.25m18 0A2.25 2.25 0 0 0 18.75 3H5.25A2.25 2.25 0 0 0 3 5.25m18 0v.243a2.25 2.25 0 0 1-1.07 1.916l-7.5 4.615a2.25 2.25 0 0 1-2.36 0L3.32 7.41A2.25 2.25 0 0 1 2.25 5.494V5.25" />
              </svg>
            </span>
            <div className="min-w-0 flex-1">
              <p className="truncate text-[13px] font-medium text-slate-800 transition-colors group-hover:text-slate-900">{d.hostname}</p>
              <p className="mt-0.5 truncate font-mono text-[10.5px] text-slate-600">
                {d.agentId}
                {d.agentVersion ? ` · v${d.agentVersion}` : ''}
              </p>
            </div>
          </div>
        );
      case 'status':
        return <DeviceStatusBadge status={d.status} />;
      case 'issues':
        return (
          <span onClick={(e) => e.stopPropagation()}>
            <button
              type="button"
              onClick={() => navigate(`/issues?device=${d.id}`)}
              className={`inline-flex items-center gap-1 rounded-md border px-2 py-1 text-[11px] font-medium transition-colors ${
                d.openIssueCount
                  ? 'border-red-200 bg-red-50 text-red-700 hover:bg-red-100'
                  : 'border-line text-slate-600 hover:border-line-strong hover:bg-slate-50 hover:text-slate-900'
              }`}
              title={`View issues for ${d.hostname}`}
            >
              Issues{d.openIssueCount ? ` (${d.openIssueCount})` : ''}
            </button>
          </span>
        );
      default: {
        const t = text(f, d);
        return (
          <span className={`${cellText} ${f.key === 'ip' || f.key === 'agentVersion' || f.key === 'agentId' ? 'font-mono' : ''}`} title={t}>
            {t || '—'}
          </span>
        );
      }
    }
  };

  const allSelected = devices.length > 0 && devices.every((d) => selectedIds.includes(d.id));

  return (
    <div className="overflow-x-auto rounded-xl border border-line bg-panel">
      <div className="min-w-max">
        <div className="flex items-center gap-3 border-b border-line bg-white/[0.015] px-5 py-2.5">
          {onToggleSelect && (
            <label className="flex w-6 shrink-0 items-center justify-center">
              <input type="checkbox" checked={allSelected} onChange={(e) => onToggleSelectAll?.(e.target.checked)} className="h-3.5 w-3.5 rounded border-line bg-panel accent-primary-600" aria-label="Select all devices" />
            </label>
          )}
          {columns.map((f) => {
            const level = sorts.findIndex((s) => s.field === f.key);
            return (
              <div key={f.key} className={WIDTH[f.key] ?? 'w-32'} aria-sort={level === 0 ? (sorts[0].dir === 'asc' ? 'ascending' : 'descending') : 'none'}>
                <button type="button" onClick={(e) => onSort(f.key, e.shiftKey)} title="Click to sort, Shift-click to add a level" className={`${headerText} hover:text-primary-700`}>
                  {f.label}
                  {level >= 0 && (
                    <span className="ml-1 text-primary-700">
                      {sorts[level].dir === 'asc' ? '▲' : '▼'}
                      {sorts.length > 1 ? level + 1 : ''}
                    </span>
                  )}
                </button>
              </div>
            );
          })}
          <span className="w-8 shrink-0" />
        </div>

        {sections.map((s) => (
          <Fragment key={s.key || 'all'}>
            {grouped && (
              <button
                type="button"
                onClick={() => setClosed((prev) => { const n = new Set(prev); if (n.has(s.key)) n.delete(s.key); else n.add(s.key); return n; })}
                aria-expanded={!closed.has(s.key)}
                className="flex w-full items-center gap-2 border-b border-line bg-slate-50 px-5 py-2 text-left text-xs font-semibold text-slate-800"
              >
                <span aria-hidden="true">{closed.has(s.key) ? '▸' : '▾'}</span>
                {s.label}
                <span className="rounded-full bg-white px-1.5 font-mono text-[10px] text-slate-500 ring-1 ring-slate-200">{s.rows.length}</span>
              </button>
            )}
            {!(grouped && closed.has(s.key)) &&
              s.rows.map((device) => (
                <div
                  key={`${s.key}-${device.id}`}
                  onClick={() => navigate(`/devices/${device.id}`)}
                  className={`group flex cursor-pointer items-center gap-3 border-b border-line/60 px-5 py-3.5 transition-colors last:border-b-0 hover:bg-slate-50 ${
                    selectedIds.includes(device.id) ? 'bg-primary-500/[0.06]' : ''
                  }`}
                >
                  {onToggleSelect && (
                    <label className="flex w-6 shrink-0 items-center justify-center" onClick={(e) => e.stopPropagation()}>
                      <input type="checkbox" checked={selectedIds.includes(device.id)} onChange={() => onToggleSelect(device.id)} className="h-3.5 w-3.5 rounded border-line bg-panel accent-primary-600" aria-label={`Select ${device.hostname}`} />
                    </label>
                  )}
                  {columns.map((f) => (
                    <div key={f.key} className={WIDTH[f.key] ?? 'w-32'}>
                      {cellFor(f, device)}
                    </div>
                  ))}
                  <span className="flex w-8 shrink-0 justify-end text-slate-600 opacity-0 transition-opacity group-hover:opacity-100">
                    <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="m8.25 4.5 7.5 7.5-7.5 7.5" />
                    </svg>
                  </span>
                </div>
              ))}
          </Fragment>
        ))}
      </div>
    </div>
  );
}
