import { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { getGroups } from '../../api/groupApi';
import { useAppSelector } from '../../hooks/useAppSelector';
import { useListView } from '../../hooks/useListView';
import ListToolbar from '../listview/ListToolbar';
import { Skeleton } from '../ui/Skeleton';
import GroupFormModal from './GroupFormModal';
import { HEALTH_INFO, KINDS, KIND_INFO, canEditGroups, initials } from './groupMeta';
import type { ChoiceOption, Field, QuickFilter } from '../../utils/listView';
import type { GroupSummary } from '../../types/group';

type Layout = 'list' | 'cards';

const REFRESH_MS = 60_000;
const SHOWN = 8;
const FALLBACK_COLOR = '#64748b';
const LAYOUT_KEY = 'dex.dashboard.groups.layout';

const QUICK: QuickFilter[] = [
  { id: 'attention', label: 'Needs attention', rules: [{ field: 'health', op: 'is_any_of', value: '', values: ['Needs attention', 'Critical'] }] },
  { id: 'issues', label: 'Has open issues', rules: [{ field: 'issues', op: 'gt', value: '0' }] },
  { id: 'nodevices', label: 'No devices', rules: [{ field: 'devices', op: 'eq', value: '0' }] },
  { id: 'notech', label: 'No technicians', rules: [{ field: 'technicians', op: 'eq', value: '0' }] },
];

const choice = (labels: string[]): ChoiceOption[] => labels.map((l) => ({ value: l, label: l }));

/** The fields the dashboard list can show and filter on: the same ones, with the same names, as the Groups page. */
const FIELDS: Field<GroupSummary>[] = [
  { key: 'name', label: 'Name', type: 'text', value: (g) => g.name, fixed: true },
  { key: 'kind', label: 'Kind', type: 'choice', value: (g) => KIND_INFO[g.kind].label, options: () => choice(KINDS.map((k) => KIND_INFO[k].label)), initial: true, groupable: true },
  { key: 'location', label: 'Location', type: 'text', value: (g) => g.location, groupable: true },
  { key: 'region', label: 'Region', type: 'text', value: (g) => g.region, groupable: true },
  { key: 'devices', label: 'Devices', type: 'number', value: (g) => g.deviceCount, initial: true },
  { key: 'online', label: 'Online', type: 'number', value: (g) => g.online, text: (g) => (g.deviceCount === 0 ? '' : `${g.online} / ${g.deviceCount}`), initial: true },
  { key: 'offline', label: 'Offline', type: 'number', value: (g) => g.offline },
  { key: 'technicians', label: 'Technicians', type: 'number', value: (g) => g.technicianCount, initial: true },
  { key: 'users', label: 'Users', type: 'number', value: (g) => g.userCount, initial: true },
  { key: 'issues', label: 'Open issues', type: 'number', value: (g) => g.openIssues, initial: true },
  {
    key: 'health', label: 'Health', type: 'choice', value: (g) => (g.deviceCount === 0 ? null : HEALTH_INFO[g.health].label),
    options: () => choice(['Healthy', 'Needs attention', 'Critical']), initial: true, groupable: true,
  },
];

function readLayout(): Layout {
  try {
    return localStorage.getItem(LAYOUT_KEY) === 'cards' ? 'cards' : 'list';
  } catch {
    return 'list';
  }
}

/** A green and amber bar of how many of a group's devices are online. */
function OnlineBar({ g }: { g: GroupSummary }) {
  if (g.deviceCount === 0) return <span className="text-slate-400">No devices</span>;
  return (
    <div className="w-32">
      <div className="flex h-1.5 overflow-hidden rounded-full bg-slate-100" aria-hidden="true">
        <div className="bg-emerald-500" style={{ width: `${(g.online / g.deviceCount) * 100}%` }} />
        <div className="bg-amber-400" style={{ width: `${(g.offline / g.deviceCount) * 100}%` }} />
      </div>
      <span className="mt-1 block text-[11px] text-slate-500">
        {g.online} / {g.deviceCount} online
      </span>
    </div>
  );
}

function HealthPill({ g, labelEmpty = false }: { g: GroupSummary; labelEmpty?: boolean }) {
  if (g.deviceCount === 0) {
    return labelEmpty ? (
      <span className="whitespace-nowrap rounded-full px-2 py-0.5 text-[10px] font-medium text-slate-500 ring-1 ring-inset ring-slate-200">No devices</span>
    ) : (
      <span className="text-slate-400">—</span>
    );
  }
  const health = HEALTH_INFO[g.health];
  return <span className={`whitespace-nowrap rounded-full px-2 py-0.5 text-[10px] font-medium ring-1 ring-inset ${health.ring} ${health.text}`}>{health.label}</span>;
}

function Badge({ g }: { g: GroupSummary }) {
  return (
    <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md text-[10px] font-semibold text-white" style={{ backgroundColor: g.color || FALLBACK_COLOR }} aria-hidden="true">
      {initials(g.name)}
    </span>
  );
}

/**
 * The dashboard's group section: the same filterable list as the Groups page (search, quick filters with counts, a filter builder,
 * sort, columns, grouping and saved views), shown either as a list or as cards. A click on a group opens it.
 */
export default function GroupStrip() {
  const navigate = useNavigate();
  const role = useAppSelector((s) => s.auth.user?.role) ?? '';
  const canEdit = canEditGroups(role);

  const [groups, setGroups] = useState<GroupSummary[] | null>(null);
  const [failed, setFailed] = useState(false);
  const [layout, setLayoutState] = useState<Layout>(readLayout);
  const [showAll, setShowAll] = useState(false);
  const [creating, setCreating] = useState(false);

  const load = useCallback(() => {
    getGroups()
      .then((g) => {
        setGroups(g);
        setFailed(false);
      })
      .catch(() => setFailed(true));
  }, []);

  useEffect(() => {
    load();
    const timer = window.setInterval(load, REFRESH_MS);
    return () => window.clearInterval(timer);
  }, [load]);

  const setLayout = (next: Layout) => {
    setLayoutState(next);
    try {
      localStorage.setItem(LAYOUT_KEY, next);
    } catch {
      // blocked storage: the choice lasts until the page closes
    }
  };

  const list = useListView<GroupSummary>({
    storageKey: 'dex.dashboard.groups',
    fields: FIELDS,
    rows: groups ?? [],
    quick: QUICK,
    defaultSort: { field: 'issues', dir: 'desc' },
  });
  const { view, setView } = list;

  const total = groups?.length ?? 0;
  const matching = list.processed.length;
  const grouped = view.groupBy !== null;
  const sections = useMemo(
    () => (grouped ? list.groups : [{ key: '', label: '', rows: showAll ? list.processed : list.processed.slice(0, SHOWN) }]),
    [grouped, list.groups, list.processed, showAll],
  );

  const totals = useMemo(() => {
    const rows = groups ?? [];
    return {
      devices: rows.reduce((n, g) => n + g.deviceCount, 0),
      online: rows.reduce((n, g) => n + g.online, 0),
      issues: rows.reduce((n, g) => n + g.openIssues, 0),
      attention: rows.filter((g) => g.health === 'CRITICAL' || g.health === 'WARNING').length,
    };
  }, [groups]);

  const open = (g: GroupSummary) => navigate(`/groups/${g.id}`);

  const cell = (g: GroupSummary, key: string) => {
    switch (key) {
      case 'name':
        return (
          <td key={key} className="px-4 py-2">
            <button type="button" onClick={(e) => { e.stopPropagation(); open(g); }} className="flex min-w-0 items-center gap-2.5 text-left focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-500/40">
              <Badge g={g} />
              <span className="min-w-0">
                <span className="block truncate font-medium text-slate-900">{g.name}</span>
                {(g.location || g.region) && <span className="block truncate text-[11px] text-slate-500">{[g.location, g.region].filter(Boolean).join(' · ')}</span>}
              </span>
            </button>
          </td>
        );
      case 'online':
        return <td key={key} className="px-3 py-2"><OnlineBar g={g} /></td>;
      case 'issues':
        return (
          <td key={key} className="px-3 py-2">
            {g.openIssues > 0 ? <span className="rounded-full bg-red-50 px-2 py-0.5 font-mono text-[11px] font-semibold text-red-600 ring-1 ring-inset ring-red-200">{g.openIssues}</span> : <span className="font-mono text-slate-400">0</span>}
          </td>
        );
      case 'health':
        return <td key={key} className="px-3 py-2"><HealthPill g={g} /></td>;
      default: {
        const f = FIELDS.find((x) => x.key === key);
        const raw = f ? (f.text ? f.text(g) : String(f.value(g) ?? '')) : '';
        const numeric = f?.type === 'number';
        return (
          <td key={key} className={`px-3 py-2 ${numeric ? 'font-mono' : ''} text-slate-600`}>
            {raw === '' ? <span className="text-slate-400">—</span> : raw}
          </td>
        );
      }
    }
  };

  const table = (rows: GroupSummary[]) => (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[640px] text-left text-[12px]">
        <thead>
          <tr className="border-b border-line bg-slate-50/70 text-[11px] font-medium uppercase tracking-wide text-slate-500">
            {list.shown.map((f) => (
              <th key={f.key} className={f.key === 'name' ? 'px-4 py-2' : 'px-3 py-2'}>
                {f.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((g) => (
            <tr key={g.id} onClick={() => open(g)} className="cursor-pointer border-b border-line/60 last:border-b-0 hover:bg-slate-50">
              {list.shown.map((f) => cell(g, f.key))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );

  const cards = (rows: GroupSummary[]) => (
    <div className="grid grid-cols-1 gap-3 p-3 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
      {rows.map((g) => (
        <button
          key={g.id}
          type="button"
          onClick={() => open(g)}
          className="group flex flex-col rounded-xl border border-line bg-white p-3 text-left shadow-sm transition hover:-translate-y-0.5 hover:border-slate-300 hover:shadow-card focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-500/40"
          style={{ borderLeft: `3px solid ${g.color || FALLBACK_COLOR}` }}
        >
          <div className="flex items-start justify-between gap-2">
            <div className="flex min-w-0 items-center gap-2.5">
              <Badge g={g} />
              <div className="min-w-0">
                <div className="truncate text-[13px] font-semibold text-slate-900">{g.name}</div>
                <div className="truncate text-[11px] text-slate-500">{[KIND_INFO[g.kind].label, g.location, g.region].filter(Boolean).join(' · ')}</div>
              </div>
            </div>
            <HealthPill g={g} labelEmpty />
          </div>
          <div className="mt-3">
            <OnlineBar g={g} />
          </div>
          <dl className="mt-3 grid grid-cols-3 gap-2 border-t border-line/70 pt-2.5 text-center">
            <div>
              <dd className="font-mono text-[13px] text-slate-800">{g.technicianCount}</dd>
              <dt className="text-[10px] uppercase tracking-wide text-slate-400">Technicians</dt>
            </div>
            <div>
              <dd className="font-mono text-[13px] text-slate-800">{g.userCount}</dd>
              <dt className="text-[10px] uppercase tracking-wide text-slate-400">Users</dt>
            </div>
            <div>
              <dd className={`font-mono text-[13px] ${g.openIssues > 0 ? 'font-semibold text-red-600' : 'text-slate-800'}`}>{g.openIssues}</dd>
              <dt className="text-[10px] uppercase tracking-wide text-slate-400">Issues</dt>
            </div>
          </dl>
        </button>
      ))}
    </div>
  );

  const icon = 'h-3.5 w-3.5';
  const toggle = (id: Layout, label: string, path: string) => (
    <button
      type="button"
      onClick={() => setLayout(id)}
      aria-pressed={layout === id}
      aria-label={label}
      title={label}
      className={`flex h-7 w-7 items-center justify-center ${layout === id ? 'bg-primary-600 text-white' : 'bg-white text-slate-500 hover:bg-slate-50'}`}
    >
      <svg viewBox="0 0 16 16" className={icon} fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" aria-hidden="true">
        <path d={path} />
      </svg>
    </button>
  );

  return (
    <section aria-label="Groups" className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
          <h2 className="font-display text-[15px] font-semibold text-slate-900">Groups</h2>
          {groups && (
            <span className="text-xs text-slate-500">
              {matching === total ? `${total} ${total === 1 ? 'group' : 'groups'}` : `${matching} of ${total}`}
              {total > 0 && (
                <>
                  {' · '}
                  {totals.online}/{totals.devices} devices online
                  {totals.issues > 0 && <span className="font-medium text-red-600"> · {totals.issues} open issues</span>}
                  {totals.attention > 0 && <span className="font-medium text-amber-600"> · {totals.attention} need attention</span>}
                </>
              )}
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          {canEdit && (
            <button type="button" onClick={() => setCreating(true)} className="rounded-lg border border-line bg-white px-3 py-1.5 text-xs font-medium text-slate-700 shadow-sm hover:bg-slate-50">
              + New group
            </button>
          )}
          <button type="button" onClick={() => navigate('/groups')} className="text-xs font-medium text-primary-600 hover:text-primary-700">
            Open Groups →
          </button>
        </div>
      </div>

      {total > 0 && (
        <ListToolbar
          fields={FIELDS}
          rows={groups ?? []}
          shown={list.processed}
          view={view}
          setView={(next) => {
            setShowAll(false);
            setView(next);
          }}
          saved={list.saved}
          onSaveView={list.saveCurrent}
          onDeleteView={list.deleteSaved}
          onApplyView={list.applySaved}
          onReset={list.reset}
          quick={QUICK}
          searchPlaceholder="Search groups…"
          exportName="groups"
        >
          <div className="inline-flex overflow-hidden rounded-lg border border-line" role="group" aria-label="Layout">
            {toggle('list', 'List', 'M2 4h12M2 8h12M2 12h12')}
            {toggle('cards', 'Cards', 'M2.5 2.5h4.5v4.5H2.5zM9 2.5h4.5v4.5H9zM2.5 9h4.5v4.5H2.5zM9 9h4.5v4.5H9z')}
          </div>
        </ListToolbar>
      )}

      {groups === null && !failed ? (
        <div className="space-y-2">
          {[0, 1, 2].map((i) => (
            <Skeleton key={i} className="h-11 w-full" />
          ))}
        </div>
      ) : failed && groups === null ? (
        <div className="flex items-center justify-between rounded-xl border border-line bg-panel px-4 py-3 text-sm text-slate-500">
          Groups could not be loaded.
          <button type="button" onClick={load} className="text-xs font-medium text-primary-600 hover:text-primary-700">
            Try again
          </button>
        </div>
      ) : matching === 0 ? (
        <div className="rounded-xl border border-dashed border-line-strong bg-panel px-5 py-6 text-center">
          <p className="text-sm font-medium text-slate-700">{total === 0 ? 'No groups yet' : 'No group matches these filters'}</p>
          <p className="mt-1 text-xs text-slate-500">
            {total === 0
              ? 'A group is a department, site or team. Put its devices, technicians and users inside to see their health together and act on them at once.'
              : 'Try a different search or reset the filters.'}
          </p>
          {canEdit && total === 0 ? (
            <button type="button" onClick={() => setCreating(true)} className="mt-3 rounded-lg bg-primary-600 px-4 py-2 text-xs font-medium text-white hover:bg-primary-700">
              Create the first group
            </button>
          ) : (
            total > 0 && (
              <button type="button" onClick={list.reset} className="mt-3 text-xs font-medium text-primary-600 hover:text-primary-700">
                Reset filters
              </button>
            )
          )}
        </div>
      ) : (
        <div className="overflow-hidden rounded-xl border border-line bg-panel shadow-card">
          {sections.map((s) => (
            <div key={s.key || 'all'}>
              {grouped && (
                <div className="border-b border-line bg-slate-50 px-4 py-1.5 text-[11px] font-semibold text-slate-600">
                  {s.label} <span className="font-normal text-slate-400">({s.rows.length})</span>
                </div>
              )}
              {layout === 'list' ? table(s.rows) : cards(s.rows)}
            </div>
          ))}
          {!grouped && matching > SHOWN && (
            <button
              type="button"
              onClick={() => setShowAll((v) => !v)}
              className="w-full border-t border-line/70 bg-slate-50/60 px-4 py-2 text-center text-[11px] font-medium text-primary-600 hover:bg-slate-50"
            >
              {showAll ? 'Show fewer' : `Show all ${matching}`}
            </button>
          )}
        </div>
      )}

      {creating && (
        <GroupFormModal
          onClose={() => setCreating(false)}
          onSaved={(saved) => {
            setCreating(false);
            navigate(`/groups/${saved.summary.id}`);
          }}
        />
      )}
    </section>
  );
}
