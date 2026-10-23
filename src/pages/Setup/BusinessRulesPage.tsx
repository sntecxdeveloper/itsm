import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAssignmentGroups } from '../../hooks/useAssignmentGroups';
import { getCategoryMap } from '../../utils/categoryStore';
import { loadFormSettings } from '../../utils/incidentFormStore';
import { LEVELS, derivedPriority } from '../ITSM/IncidentFormPage';
import {
  ACTION_LABEL,
  FACT_KEYS,
  FACT_LABEL,
  NO_FACTS,
  OPERATORS,
  PRIORITIES,
  blankRule,
  describeAction,
  describeCondition,
  evaluateRules,
  loadRules,
  newId,
  ruleProblem,
  saveRules,
  type ActionType,
  type BusinessRule,
  type FactKey,
  type Facts,
} from '../../utils/businessRules';

const PAGE_SIZE = 20;
const EMPTY = '(empty)';
const TABLE = 'Incident [incident]';
const APPLICATION = 'Global';
// The rules run on the New Incident page just before the incident is saved.
const WHEN = 'before';

const input =
  'rounded-sm border border-slate-300 bg-white px-2 py-1 text-xs text-slate-800 placeholder:text-slate-400 focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500';
const field =
  'w-full rounded-md border border-slate-300 bg-white px-2.5 py-1.5 text-sm text-slate-800 focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500 disabled:bg-slate-100 disabled:text-slate-500';
const btn = 'rounded border border-slate-300 bg-white px-3 py-1 text-xs font-semibold text-slate-800 hover:bg-slate-100 disabled:opacity-50';
const darkBtn = 'rounded bg-slate-800 px-3 py-1 text-xs font-semibold text-white hover:bg-slate-900 disabled:opacity-50';

const stamp = (iso: string) => (iso ? `${iso.slice(0, 10)} ${iso.slice(11, 19)}` : '');

type ColKey = 'name' | 'active' | 'table' | 'application' | 'order' | 'updated' | 'when' | 'condition' | 'actions';

const COLUMNS: { key: ColKey; label: string; get: (r: BusinessRule) => string }[] = [
  { key: 'name', label: 'Name', get: (r) => r.name },
  { key: 'active', label: 'Active', get: (r) => String(r.enabled) },
  { key: 'table', label: 'Table', get: () => TABLE },
  { key: 'application', label: 'Application', get: () => APPLICATION },
  { key: 'order', label: 'Order', get: (r) => String(r.order) },
  { key: 'updated', label: 'Updated', get: (r) => stamp(r.updatedAt) },
  { key: 'when', label: 'When', get: () => WHEN },
  {
    key: 'condition',
    label: 'Condition',
    get: (r) => (r.conditions.length ? r.conditions.map(describeCondition).join(r.match === 'all' ? ' and ' : ' or ') : 'Always'),
  },
  { key: 'actions', label: 'Actions', get: (r) => r.actions.map(describeAction).join(', ') + (r.stop ? ' · then stop' : '') },
];

/** Starting points taken from the usual ITSM rules; the group is picked after choosing one. */
const EXAMPLES: { title: string; make: () => BusinessRule }[] = [
  {
    title: 'Automatic group assignment (Category is Software)',
    make: () => ({
      ...blankRule(),
      name: 'Software ticket assignment',
      description: 'Software incidents go straight to the software support group.',
      conditions: [{ id: newId(), field: 'category', op: 'is', value: 'Software' }],
      actions: [{ id: newId(), type: 'ASSIGN_GROUP', value: '' }],
    }),
  },
  {
    title: 'High-priority incident (Impact High and Urgency High)',
    make: () => ({
      ...blankRule(),
      name: 'High impact and urgency',
      description: 'Make it critical and tell the support team.',
      conditions: [
        { id: newId(), field: 'impact', op: 'is', value: '1 - High' },
        { id: newId(), field: 'urgency', op: 'is', value: '1 - High' },
      ],
      actions: [
        { id: newId(), type: 'SET_PRIORITY', value: 'CRITICAL' },
        { id: newId(), type: 'EMAIL_GROUP', value: '' },
      ],
    }),
  },
  {
    title: 'Email the group (Channel is Email)',
    make: () => ({
      ...blankRule(),
      name: 'Tell the team about emailed incidents',
      conditions: [{ id: newId(), field: 'channel', op: 'is', value: 'Email' }],
      actions: [{ id: newId(), type: 'EMAIL_GROUP', value: '' }],
    }),
  },
];

export default function BusinessRulesPage() {
  const groups = useAssignmentGroups();
  const categories = useMemo(getCategoryMap, []);
  const [rules, setRules] = useState<BusinessRule[]>(loadRules);
  const [editing, setEditing] = useState<BusinessRule | null>(null);
  const [isNew, setIsNew] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  // list state
  const [searchField, setSearchField] = useState<ColKey>('name');
  const [search, setSearch] = useState('');
  const [colFilter, setColFilter] = useState<Partial<Record<ColKey, string>>>({});
  const [sortKey, setSortKey] = useState<ColKey>('updated');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc');
  const [page, setPage] = useState(0);
  const [checked, setChecked] = useState<Set<string>>(new Set());
  const [testing, setTesting] = useState(false);

  const commit = (next: BusinessRule[]) => {
    setRules(next);
    setNotice(saveRules(next) ? null : 'The browser would not save the change (storage is full or blocked).');
  };

  const open = (rule: BusinessRule, fresh: boolean) => {
    setEditing(JSON.parse(JSON.stringify(rule)) as BusinessRule);
    setIsNew(fresh);
    setProblem(null);
  };

  const save = () => {
    if (!editing) return;
    const p = ruleProblem(editing);
    if (p) return setProblem(p);
    const stamped = { ...editing, updatedAt: new Date().toISOString() };
    commit(isNew ? [...rules, stamped] : rules.map((r) => (r.id === stamped.id ? stamped : r)));
    setEditing(null);
  };

  const patch = (p: Partial<BusinessRule>) => setEditing((e) => (e ? { ...e, ...p } : e));

  // ---- the list ----
  const getCol = (k: ColKey) => COLUMNS.find((c) => c.key === k)!.get;
  const rows = useMemo(() => {
    const q = search.trim().toLowerCase();
    const filtered = rules.filter((r) => {
      if (q && !getCol(searchField)(r).toLowerCase().includes(q)) return false;
      return (Object.entries(colFilter) as [ColKey, string][]).every(([k, v]) => !v || getCol(k)(r).toLowerCase().includes(v.trim().toLowerCase()));
    });
    const get = getCol(sortKey);
    const numeric = sortKey === 'order';
    return [...filtered].sort((a, b) => {
      const x = numeric ? Number(get(a)) : get(a).toLowerCase();
      const y = numeric ? Number(get(b)) : get(b).toLowerCase();
      const c = x < y ? -1 : x > y ? 1 : 0;
      return sortDir === 'asc' ? c : -c;
    });
  }, [rules, search, searchField, colFilter, sortKey, sortDir]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    setPage(0);
    setChecked(new Set());
  }, [search, searchField, colFilter]);

  const pages = Math.max(1, Math.ceil(rows.length / PAGE_SIZE));
  const visible = rows.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE);
  const allChecked = visible.length > 0 && visible.every((r) => checked.has(r.id));
  const picked = rules.filter((r) => checked.has(r.id));

  const sortBy = (k: ColKey) => {
    if (k === sortKey) setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
    else {
      setSortKey(k);
      setSortDir('asc');
    }
  };

  const runAction = (action: string) => {
    if (!action) return;
    if (picked.length === 0) return setNotice('Select one or more rules first.');
    setNotice(null);
    if (action === 'edit') return picked.length === 1 ? open(picked[0], false) : setNotice('Select a single rule to edit.');
    if (action === 'copy') {
      const stamped = picked.map((r) => ({ ...JSON.parse(JSON.stringify(r)), id: newId(), name: `${r.name} (copy)`, updatedAt: new Date().toISOString() }));
      commit([...rules, ...stamped]);
    } else if (action === 'activate' || action === 'deactivate') {
      const on = action === 'activate';
      commit(rules.map((r) => (checked.has(r.id) ? { ...r, enabled: on, updatedAt: new Date().toISOString() } : r)));
    } else if (action === 'delete') {
      if (!window.confirm(`Delete ${picked.length} rule${picked.length === 1 ? '' : 's'}?`)) return;
      commit(rules.filter((r) => !checked.has(r.id)));
    }
    setChecked(new Set());
  };

  // ---- the "try it" panel ----
  const [sample, setSample] = useState<Facts>({ ...NO_FACTS });
  const sampleFacts: Facts = { ...sample, priority: derivedPriority(sample.impact, sample.urgency) ?? '' };
  const outcome = useMemo(() => evaluateRules(rules, sampleFacts), [rules, sample]); // eslint-disable-line react-hooks/exhaustive-deps

  const valueInput = (fact: FactKey, value: string, onChange: (v: string) => void) => {
    const options: string[] | null =
      fact === 'category'
        ? Object.keys(categories)
        : fact === 'impact' || fact === 'urgency'
          ? LEVELS
          : fact === 'priority'
            ? PRIORITIES.map((p) => p.label)
            : fact === 'channel'
              ? loadFormSettings().channels
              : fact === 'subcategory'
                ? Array.from(new Set(Object.values(categories).flat()))
                : null;
    if (!options) return <input value={value} onChange={(e) => onChange(e.target.value)} className={field} placeholder="Text to look for" />;
    const list = value && !options.includes(value) ? [value, ...options] : options;
    return (
      <select value={value} onChange={(e) => onChange(e.target.value)} className={field}>
        <option value="">-- Choose --</option>
        {list.map((o) => (
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
          <button onClick={() => setEditing(null)} className={btn} aria-label="Back to business rules">
            ← Back
          </button>
          <h1 className="text-sm font-semibold text-slate-900">Business Rule{editing.name ? ` · ${editing.name}` : ''}</h1>
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
              <input value={editing.name} onChange={(e) => patch({ name: e.target.value })} className={`${field} mt-1`} placeholder="Software ticket assignment" autoFocus />
            </label>
            <label className="block text-xs font-medium text-slate-600">
              Table
              <input value={TABLE} disabled className={`${field} mt-1`} />
            </label>
            <label className="block text-xs font-medium text-slate-600">
              Application
              <input value={APPLICATION} disabled className={`${field} mt-1`} />
            </label>
            <label className="block text-xs font-medium text-slate-600">
              When to run
              <input value={`${WHEN} the incident is saved (when it is created)`} disabled className={`${field} mt-1`} />
            </label>
            <label className="block text-xs font-medium text-slate-600">
              Order
              <input
                type="number"
                value={editing.order}
                onChange={(e) => patch({ order: Number.isFinite(e.target.valueAsNumber) ? e.target.valueAsNumber : 100 })}
                className={`${field} mt-1`}
              />
              <span className="mt-0.5 block font-normal text-slate-400">Lower numbers run first.</span>
            </label>
            <label className="flex items-center gap-2 self-start pt-6 text-sm text-slate-700">
              <input type="checkbox" checked={editing.enabled} onChange={(e) => patch({ enabled: e.target.checked })} className="h-4 w-4" />
              Active
            </label>
            <label className="block text-xs font-medium text-slate-600 lg:col-span-2">
              Description
              <input value={editing.description} onChange={(e) => patch({ description: e.target.value })} className={`${field} mt-1`} placeholder="What is this rule for?" />
            </label>
          </div>

          {/* conditions */}
          <section className="space-y-2 rounded border border-slate-200 p-3">
            <div className="flex flex-wrap items-center gap-2 text-sm text-slate-700">
              <span className="font-semibold">Condition</span>
              <select value={editing.match} onChange={(e) => patch({ match: e.target.value as 'all' | 'any' })} className={`${field} w-auto`}>
                <option value="all">All of these must match</option>
                <option value="any">Any one of these must match</option>
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
            <button className={btn} onClick={() => patch({ conditions: [...editing.conditions, { id: newId(), field: 'category', op: 'is', value: '' }] })}>
              + Add condition
            </button>
            {editing.conditions.length === 0 && <p className="text-xs text-amber-600">With no conditions the rule runs for every new incident.</p>}
          </section>

          {/* actions */}
          <section className="space-y-2 rounded border border-slate-200 p-3">
            <p className="text-sm font-semibold text-slate-700">Actions</p>
            {editing.actions.map((a) => {
              const upd = (p: Partial<typeof a>) => patch({ actions: editing.actions.map((x) => (x.id === a.id ? { ...x, ...p } : x)) });
              const isGroup = a.type === 'ASSIGN_GROUP' || a.type === 'EMAIL_GROUP';
              return (
                <div key={a.id} className="grid gap-2 sm:grid-cols-[1fr_1.4fr_auto]">
                  <select value={a.type} onChange={(e) => upd({ type: e.target.value as ActionType, value: '', label: undefined })} className={field}>
                    {(Object.keys(ACTION_LABEL) as ActionType[]).map((t) => (
                      <option key={t} value={t}>
                        {ACTION_LABEL[t]}
                      </option>
                    ))}
                  </select>
                  {isGroup ? (
                    <select
                      value={a.value}
                      onChange={(e) => upd({ value: e.target.value, label: groups.find((g) => String(g.id) === e.target.value)?.name })}
                      className={field}
                    >
                      <option value="">{groups.length ? '-- Choose a group --' : 'No technician groups yet'}</option>
                      {a.value && !groups.some((g) => String(g.id) === a.value) && <option value={a.value}>{a.label ?? `Group ${a.value}`}</option>}
                      {groups.map((g) => (
                        <option key={g.id} value={String(g.id)}>
                          {g.name}
                        </option>
                      ))}
                    </select>
                  ) : a.type === 'SET_PRIORITY' ? (
                    <select value={a.value} onChange={(e) => upd({ value: e.target.value })} className={field}>
                      <option value="">-- Choose a priority --</option>
                      {PRIORITIES.map((p) => (
                        <option key={p.value} value={p.value}>
                          {p.label}
                        </option>
                      ))}
                    </select>
                  ) : (
                    <input value={a.value} onChange={(e) => upd({ value: e.target.value })} className={field} placeholder="Technician username" />
                  )}
                  <button className={`${btn} text-red-600`} onClick={() => patch({ actions: editing.actions.filter((x) => x.id !== a.id) })} aria-label="Remove action">
                    ✕
                  </button>
                </div>
              );
            })}
            <button className={btn} onClick={() => patch({ actions: [...editing.actions, { id: newId(), type: 'ASSIGN_GROUP', value: '' }] })}>
              + Add action
            </button>
            <p className="text-xs text-slate-500">
              Assignment actions only fill the group or technician when the person left them empty on the form. “Email the members of a group” sends the “Ticket
              created” template to every enabled technician and user in that group.
            </p>
            <label className="mt-1 flex items-center gap-2 text-sm text-slate-700">
              <input type="checkbox" checked={editing.stop} onChange={(e) => patch({ stop: e.target.checked })} className="h-4 w-4" />
              Stop — do not run the rules below this one when it matches
            </label>
          </section>
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
      {/* Title bar */}
      <div className="flex flex-wrap items-center gap-3 border-b border-slate-200 bg-slate-100 px-3 py-2">
        <Link to="/setup" className="text-sm text-slate-500 hover:text-slate-800" aria-label="Back to Setup" title="Back to Setup">
          ☰
        </Link>
        <h1 className="text-sm font-semibold text-slate-900">Business Rules</h1>
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
            Test rules
          </button>
          <button onClick={() => open(blankRule(), true)} className={darkBtn}>
            New
          </button>
        </div>
      </div>

      <div className="px-3 py-2 text-xs">
        <span className="font-medium text-primary-700">All</span>
        <span className="ml-1 text-slate-400">({rules.length})</span>
        <span className="ml-4 text-slate-400">Rules run lowest Order first, when an incident is created on the New Incident page.</span>
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
                  onChange={(e) => setChecked(e.target.checked ? new Set(visible.map((r) => r.id)) : new Set())}
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
            {visible.map((r, i) => (
              <tr key={r.id} className={`border-b border-slate-100 hover:bg-primary-50/40 ${i % 2 ? 'bg-slate-50' : 'bg-white'}`}>
                <td className="px-2.5 py-2 align-top">
                  <input
                    type="checkbox"
                    checked={checked.has(r.id)}
                    onChange={() =>
                      setChecked((prev) => {
                        const next = new Set(prev);
                        if (next.has(r.id)) next.delete(r.id);
                        else next.add(r.id);
                        return next;
                      })
                    }
                    aria-label={`Select ${r.name}`}
                  />
                </td>
                <td className="whitespace-nowrap px-2.5 py-2 align-top">
                  <button onClick={() => open(r, false)} className="font-medium text-primary-700 hover:underline">
                    {r.name}
                  </button>
                </td>
                <td className="px-2.5 py-2 align-top text-slate-800">{String(r.enabled)}</td>
                <td className="whitespace-nowrap px-2.5 py-2 align-top text-slate-800">{TABLE}</td>
                <td className="px-2.5 py-2 align-top text-primary-700">{APPLICATION}</td>
                <td className="px-2.5 py-2 align-top text-right text-slate-800">{r.order}</td>
                <td className="whitespace-nowrap px-2.5 py-2 align-top text-slate-700">{stamp(r.updatedAt) || EMPTY}</td>
                <td className="px-2.5 py-2 align-top text-slate-800">{WHEN}</td>
                <td className="max-w-xs px-2.5 py-2 align-top text-slate-800">{getCol('condition')(r)}</td>
                <td className="max-w-xs px-2.5 py-2 align-top text-slate-800">{getCol('actions')(r)}</td>
              </tr>
            ))}
            {visible.length === 0 && (
              <tr>
                <td colSpan={COLUMNS.length + 1} className="px-3 py-10 text-center text-slate-400">
                  {rules.length === 0 ? (
                    <div className="space-y-2">
                      <p>No records to display</p>
                      <p className="text-xs">Start from an example:</p>
                      <div className="flex flex-wrap justify-center gap-2">
                        {EXAMPLES.map((ex) => (
                          <button key={ex.title} onClick={() => open(ex.make(), true)} className={btn}>
                            {ex.title}
                          </button>
                        ))}
                      </div>
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

      {/* Pagination */}
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

      {/* try it */}
      {testing && (
        <section className="m-3 space-y-3 rounded border border-slate-200 bg-white p-4">
          <div>
            <h2 className="text-sm font-semibold text-slate-900">Test rules</h2>
            <p className="text-xs text-slate-500">Fill in a sample incident and see which rules would run and what they would do. Nothing is created or sent.</p>
          </div>
          <div className="grid gap-3 sm:grid-cols-3">
            <label className="block text-xs font-medium text-slate-600">
              Category
              <select value={sample.category} onChange={(e) => setSample({ ...sample, category: e.target.value, subcategory: '' })} className={`${field} mt-1`}>
                <option value="">-- None --</option>
                {Object.keys(categories).map((c) => (
                  <option key={c}>{c}</option>
                ))}
              </select>
            </label>
            <label className="block text-xs font-medium text-slate-600">
              Subcategory
              <select value={sample.subcategory} onChange={(e) => setSample({ ...sample, subcategory: e.target.value })} className={`${field} mt-1`}>
                <option value="">-- None --</option>
                {(categories[sample.category] ?? []).map((c) => (
                  <option key={c}>{c}</option>
                ))}
              </select>
            </label>
            <label className="block text-xs font-medium text-slate-600">
              Channel
              <select value={sample.channel} onChange={(e) => setSample({ ...sample, channel: e.target.value })} className={`${field} mt-1`}>
                <option value="">-- None --</option>
                {loadFormSettings().channels.map((c) => (
                  <option key={c}>{c}</option>
                ))}
              </select>
            </label>
            <label className="block text-xs font-medium text-slate-600">
              Impact
              <select value={sample.impact} onChange={(e) => setSample({ ...sample, impact: e.target.value })} className={`${field} mt-1`}>
                <option value="">-- None --</option>
                {LEVELS.map((c) => (
                  <option key={c}>{c}</option>
                ))}
              </select>
            </label>
            <label className="block text-xs font-medium text-slate-600">
              Urgency
              <select value={sample.urgency} onChange={(e) => setSample({ ...sample, urgency: e.target.value })} className={`${field} mt-1`}>
                <option value="">-- None --</option>
                {LEVELS.map((c) => (
                  <option key={c}>{c}</option>
                ))}
              </select>
            </label>
            <label className="block text-xs font-medium text-slate-600">
              Short description
              <input value={sample.shortDescription} onChange={(e) => setSample({ ...sample, shortDescription: e.target.value })} className={`${field} mt-1`} />
            </label>
          </div>

          <div className="rounded bg-slate-50 p-3 text-sm">
            {rules.length === 0 ? (
              <p className="text-slate-500">Create a rule to test it.</p>
            ) : outcome.matched.length === 0 ? (
              <p className="text-slate-600">No rule matches this incident, so it is created exactly as filled in.</p>
            ) : (
              <div className="space-y-1.5">
                <p className="font-medium text-slate-800">
                  {outcome.matched.length} rule{outcome.matched.length === 1 ? '' : 's'} would run: {outcome.matched.map((r) => r.name).join(', ')}
                </p>
                <ul className="list-disc space-y-0.5 pl-5 text-slate-700">
                  {outcome.assignmentGroupId != null && (
                    <li>
                      Assigned to group <strong>{outcome.assignmentGroupName ?? outcome.assignmentGroupId}</strong>
                    </li>
                  )}
                  {outcome.assignedTo && (
                    <li>
                      Assigned to <strong>{outcome.assignedTo}</strong>
                    </li>
                  )}
                  {outcome.priority && (
                    <li>
                      Priority set to <strong>{PRIORITIES.find((p) => p.value === outcome.priority)?.label}</strong>
                    </li>
                  )}
                  {outcome.emailGroups.map((g) => (
                    <li key={g.id}>
                      Email the members of <strong>{g.name}</strong>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        </section>
      )}
    </div>
  );
}
