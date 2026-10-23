import { useAccess } from '../../context/AccessContext';
import { Fragment, useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { deleteGroup, getFeatureCatalog, getGroup, getGroups, isDeviceGroup } from '../../api/groupApi';
import { usePageParts } from '../../hooks/usePageParts';
import { useListView } from '../../hooks/useListView';
import ConfirmDialog from '../../components/common/ConfirmDialog';
import GroupFormModal from '../../components/groups/GroupFormModal';
import ListToolbar from '../../components/listview/ListToolbar';
import { toast } from '../../components/common/Toast';
import { GROUP_TYPES, HEALTH_INFO, KINDS, KIND_INFO, TYPE_INFO } from '../../components/groups/groupMeta';
import { getErrorMessage } from '../../utils/errorHandler';
import { formatDate, formatRelativeTime } from '../../utils/formatDate';
import { newRuleId, type ChoiceOption, type Field, type QuickFilter } from '../../utils/listView';
import type { FeatureTab, GroupDetail, GroupSummary } from '../../types/group';

const PAGE_SIZE = 20;
const EMPTY = '(empty)';
const ms = (iso?: string | null) => (iso ? new Date(iso).getTime() : null);

const input =
  'border border-slate-300 bg-white px-2.5 py-1 text-xs text-slate-800 focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500';

/** Quick filters, one click each. */
const QUICK: QuickFilter[] = [
  { id: 'attention', label: 'Needs attention', rules: [{ field: 'health', op: 'is_any_of', value: '', values: ['Needs attention', 'Critical'] }] },
  { id: 'issues', label: 'Has open issues', rules: [{ field: 'issues', op: 'gt', value: '0' }] },
  { id: 'nodevices', label: 'No devices', rules: [{ field: 'devices', op: 'eq', value: '0' }] },
  { id: 'notech', label: 'No technicians', rules: [{ field: 'technicians', op: 'eq', value: '0' }] },
  { id: 'custom', label: 'Custom features', rules: [{ field: 'featuresMode', op: 'is_any_of', value: '', values: ['Customised'] }] },
  { id: 'rule', label: 'Picked by a rule', rules: [{ field: 'chosen', op: 'is_any_of', value: '', values: ['A rule'] }] },
];

/** What the Setup page's links ask for (?view=...), as filter conditions. */
function viewRules(view: string): { field: string; op: string; value: string; values?: string[] } | null {
  if (view === 'TECHNICIANS') return { field: 'technicians', op: 'gt', value: '0' };
  if (view === 'USERS') return { field: 'users', op: 'gt', value: '0' };
  if ((KINDS as string[]).includes(view)) return { field: 'kind', op: 'is_any_of', value: '', values: [KIND_INFO[view as (typeof KINDS)[number]].label] };
  return null;
}

/** Organisation groups as an advanced list: filter builder, quick filters, sort, fields, grouping and saved views above the table. */
export default function GroupsPage({ startView }: { startView?: string } = {}) {
  const navigate = useNavigate();
  const [params, setParams] = useSearchParams();
  const canEdit = useAccess().can('groups.edit');
  // The Groups section is about devices. ITSM's own entries (the ITSM Groups menu, which passes startView, and every ITSM Setup
  // link, which brings a ?view) get the full list with ITSM's groups, exactly as before.
  const [initialView] = useState(() => (params.get('view') ?? startView ?? '').toUpperCase());
  const itsmView = initialView !== '';

  const [groups, setGroups] = useState<GroupSummary[] | null>(null);
  const [catalog, setCatalog] = useState<FeatureTab[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [page, setPage] = useState(0);
  const [checked, setChecked] = useState<Set<number>>(new Set());
  const [closedGroups, setClosedGroups] = useState<Set<string>>(new Set());
  const [notice, setNotice] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [editing, setEditing] = useState<GroupDetail | null>(null);
  const [deleting, setDeleting] = useState<GroupSummary[] | null>(null);

  const load = useCallback(() => {
    getGroups()
      .then((g) => {
        setGroups(itsmView ? g : g.filter(isDeviceGroup));
        setError(null);
      })
      .catch(() => setError('Groups could not be loaded.'));
  }, [itsmView]);

  useEffect(() => {
    load();
    getFeatureCatalog().then(setCatalog).catch(() => undefined);
  }, [load]);

  const featureLabel = useMemo(() => {
    const m = new Map<string, string>();
    catalog.forEach((t) => {
      m.set(t.key, t.label);
      t.features.forEach((f) => m.set(f.key, `${t.label}: ${f.label}`));
    });
    return m;
  }, [catalog]);

  /** Every tab and feature a group hides: its own list plus all the features of any tab it hides. */
  const hiddenSet = useCallback(
    (g: GroupSummary) => {
      const out = new Set(g.hiddenFeatureKeys);
      catalog.forEach((t) => out.has(t.key) && t.features.forEach((f) => out.add(f.key)));
      return [...out];
    },
    [catalog],
  );

  const featureText = useCallback(
    (g: GroupSummary) => {
      if (!g.featuresManaged) return 'Default';
      if (g.hiddenFeatureKeys.length === 0) return 'All shown';
      return 'Hides ' + g.hiddenFeatureKeys.map((k) => featureLabel.get(k) ?? k).join(', ');
    },
    [featureLabel],
  );

  const fields: Field<GroupSummary>[] = useMemo(() => {
    const choice = (labels: string[]): ChoiceOption[] => labels.map((l) => ({ value: l, label: l }));
    const hideOptions: ChoiceOption[] = catalog.flatMap((t) => [
      { value: t.key, label: `${t.label} (whole tab)`, group: t.label },
      ...t.features.map((f) => ({ value: f.key, label: f.label, group: t.label })),
    ]);
    return [
      { key: 'name', label: 'Name', type: 'text', value: (g) => g.name, fixed: true },
      ...(itsmView ? [] : [{ key: 'organization', label: 'Organization', type: 'choice', value: (g: GroupSummary) => g.organizationName ?? 'Default', initial: true, groupable: true } as Field<GroupSummary>]),
      { key: 'kind', label: 'Kind', type: 'choice', value: (g) => KIND_INFO[g.kind].label, options: () => choice(KINDS.map((k) => KIND_INFO[k].label)), initial: true, groupable: true },
      ...(!itsmView ? [] : [{ key: 'type', label: 'Type', type: 'choice', value: (g) => (g.type ? TYPE_INFO[g.type].label : 'General'), options: () => choice([...GROUP_TYPES.map((t) => TYPE_INFO[t].label), 'General']), initial: true, groupable: true } as Field<GroupSummary>]),
      { key: 'status', label: 'Status', type: 'choice', value: (g) => (g.status === 'INACTIVE' ? 'Inactive' : 'Active'), options: () => choice(['Active', 'Inactive']), initial: true, groupable: true },
      { key: 'location', label: 'Location', type: 'text', value: (g) => g.location, initial: true, groupable: true },
      { key: 'region', label: 'Region', type: 'text', value: (g) => g.region, initial: true, groupable: true },
      { key: 'description', label: 'Description', type: 'text', value: (g) => g.description, initial: true },
      { key: 'devices', label: 'Devices', type: 'number', value: (g) => g.deviceCount, initial: true },
      { key: 'online', label: 'Online', type: 'number', value: (g) => g.online, text: (g) => (g.deviceCount === 0 ? '' : `${g.online} / ${g.deviceCount}`), initial: true },
      { key: 'offline', label: 'Offline', type: 'number', value: (g) => g.offline },
      ...(!itsmView ? [] : [
        { key: 'technicians', label: 'Technicians', type: 'number', value: (g: GroupSummary) => g.technicianCount, initial: true } as Field<GroupSummary>,
        { key: 'users', label: 'Users', type: 'number', value: (g: GroupSummary) => g.userCount, initial: true } as Field<GroupSummary>,
      ]),
      { key: 'issues', label: 'Open issues', type: 'number', value: (g) => g.openIssues, initial: true },
      { key: 'health', label: 'Health', type: 'choice', value: (g) => (g.deviceCount === 0 ? null : HEALTH_INFO[g.health].label), options: () => choice(['Healthy', 'Needs attention', 'Critical']), initial: true, groupable: true },
      { key: 'featuresMode', label: 'Features shown', type: 'choice', value: (g) => (!g.featuresManaged ? 'Default' : g.hiddenFeatureKeys.length === 0 ? 'All shown' : 'Customised'), text: featureText, options: () => choice(['Default', 'All shown', 'Customised']), initial: true, groupable: true },
      { key: 'hides', label: 'Hidden features', type: 'list', value: hiddenSet, text: (g) => g.hiddenFeatureKeys.map((k) => featureLabel.get(k) ?? k).join(', '), options: () => hideOptions },
      { key: 'retention', label: 'Keep logs (days)', type: 'number', value: (g) => g.retentionDays, text: (g) => (g.retentionDays ? `${g.retentionDays} days` : 'Default') },
      { key: 'fixes', label: 'Fixes allowed', type: 'number', value: (g) => g.allowedFixes, text: (g) => (g.allowedFixes == null ? 'All approved' : `${g.allowedFixes} allowed`) },
      { key: 'assign', label: 'Auto-assign issues', type: 'choice', value: (g) => (g.autoAssignIssues ? 'On' : 'Off'), options: () => choice(['On', 'Off']), groupable: true },
      { key: 'chosen', label: 'Devices chosen by', type: 'choice', value: (g) => (g.membershipMode === 'DYNAMIC' ? 'A rule' : 'Listed by hand'), options: () => choice(['Listed by hand', 'A rule']), groupable: true },
      { key: 'createdBy', label: 'Created by', type: 'text', value: (g) => g.createdBy, groupable: true },
      { key: 'created', label: 'Created', type: 'date', value: (g) => ms(g.createdAt), text: (g) => (g.createdAt ? formatDate(g.createdAt) : '') },
      { key: 'updated', label: 'Updated', type: 'date', value: (g) => ms(g.updatedAt), text: (g) => (g.updatedAt ? formatRelativeTime(g.updatedAt) : ''), initial: true },
    ];
  }, [catalog, featureLabel, featureText, hiddenSet, itsmView]);

  const quick = useMemo(() => (itsmView ? QUICK : QUICK.filter((q) => q.id !== 'notech')), [itsmView]);
  const list = useListView<GroupSummary>({ storageKey: itsmView ? 'dex.groups.list' : 'dex.devicegroups.list', fields, rows: groups ?? [], quick, defaultSort: { field: 'name', dir: 'asc' } });
  const { view, setView } = list;

  // a link from the Setup page (?view=SITE) starts the list filtered, once
  const fromUrl = (params.get('view') ?? startView ?? '').toUpperCase();
  useEffect(() => {
    const preset = viewRules(fromUrl);
    if (!preset) return;
    setView((v) => ({ ...v, rules: [{ id: newRuleId(), ...preset }] }));
    setParams({}, { replace: true });
    // only when the link brings a view
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fromUrl]);

  const grouped = view.groupBy !== null;
  const rows = list.processed;
  const pages = Math.max(1, Math.ceil(rows.length / PAGE_SIZE));
  const current = Math.min(page, pages - 1);
  const sections = grouped ? list.groups : [{ key: '', label: '', rows: rows.slice(current * PAGE_SIZE, (current + 1) * PAGE_SIZE) }];
  const visible = sections.flatMap((s) => s.rows);
  const allChecked = visible.length > 0 && visible.every((g) => checked.has(g.id));
  const picked = (groups ?? []).filter((g) => checked.has(g.id));
  const title = itsmView ? viewTitle(params.get('view') ?? startView ?? initialView) : 'Device groups';

  const toggle = (id: number) =>
    setChecked((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  /** Click a heading to sort by it; hold Shift to add it as a further level. */
  const sortBy = (key: string, additive: boolean) =>
    setView((v) => {
      const at = v.sorts.findIndex((s) => s.field === key);
      if (!additive) {
        return { ...v, sorts: [{ field: key, dir: at === 0 && v.sorts[0].dir === 'asc' ? 'desc' : 'asc' }] };
      }
      if (at === -1) return { ...v, sorts: [...v.sorts, { field: key, dir: 'asc' }] };
      return { ...v, sorts: v.sorts.map((s) => (s.field === key ? { ...s, dir: s.dir === 'asc' ? 'desc' : 'asc' } : s)) };
    });

  const openEdit = (g: GroupSummary) => {
    getGroup(g.id)
      .then(setEditing)
      .catch((err) => toast(getErrorMessage(err), 'error'));
  };

  const runAction = (action: string) => {
    setNotice(null);
    if (!action) return;
    if (picked.length === 0) {
      setNotice('Select at least one group first.');
      return;
    }
    if (action === 'delete') {
      setDeleting(picked);
      return;
    }
    if (picked.length > 1) {
      setNotice('Select one group for this action.');
      return;
    }
    if (action === 'edit') openEdit(picked[0]);
    if (action === 'features') navigate(`/groups/${picked[0].id}?tab=features`);
  };

  const doDelete = async () => {
    const del = deleting ?? [];
    setDeleting(null);
    try {
      await Promise.all(del.map((g) => deleteGroup(g.id)));
      toast(del.length === 1 ? 'Group deleted' : `${del.length} groups deleted`, 'success');
      setChecked(new Set());
      load();
    } catch (err) {
      toast(getErrorMessage(err), 'error');
      load();
    }
  };

  const cell = 'px-2.5 py-1.5 align-top';

  const renderCell = (g: GroupSummary, key: string) => {
    const health = HEALTH_INFO[g.health];
    switch (key) {
      case 'name':
        return (
          <td key={key} className={`${cell} whitespace-nowrap`}>
            <span className="mr-2 inline-block h-2.5 w-2.5 rounded-full align-middle" style={{ backgroundColor: g.color || '#64748b' }} aria-hidden="true" />
            <button onClick={() => navigate(`/groups/${g.id}`)} className="font-medium text-primary-700 hover:underline">
              {g.name}
            </button>
          </td>
        );
      case 'issues':
        return (
          <td key={key} className={cell}>
            {g.openIssues > 0 ? <span className="rounded bg-red-400 px-2 py-0.5 font-medium text-white">{g.openIssues}</span> : <span className="text-slate-800">0</span>}
          </td>
        );
      case 'health':
        return (
          <td key={key} className={`${cell} whitespace-nowrap ${health.text}`}>
            {g.deviceCount === 0 ? EMPTY : health.label}
          </td>
        );
      case 'featuresMode':
        return (
          <td key={key} className={`${cell} max-w-[220px] text-slate-800`} title={featureText(g)}>
            <span className="line-clamp-2">{g.featuresManaged ? featureText(g) : <span className="text-slate-500">Default</span>}</span>
          </td>
        );
      case 'description':
        return (
          <td key={key} className={`${cell} max-w-xs text-slate-800`}>
            {g.description || <span className="text-slate-500">{EMPTY}</span>}
          </td>
        );
      default: {
        const f = fields.find((x) => x.key === key);
        const text = f ? (f.text ? f.text(g) : String(Array.isArray(f.value(g)) ? (f.value(g) as string[]).join(', ') : (f.value(g) ?? ''))) : '';
        return (
          <td key={key} className={`${cell} whitespace-nowrap text-slate-800`}>
            {text === '' ? <span className="text-slate-500">{EMPTY}</span> : text}
          </td>
        );
      }
    }
  };

  const total = view.columns.length + 2;

  const parts = usePageParts('groups', [
    {
      key: 'header',
      label: 'Page title and actions',
      fixed: true,
      node: (
      <div key="header" className="flex flex-wrap items-center gap-3 border-b border-slate-200 pb-3">
        <Link to="/setup" className="text-sm text-slate-500 hover:text-slate-800" aria-label="Back to Setup" title="Back to Setup">
          ☰
        </Link>
        <h1 className="text-sm font-semibold text-slate-900">{title}</h1>
        {canEdit && (
          <div className="ml-auto flex items-center gap-3">
            <select value="" onChange={(e) => runAction(e.target.value)} className={`${input} w-56 rounded`} aria-label="Actions on selected rows">
              <option value="">Actions on selected rows...</option>
              <option value="edit">Edit</option>
              <option value="features">Features shown</option>
              <option value="delete">Delete</option>
            </select>
            <button onClick={() => setCreating(true)} className="rounded bg-slate-800 px-3 py-1 text-xs font-semibold text-white hover:bg-slate-900">
              New
            </button>
          </div>
        )}
      </div>
      ),
    },
    {
      key: 'filters',
      label: 'Search and filters',
      node: (
      <div key="filters" className="space-y-3">
      <ListToolbar
        fields={fields}
        rows={groups ?? []}
        shown={rows}
        view={view}
        setView={(next) => {
          setPage(0);
          setView(next);
        }}
        saved={list.saved}
        onSaveView={list.saveCurrent}
        onDeleteView={list.deleteSaved}
        onApplyView={list.applySaved}
        onReset={list.reset}
        layout={list.layout}
        shared={list.shared}
        quick={quick}
        searchPlaceholder="Search groups…"
        exportName="groups"
      />
      {notice && <p className="text-xs text-amber-600">{notice}</p>}
      </div>
      ),
    },
    {
      key: 'list',
      label: 'Group list',
      node: (
      <div key="list" className="space-y-3">
      {error ? (
        <div className="flex items-center justify-between rounded border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
          <button onClick={load} className="text-xs font-medium underline">
            Try again
          </button>
        </div>
      ) : (
        <div className="overflow-x-auto rounded-lg border border-slate-200">
          <table className="w-full text-[11px]">
            <thead>
              <tr className="border-b border-slate-300 bg-slate-50">
                <th className="w-10 px-3 py-3 text-left">
                  <input
                    type="checkbox"
                    checked={allChecked}
                    onChange={(e) => setChecked(e.target.checked ? new Set(visible.map((g) => g.id)) : new Set())}
                    aria-label="Select all"
                  />
                </th>
                {list.shown.map((f) => {
                  const level = view.sorts.findIndex((s) => s.field === f.key);
                  return (
                    <th key={f.key} className="whitespace-nowrap px-2.5 py-3 text-left font-semibold text-slate-800" aria-sort={level === 0 ? (view.sorts[0].dir === 'asc' ? 'ascending' : 'descending') : 'none'}>
                      <button type="button" onClick={(e) => sortBy(f.key, e.shiftKey)} title="Click to sort, Shift-click to add a level" className="font-semibold hover:text-primary-700">
                        {f.label}
                        {level >= 0 && (
                          <span className="ml-1 text-primary-700">
                            {view.sorts[level].dir === 'asc' ? '▲' : '▼'}
                            {view.sorts.length > 1 ? level + 1 : ''}
                          </span>
                        )}
                      </button>
                    </th>
                  );
                })}
                <th className="px-2.5 py-3" />
              </tr>
            </thead>
            <tbody>
              {sections.map((s) => (
                <Fragment key={s.key || 'all'}>
                  {grouped && (
                    <tr className="border-b border-slate-200 bg-slate-100">
                      <td colSpan={total} className="px-3 py-1.5">
                        <button
                          type="button"
                          onClick={() => setClosedGroups((prev) => { const n = new Set(prev); if (n.has(s.key)) n.delete(s.key); else n.add(s.key); return n; })}
                          aria-expanded={!closedGroups.has(s.key)}
                          className="flex items-center gap-2 font-semibold text-slate-800"
                        >
                          <span aria-hidden="true">{closedGroups.has(s.key) ? '▸' : '▾'}</span>
                          {s.label}
                          <span className="rounded-full bg-white px-1.5 font-mono text-[10px] text-slate-500 ring-1 ring-slate-200">{s.rows.length}</span>
                        </button>
                      </td>
                    </tr>
                  )}
                  {!(grouped && closedGroups.has(s.key)) &&
                    s.rows.map((g, i) => (
                      <tr key={`${s.key}-${g.id}`} className={`border-b border-slate-100 hover:bg-primary-50/40 ${i % 2 ? 'bg-slate-50' : 'bg-white'}`}>
                        <td className={cell}>
                          <input type="checkbox" checked={checked.has(g.id)} onChange={() => toggle(g.id)} aria-label={`Select ${g.name}`} />
                        </td>
                        {list.shown.map((f) => renderCell(g, f.key))}
                        <td className={`${cell} whitespace-nowrap text-right`}>
                          {canEdit && (
                            <>
                              <button onClick={() => openEdit(g)} className="mr-3 text-primary-700 hover:underline">
                                Edit
                              </button>
                              <button onClick={() => navigate(`/groups/${g.id}?tab=features`)} className="text-primary-700 hover:underline">
                                Features
                              </button>
                            </>
                          )}
                        </td>
                      </tr>
                    ))}
                </Fragment>
              ))}
              {visible.length === 0 && (
                <tr>
                  <td colSpan={total} className="px-3 py-12 text-center text-slate-400">
                    {groups === null ? 'Loading…' : groups.length === 0 ? 'No groups yet. Use New to create the first one.' : 'No groups match. Change or clear the filters.'}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      {!grouped && (
        <div className="flex items-center justify-center gap-3 py-1 text-xs text-slate-600">
          <button disabled={current === 0} onClick={() => setPage(0)} aria-label="First page" className="px-1 disabled:text-slate-300">
            «
          </button>
          <button disabled={current === 0} onClick={() => setPage(current - 1)} aria-label="Previous page" className="px-1 disabled:text-slate-300">
            ‹
          </button>
          <span>
            {rows.length === 0 ? 0 : current * PAGE_SIZE + 1} to {Math.min((current + 1) * PAGE_SIZE, rows.length)} of {rows.length}
          </span>
          <button disabled={current >= pages - 1} onClick={() => setPage(current + 1)} aria-label="Next page" className="px-1 disabled:text-slate-300">
            ›
          </button>
          <button disabled={current >= pages - 1} onClick={() => setPage(pages - 1)} aria-label="Last page" className="px-1 disabled:text-slate-300">
            »
          </button>
        </div>
      )}
      </div>
      ),
    },
  ], { enabled: !itsmView });

  return (
    <div className="space-y-3">
      {parts}

      {creating && (
        <GroupFormModal
          deviceMode={!itsmView}
          onClose={() => setCreating(false)}
          onSaved={(saved: GroupDetail) => {
            setCreating(false);
            navigate(`/groups/${saved.summary.id}`);
          }}
        />
      )}
      {editing && (
        <GroupFormModal
          existing={editing}
          deviceMode={!itsmView && isDeviceGroup(editing.summary)}
          onClose={() => setEditing(null)}
          onSaved={() => {
            setEditing(null);
            toast('Group saved', 'success');
            load();
          }}
        />
      )}
      <ConfirmDialog
        isOpen={deleting !== null}
        title={deleting && deleting.length > 1 ? `Delete ${deleting.length} groups?` : 'Delete this group?'}
        message="The devices, technicians and users inside are not affected."
        confirmLabel="Delete"
        onConfirm={() => void doDelete()}
        onCancel={() => setDeleting(null)}
      />
    </div>
  );
}

function viewTitle(view: string | null): string {
  switch ((view ?? '').toUpperCase()) {
    case 'TECHNICIANS':
      return 'Technician groups';
    case 'USERS':
      return 'User groups';
    default:
      return 'Groups';
  }
}
