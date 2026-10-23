import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { getCategoryMap } from '../../utils/categoryStore';
import { CHANNELS, LEVELS } from '../ITSM/IncidentFormPage';
import {
  FACT_KEYS,
  FACT_LABEL,
  NO_FACTS,
  OPERATORS,
  PRIORITIES,
  describeCondition,
  newId,
  type FactKey,
  type Facts,
} from '../../utils/businessRules';
import {
  BOTH_TARGETS,
  SCHEDULE_LABEL,
  applicableSlas,
  blankEscalation,
  blankSla,
  dueAt,
  durationLabel,
  loadSlas,
  samplePolicy,
  saveSlas,
  slaProblem,
  type EscalationOn,
  type SlaDefinition,
  type SlaEscalation,
  type SlaSchedule,
  type SlaTarget,
  type SlaType,
  type SlaUnit,
} from '../../utils/sla';

const PAGE_SIZE = 20;
const EMPTY = '(empty)';
const TABLE = 'Incident [incident]';

const input =
  'rounded-sm border border-slate-300 bg-white px-2 py-1 text-xs text-slate-800 placeholder:text-slate-400 focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500';
const field =
  'w-full rounded-md border border-slate-300 bg-white px-2.5 py-1.5 text-sm text-slate-800 focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500 disabled:bg-slate-100 disabled:text-slate-500';
const btn = 'rounded border border-slate-300 bg-white px-3 py-1 text-xs font-semibold text-slate-800 hover:bg-slate-100 disabled:opacity-50';
const darkBtn = 'rounded bg-slate-800 px-3 py-1 text-xs font-semibold text-white hover:bg-slate-900 disabled:opacity-50';

const stamp = (iso: string) => (iso ? `${iso.slice(0, 10)} ${iso.slice(11, 19)}` : '');
const when = (d: Date) => d.toLocaleString([], { weekday: 'short', day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' });

type ColKey = 'name' | 'type' | 'target' | 'duration' | 'table' | 'schedule' | 'condition' | 'active' | 'updated';

const describeConditions = (s: SlaDefinition) =>
  s.conditions.length ? s.conditions.map(describeCondition).join(s.match === 'all' ? ' and ' : ' or ') : 'Always';

const isBoth = (s: SlaDefinition) => s.target === BOTH_TARGETS;
const durationOf = (s: SlaDefinition) =>
  isBoth(s) ? `Respond ${durationLabel(s.responseAmount ?? 0, s.responseUnit ?? 'minutes')} / Resolve ${durationLabel(s.amount, s.unit)}` : durationLabel(s.amount, s.unit);

const COLUMNS: { key: ColKey; label: string; get: (s: SlaDefinition) => string }[] = [
  { key: 'name', label: 'Name', get: (s) => s.name },
  { key: 'type', label: 'Type', get: (s) => s.type },
  { key: 'target', label: 'Target', get: (s) => s.target },
  { key: 'duration', label: 'Duration', get: durationOf },
  { key: 'table', label: 'Table', get: () => TABLE },
  { key: 'schedule', label: 'Schedule', get: (s) => (s.schedule === 'business' ? 'Business hours' : '24x7') },
  { key: 'condition', label: 'Condition', get: describeConditions },
  { key: 'active', label: 'Active', get: (s) => String(s.enabled) },
  { key: 'updated', label: 'Updated', get: (s) => stamp(s.updatedAt) },
];

export default function SlaPage() {
  const categories = useMemo(getCategoryMap, []);
  const [list, setList] = useState<SlaDefinition[]>(loadSlas);
  const [editing, setEditing] = useState<SlaDefinition | null>(null);
  const [isNew, setIsNew] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const [searchField, setSearchField] = useState<ColKey>('name');
  const [search, setSearch] = useState('');
  const [colFilter, setColFilter] = useState<Partial<Record<ColKey, string>>>({});
  const [sortKey, setSortKey] = useState<ColKey>('name');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc');
  const [page, setPage] = useState(0);
  const [checked, setChecked] = useState<Set<string>>(new Set());
  const [testing, setTesting] = useState(false);

  const commit = (next: SlaDefinition[]) => {
    setList(next);
    setNotice(saveSlas(next) ? null : 'The browser would not save the change (storage is full or blocked).');
  };

  const open = (s: SlaDefinition, fresh: boolean) => {
    setEditing(JSON.parse(JSON.stringify(s)) as SlaDefinition);
    setIsNew(fresh);
    setProblem(null);
  };

  const patch = (p: Partial<SlaDefinition>) => setEditing((e) => (e ? { ...e, ...p } : e));

  const save = () => {
    if (!editing) return;
    const p = slaProblem(editing);
    if (p) return setProblem(p);
    const stamped = { ...editing, updatedAt: new Date().toISOString() };
    commit(isNew ? [...list, stamped] : list.map((s) => (s.id === stamped.id ? stamped : s)));
    setEditing(null);
  };

  const getCol = (k: ColKey) => COLUMNS.find((c) => c.key === k)!.get;
  const rows = useMemo(() => {
    const q = search.trim().toLowerCase();
    const filtered = list.filter((s) => {
      if (q && !getCol(searchField)(s).toLowerCase().includes(q)) return false;
      return (Object.entries(colFilter) as [ColKey, string][]).every(([k, v]) => !v || getCol(k)(s).toLowerCase().includes(v.trim().toLowerCase()));
    });
    const get = getCol(sortKey);
    return [...filtered].sort((a, b) => {
      const x = get(a).toLowerCase();
      const y = get(b).toLowerCase();
      const c = x < y ? -1 : x > y ? 1 : 0;
      return sortDir === 'asc' ? c : -c;
    });
  }, [list, search, searchField, colFilter, sortKey, sortDir]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    setPage(0);
    setChecked(new Set());
  }, [search, searchField, colFilter]);

  const pages = Math.max(1, Math.ceil(rows.length / PAGE_SIZE));
  const visible = rows.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE);
  const allChecked = visible.length > 0 && visible.every((s) => checked.has(s.id));
  const picked = list.filter((s) => checked.has(s.id));

  const sortBy = (k: ColKey) => {
    if (k === sortKey) setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
    else {
      setSortKey(k);
      setSortDir('asc');
    }
  };

  const runAction = (action: string) => {
    if (!action) return;
    if (picked.length === 0) return setNotice('Select one or more definitions first.');
    setNotice(null);
    if (action === 'edit') return picked.length === 1 ? open(picked[0], false) : setNotice('Select a single definition to edit.');
    if (action === 'copy') {
      commit([...list, ...picked.map((s) => ({ ...JSON.parse(JSON.stringify(s)), id: newId(), name: `${s.name} (copy)`, updatedAt: new Date().toISOString() }))]);
    } else if (action === 'activate' || action === 'deactivate') {
      commit(list.map((s) => (checked.has(s.id) ? { ...s, enabled: action === 'activate', updatedAt: new Date().toISOString() } : s)));
    } else if (action === 'delete') {
      if (!window.confirm(`Delete ${picked.length} definition${picked.length === 1 ? '' : 's'}?`)) return;
      commit(list.filter((s) => !checked.has(s.id)));
    }
    setChecked(new Set());
  };

  const addSample = () => {
    const now = new Date().toISOString();
    commit([...list, ...samplePolicy().map((s) => ({ ...s, updatedAt: now }))]);
  };

  // ---- test panel ----
  const [sample, setSample] = useState<Facts>({ ...NO_FACTS });
  const [samplePriority, setSamplePriority] = useState('2 - High');
  const sampleFacts: Facts = { ...sample, priority: samplePriority };
  const created = useMemo(() => new Date(), [testing]); // eslint-disable-line react-hooks/exhaustive-deps
  const applying = useMemo(() => applicableSlas(list, sampleFacts), [list, sample, samplePriority]); // eslint-disable-line react-hooks/exhaustive-deps

  const valueInput = (fact: FactKey, value: string, onChange: (v: string) => void) => {
    const options: string[] | null =
      fact === 'category'
        ? Object.keys(categories)
        : fact === 'impact' || fact === 'urgency'
          ? LEVELS
          : fact === 'priority'
            ? PRIORITIES.map((p) => p.label)
            : fact === 'channel'
              ? CHANNELS
              : fact === 'subcategory'
                ? Array.from(new Set(Object.values(categories).flat()))
                : null;
    if (!options) return <input value={value} onChange={(e) => onChange(e.target.value)} className={field} placeholder="Text to look for" />;
    const list2 = value && !options.includes(value) ? [value, ...options] : options;
    return (
      <select value={value} onChange={(e) => onChange(e.target.value)} className={field}>
        <option value="">-- Choose --</option>
        {list2.map((o) => (
          <option key={o} value={o}>
            {o}
          </option>
        ))}
      </select>
    );
  };

  /* ===================== record form ===================== */
  if (editing) {
    return (
      <div className="-mx-1">
        <div className="flex flex-wrap items-center gap-3 border-b border-slate-200 bg-slate-100 px-3 py-2">
          <button onClick={() => setEditing(null)} className={btn} aria-label="Back to SLA definitions">
            ← Back
          </button>
          <h1 className="text-sm font-semibold text-slate-900">SLA Definition{editing.name ? ` · ${editing.name}` : ''}</h1>
          <div className="ml-auto flex gap-2">
            <button onClick={() => setEditing(null)} className={btn}>
              Cancel
            </button>
            <button onClick={save} className="rounded bg-primary-600 px-4 py-1 text-xs font-semibold text-white hover:bg-primary-700">
              {isNew ? 'Submit' : 'Update'}
            </button>
          </div>
        </div>

        <div className="space-y-5 p-4">
          {problem && <p className="rounded border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{problem}</p>}

          <div className="grid gap-x-10 gap-y-3 lg:grid-cols-2">
            <label className="block text-xs font-medium text-slate-600">
              <span className="text-red-600">* </span>Name
              <input value={editing.name} onChange={(e) => patch({ name: e.target.value })} className={`${field} mt-1`} placeholder="Priority 1 resolution (1 hour)" autoFocus />
            </label>
            <label className="block text-xs font-medium text-slate-600">
              Table
              <input value={TABLE} disabled className={`${field} mt-1`} />
            </label>
            <label className="block text-xs font-medium text-slate-600">
              Type
              <select value={editing.type} onChange={(e) => patch({ type: e.target.value as SlaType })} className={`${field} mt-1`}>
                <option value="SLA">SLA — promised to the user</option>
                <option value="OLA">OLA — a target between internal teams</option>
              </select>
            </label>
            <label className="block text-xs font-medium text-slate-600">
              Target
              <select
                value={editing.target}
                onChange={(e) => {
                  const target = e.target.value as SlaTarget;
                  patch(target === BOTH_TARGETS ? { target, responseAmount: editing.responseAmount ?? 15, responseUnit: editing.responseUnit ?? 'minutes' } : { target });
                }}
                className={`${field} mt-1`}
              >
                <option value="Response">Response — a technician acknowledges the incident</option>
                <option value="Resolution">Resolution — the incident is fixed</option>
                <option value={BOTH_TARGETS}>Response &amp; Resolution — both, with escalations</option>
              </select>
            </label>
            <div className="text-xs font-medium text-slate-600">
              <span className="text-red-600">* </span>
              {isBoth(editing) ? 'Resolve within' : 'Duration'}
              <div className="mt-1 flex gap-2">
                <input
                  type="number"
                  min={1}
                  value={Number.isFinite(editing.amount) ? editing.amount : ''}
                  onChange={(e) => patch({ amount: e.target.valueAsNumber })}
                  className={`${field} w-28`}
                  aria-label="Duration amount"
                />
                <select value={editing.unit} onChange={(e) => patch({ unit: e.target.value as SlaUnit })} className={field} aria-label="Duration unit">
                  <option value="minutes">Minutes</option>
                  <option value="hours">Hours</option>
                  <option value="days">Days</option>
                </select>
              </div>
            </div>
            {isBoth(editing) && (
              <div className="text-xs font-medium text-slate-600">
                <span className="text-red-600">* </span>Respond within
                <div className="mt-1 flex gap-2">
                  <input
                    type="number"
                    min={1}
                    value={Number.isFinite(editing.responseAmount) ? editing.responseAmount : ''}
                    onChange={(e) => patch({ responseAmount: e.target.valueAsNumber })}
                    className={`${field} w-28`}
                    aria-label="Response amount"
                  />
                  <select value={editing.responseUnit ?? 'minutes'} onChange={(e) => patch({ responseUnit: e.target.value as SlaUnit })} className={field} aria-label="Response unit">
                    <option value="minutes">Minutes</option>
                    <option value="hours">Hours</option>
                    <option value="days">Days</option>
                  </select>
                </div>
              </div>
            )}
            <label className="block text-xs font-medium text-slate-600">
              Operational hours
              <select value={editing.schedule} onChange={(e) => patch({ schedule: e.target.value as SlaSchedule })} className={`${field} mt-1`}>
                <option value="24x7">{SCHEDULE_LABEL['24x7']} — irrespective of operational hours</option>
                <option value="business">{SCHEDULE_LABEL.business}</option>
              </select>
              {editing.schedule === 'business' && editing.unit === 'days' && (
                <span className="mt-0.5 block font-normal text-slate-400">A business day is 9 working hours.</span>
              )}
            </label>
            {isBoth(editing) && editing.schedule === '24x7' && (
              <div className="flex gap-6 self-start pt-5 text-sm text-slate-700">
                <label className="flex items-center gap-2">
                  <input type="checkbox" checked={editing.includeHolidays !== false} onChange={(e) => patch({ includeHolidays: e.target.checked })} className="h-4 w-4" />
                  Including holidays
                </label>
                <label className="flex items-center gap-2">
                  <input type="checkbox" checked={editing.includeWeekends !== false} onChange={(e) => patch({ includeWeekends: e.target.checked })} className="h-4 w-4" />
                  Including weekends
                </label>
              </div>
            )}
            <label className="block text-xs font-medium text-slate-600">
              Order
              <input
                type="number"
                value={editing.order}
                onChange={(e) => patch({ order: Number.isFinite(e.target.valueAsNumber) ? e.target.valueAsNumber : 100 })}
                className={`${field} mt-1`}
              />
              <span className="mt-0.5 block font-normal text-slate-400">If two definitions of the same type and target apply, the lower order counts.</span>
            </label>
            <label className="flex items-center gap-2 self-start pt-6 text-sm text-slate-700">
              <input type="checkbox" checked={editing.enabled} onChange={(e) => patch({ enabled: e.target.checked })} className="h-4 w-4" />
              Active
            </label>
            <label className="block text-xs font-medium text-slate-600 lg:col-span-2">
              Description
              <input value={editing.description} onChange={(e) => patch({ description: e.target.value })} className={`${field} mt-1`} placeholder="What does this target cover?" />
            </label>
          </div>

          <section className="space-y-2 rounded border border-slate-200 p-3">
            <div className="flex flex-wrap items-center gap-2 text-sm text-slate-700">
              <span className="font-semibold">Applies to incidents where</span>
              <select value={editing.match} onChange={(e) => patch({ match: e.target.value as 'all' | 'any' })} className={`${field} w-auto`}>
                <option value="all">all of these match</option>
                <option value="any">any one of these matches</option>
              </select>
            </div>
            {editing.conditions.map((c) => {
              const needsValue = OPERATORS.find((o) => o.key === c.op)?.needsValue;
              const upd = (p: Partial<typeof c>) => patch({ conditions: editing.conditions.map((x) => (x.id === c.id ? { ...x, ...p } : x)) });
              return (
                <div key={c.id} className="grid gap-2 sm:grid-cols-[1fr_1fr_1.4fr_auto]">
                  <select value={c.field} onChange={(e) => upd({ field: e.target.value as FactKey, value: '' })} className={field}>
                    {FACT_KEYS.map((k) => (
                      <option key={k} value={k}>
                        {FACT_LABEL[k]}
                      </option>
                    ))}
                  </select>
                  <select value={c.op} onChange={(e) => upd({ op: e.target.value as typeof c.op })} className={field}>
                    {OPERATORS.map((o) => (
                      <option key={o.key} value={o.key}>
                        {o.label}
                      </option>
                    ))}
                  </select>
                  {needsValue ? valueInput(c.field, c.value, (v) => upd({ value: v })) : <span />}
                  <button className={`${btn} text-red-600`} onClick={() => patch({ conditions: editing.conditions.filter((x) => x.id !== c.id) })} aria-label="Remove condition">
                    ✕
                  </button>
                </div>
              );
            })}
            <button className={btn} onClick={() => patch({ conditions: [...editing.conditions, { id: newId(), field: 'priority', op: 'is', value: '' }] })}>
              + Add condition
            </button>
            {editing.conditions.length === 0 && <p className="text-xs text-amber-600">With no conditions this applies to every incident.</p>}
          </section>

          {isBoth(editing) && (
            <>
              {(['response', 'resolution'] as EscalationOn[]).map((on) => {
                const levels = (editing.escalations ?? []).filter((e) => e.on === on);
                const setLevels = (next: SlaEscalation[]) => patch({ escalations: [...(editing.escalations ?? []).filter((e) => e.on !== on), ...next] });
                const upd = (id: string, p: Partial<SlaEscalation>) => setLevels(levels.map((e) => (e.id === id ? { ...e, ...p } : e)));
                return (
                  <section key={on} className="space-y-2 rounded border border-slate-200 p-3">
                    <h2 className="text-sm font-semibold text-slate-900">If {on} time has elapsed</h2>
                    {levels.length === 0 && <p className="text-xs text-slate-400">Escalation not configured.</p>}
                    {levels.map((e, i) => (
                      <div key={e.id} className="space-y-2 border-t border-slate-100 pt-2">
                        <div className="flex items-center justify-between text-xs font-semibold text-slate-700">
                          Level {i + 1} Escalation
                          <button className={`${btn} text-red-600`} onClick={() => setLevels(levels.filter((x) => x.id !== e.id))} aria-label={`Remove level ${i + 1}`}>
                            ✕
                          </button>
                        </div>
                        <div className="grid gap-2 sm:grid-cols-[1.6fr_auto_auto_auto]">
                          <input value={e.to} onChange={(ev) => upd(e.id, { to: ev.target.value })} className={field} placeholder="Escalate to, comma separated (e.g. $Ticket Owner, Solenis SMO)" aria-label="Escalate to" />
                          <select value={e.when} onChange={(ev) => upd(e.id, { when: ev.target.value as 'before' | 'after' })} className={field} aria-label="Before or after">
                            <option value="before">Escalate before</option>
                            <option value="after">Escalate after</option>
                          </select>
                          <input
                            type="number"
                            min={0}
                            value={Number.isFinite(e.amount) ? e.amount : ''}
                            onChange={(ev) => upd(e.id, { amount: ev.target.valueAsNumber })}
                            className={`${field} w-24`}
                            aria-label="Escalation time"
                          />
                          <select value={e.unit} onChange={(ev) => upd(e.id, { unit: ev.target.value as SlaUnit })} className={field} aria-label="Escalation unit">
                            <option value="minutes">Minutes</option>
                            <option value="hours">Hours</option>
                            <option value="days">Days</option>
                          </select>
                        </div>
                        <input value={e.actions} onChange={(ev) => upd(e.id, { actions: ev.target.value })} className={field} placeholder="Actions (optional)" aria-label="Actions" />
                      </div>
                    ))}
                    <button className={btn} onClick={() => setLevels([...levels, blankEscalation(on)])}>
                      + Add level
                    </button>
                  </section>
                );
              })}

              <section className="space-y-3 rounded border border-slate-200 bg-slate-50 p-4 text-xs text-slate-700">
                <h2 className="border-b border-slate-200 pb-1 text-sm font-semibold text-slate-900">Conditions</h2>
                <div>
                  <p className="font-semibold text-slate-900">Criteria</p>
                  <p className="pl-4">{editing.conditions.length ? editing.conditions.map(describeCondition).join(editing.match === 'all' ? ' and ' : ' or ') : 'Every incident'}</p>
                </div>
                <div>
                  <p>Any request matching above conditions should be</p>
                  <p className="pl-4">
                    <strong>Responded</strong> within <strong>{durationLabel(editing.responseAmount ?? 0, editing.responseUnit ?? 'minutes')}</strong>
                  </p>
                  <p className="pl-4">
                    <strong>Resolved</strong> within <strong>{durationLabel(editing.amount, editing.unit)}</strong>
                  </p>
                </div>
                <div>
                  <p>
                    Should be resolved {editing.schedule === 'business' ? 'within' : 'irrespective of'} <strong>operational hours</strong>
                  </p>
                  {editing.schedule === '24x7' && (
                    <>
                      <p className="pl-4">
                        {editing.includeHolidays !== false ? 'Including' : 'Excluding'} <strong>holidays</strong>
                      </p>
                      <p className="pl-4">
                        {editing.includeWeekends !== false ? 'Including' : 'Excluding'} <strong>weekends</strong>
                      </p>
                    </>
                  )}
                </div>
                {(['response', 'resolution'] as EscalationOn[]).map((on) => {
                  const levels = (editing.escalations ?? []).filter((e) => e.on === on);
                  return (
                    <div key={on}>
                      <p className="border-b border-slate-200 pb-1 font-semibold text-slate-900">If {on} time has elapsed</p>
                      {levels.length === 0 && <p className="py-1 pl-4 text-slate-400">Escalation not configured</p>}
                      {levels.map((e, i) => (
                        <div key={e.id} className="pt-2">
                          <p className="font-semibold text-slate-900">Level {i + 1} Escalation</p>
                          <p className="pl-4">
                            <span className="text-amber-700">Escalate To</span>{' '}
                            {e.to
                              .split(',')
                              .filter((t) => t.trim())
                              .map((t) => (
                                <span key={t} className="mr-1 rounded border border-slate-200 bg-white px-1.5 py-0.5">
                                  {t.trim()}
                                </span>
                              ))}
                          </p>
                          <p className="pl-4">
                            Escalate {e.when} <strong>{durationLabel(e.amount, e.unit)}</strong>
                          </p>
                          <p className="pl-4">
                            <span className="text-amber-700">Actions</span> {e.actions.trim() || <span className="text-slate-400">No actions are configured</span>}
                          </p>
                        </div>
                      ))}
                    </div>
                  );
                })}
              </section>
            </>
          )}
        </div>
      </div>
    );
  }

  /* ===================== list ===================== */
  const th = (c: (typeof COLUMNS)[number]) => (
    <th key={c.key} onClick={() => sortBy(c.key)} className="cursor-pointer select-none whitespace-nowrap px-2.5 py-2 text-left text-xs font-semibold text-slate-900">
      {c.label}
      {c.key === sortKey && <span className="ml-1 text-[9px]">{sortDir === 'asc' ? '▲' : '▼'}</span>}
    </th>
  );

  return (
    <div className="-mx-1 space-y-0">
      <div className="flex flex-wrap items-center gap-3 border-b border-slate-200 bg-slate-100 px-3 py-2">
        <Link to="/setup" className="text-sm text-slate-500 hover:text-slate-800" aria-label="Back to Setup" title="Back to Setup">
          ☰
        </Link>
        <h1 className="text-sm font-semibold text-slate-900">SLA Definitions</h1>
        <div className="flex items-center">
          <select value={searchField} onChange={(e) => setSearchField(e.target.value as ColKey)} className={`${input} w-36 rounded-l`} aria-label="Search field">
            {COLUMNS.map((c) => (
              <option key={c.key} value={c.key}>
                {c.label}
              </option>
            ))}
          </select>
          <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search" className={`${input} -ml-px w-56 rounded-r`} aria-label="Search" />
        </div>
        <div className="ml-auto flex items-center gap-3">
          <select value="" onChange={(e) => runAction(e.target.value)} className={`${input} w-56 rounded`} aria-label="Actions on selected rows">
            <option value="">Actions on selected rows...</option>
            <option value="edit">Edit</option>
            <option value="activate">Activate</option>
            <option value="deactivate">Deactivate</option>
            <option value="copy">Copy</option>
            <option value="delete">Delete</option>
          </select>
          <button onClick={() => setTesting((t) => !t)} className={btn} aria-pressed={testing}>
            Test SLAs
          </button>
          <button onClick={() => open(blankSla(), true)} className={darkBtn}>
            New
          </button>
        </div>
      </div>

      <div className="px-3 py-2 text-xs">
        <span className="font-medium text-primary-700">All</span>
        <span className="ml-1 text-slate-400">({list.length})</span>
        <span className="ml-4 text-slate-400">
          An SLA is how long the team has to respond to, and to resolve, an incident. Definitions are saved on the server; deadlines are not tracked on incidents yet.
        </span>
        {notice && <span className="ml-4 text-amber-600">{notice}</span>}
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-[11px]">
          <thead>
            <tr className="border-y border-slate-300">
              <th className="w-10 px-3 py-3 text-left">
                <input
                  type="checkbox"
                  checked={allChecked}
                  onChange={(e) => setChecked(e.target.checked ? new Set(visible.map((s) => s.id)) : new Set())}
                  aria-label="Select all"
                />
              </th>
              {COLUMNS.map(th)}
            </tr>
            <tr className="border-b border-slate-300 bg-slate-100">
              <th className="px-3 py-2 text-left text-slate-400" aria-hidden="true">
                ⌕
              </th>
              {COLUMNS.map((c) => (
                <th key={c.key} className="px-2 py-2 font-normal">
                  <input
                    value={colFilter[c.key] ?? ''}
                    onChange={(e) => setColFilter((f) => ({ ...f, [c.key]: e.target.value }))}
                    placeholder="Search"
                    aria-label={`Search ${c.label}`}
                    className={`${input} w-full min-w-[70px]`}
                  />
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {visible.map((s, i) => (
              <tr key={s.id} className={`border-b border-slate-100 hover:bg-primary-50/40 ${i % 2 ? 'bg-slate-50' : 'bg-white'}`}>
                <td className="px-2.5 py-2 align-top">
                  <input
                    type="checkbox"
                    checked={checked.has(s.id)}
                    onChange={() =>
                      setChecked((prev) => {
                        const next = new Set(prev);
                        if (next.has(s.id)) next.delete(s.id);
                        else next.add(s.id);
                        return next;
                      })
                    }
                    aria-label={`Select ${s.name}`}
                  />
                </td>
                <td className="px-2.5 py-2 align-top">
                  <button onClick={() => open(s, false)} className="text-left font-medium text-primary-700 hover:underline">
                    {s.name}
                  </button>
                </td>
                <td className="px-2.5 py-2 align-top text-slate-800">{s.type}</td>
                <td className="px-2.5 py-2 align-top text-slate-800">{s.target}</td>
                <td className="whitespace-nowrap px-2.5 py-2 align-top text-slate-800">{durationOf(s)}</td>
                <td className="whitespace-nowrap px-2.5 py-2 align-top text-slate-800">{TABLE}</td>
                <td className="whitespace-nowrap px-2.5 py-2 align-top text-slate-800">{s.schedule === 'business' ? 'Business hours' : '24x7'}</td>
                <td className="max-w-xs px-2.5 py-2 align-top text-slate-800">{describeConditions(s)}</td>
                <td className="px-2.5 py-2 align-top text-slate-800">{String(s.enabled)}</td>
                <td className="whitespace-nowrap px-2.5 py-2 align-top text-slate-700">{stamp(s.updatedAt) || EMPTY}</td>
              </tr>
            ))}
            {visible.length === 0 && (
              <tr>
                <td colSpan={COLUMNS.length + 1} className="px-3 py-10 text-center text-slate-400">
                  {list.length === 0 ? (
                    <div className="space-y-2">
                      <p>No records to display</p>
                      <button onClick={addSample} className={btn}>
                        Add the sample policy (Critical 15 min / 1 h … Low 4 business hours / 2 business days)
                      </button>
                    </div>
                  ) : (
                    'No records to display'
                  )}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <div className="flex items-center justify-center gap-3 border-t border-slate-200 py-2.5 text-xs text-slate-600">
        <button disabled={page === 0} onClick={() => setPage(0)} aria-label="First page" className="px-1 disabled:text-slate-300">
          «
        </button>
        <button disabled={page === 0} onClick={() => setPage(page - 1)} aria-label="Previous page" className="px-1 disabled:text-slate-300">
          ‹
        </button>
        <span>
          {rows.length === 0 ? 0 : page * PAGE_SIZE + 1} to {Math.min((page + 1) * PAGE_SIZE, rows.length)} of {rows.length}
        </span>
        <button disabled={page >= pages - 1} onClick={() => setPage(page + 1)} aria-label="Next page" className="px-1 disabled:text-slate-300">
          ›
        </button>
        <button disabled={page >= pages - 1} onClick={() => setPage(pages - 1)} aria-label="Last page" className="px-1 disabled:text-slate-300">
          »
        </button>
      </div>

      {testing && (
        <section className="m-3 space-y-3 rounded border border-slate-200 bg-white p-4">
          <div>
            <h2 className="text-sm font-semibold text-slate-900">Test SLAs</h2>
            <p className="text-xs text-slate-500">
              Pretend an incident was created right now and see which targets apply and when each falls due. Nothing is created.
            </p>
          </div>
          <div className="grid gap-3 sm:grid-cols-3">
            <label className="block text-xs font-medium text-slate-600">
              Priority
              <select
                value={samplePriority}
                onChange={(e) => setSamplePriority(e.target.value)}
                className={`${field} mt-1`}
              >
                {PRIORITIES.map((p) => (
                  <option key={p.value}>{p.label}</option>
                ))}
              </select>
            </label>
            <label className="block text-xs font-medium text-slate-600">
              Category
              <select value={sample.category} onChange={(e) => setSample({ ...sample, category: e.target.value })} className={`${field} mt-1`}>
                <option value="">-- None --</option>
                {Object.keys(categories).map((c) => (
                  <option key={c}>{c}</option>
                ))}
              </select>
            </label>
            <label className="block text-xs font-medium text-slate-600">
              Channel
              <select value={sample.channel} onChange={(e) => setSample({ ...sample, channel: e.target.value })} className={`${field} mt-1`}>
                <option value="">-- None --</option>
                {CHANNELS.map((c) => (
                  <option key={c}>{c}</option>
                ))}
              </select>
            </label>
          </div>
          <div className="rounded bg-slate-50 p-3 text-sm">
            {list.length === 0 ? (
              <p className="text-slate-500">Create a definition to test it.</p>
            ) : applying.length === 0 ? (
              <p className="text-slate-600">No SLA definition applies to this incident, so no deadline would be tracked.</p>
            ) : (
              <ul className="space-y-1 text-slate-700">
                {applying.map((s) => (
                  <li key={s.id}>
                    <strong>
                      {s.type} {s.target}
                    </strong>{' '}
                    — {durationLabel(s.amount, s.unit)} ({s.schedule === 'business' ? 'business hours' : '24x7'}) → due <strong>{when(dueAt(s, created))}</strong>
                    <span className="ml-2 text-xs text-slate-400">{s.name}</span>
                  </li>
                ))}
              </ul>
            )}
          </div>
          <p className="text-xs text-slate-400">Created at {when(created)}.</p>
        </section>
      )}
    </div>
  );
}
