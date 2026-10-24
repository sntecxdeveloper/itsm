import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import RichTextEditor from '../../components/RichTextEditor';
import { useAssignmentGroups } from '../../hooks/useAssignmentGroups';
import { getCategoryMap } from '../../utils/categoryStore';
import { loadFormSettings } from '../../incident/utils/incidentFormStore';
import { LEVELS, derivedPriority } from '../../incident/pages/IncidentFormPage';
import {
  EVENT_LABEL,
  STATES,
  WHEN_OPTIONS,
  type RuleEvent,
  type RuleWhen,
  FACT_KEYS,
  FACT_LABEL,
  NO_FACTS,
  OPERATORS,
  PRIORITIES,
  blankRule,
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
/** The "Set field values" choices: each is one action. */
const FIELD_LABEL: Record<ActionType, string> = {
  ASSIGN_GROUP: 'Assignment group',
  ASSIGN_TO: 'Assigned to',
  SET_PRIORITY: 'Priority',
  SET_STATE: 'Incident state',
  EMAIL_GROUP: 'Email group members',
};
/** Assignment group is set on the When to run tab, so it is not offered here. */
const ACTION_FIELDS: ActionType[] = ['SET_STATE', 'SET_PRIORITY', 'ASSIGN_TO', 'EMAIL_GROUP'];
const EMPTY = '(empty)';
const TABLE = 'Incident [incident]';
const APPLICATION = 'Global';
// The server runs the rules just before an incident is saved; this page edits them and previews the result.

const input =
  'rounded-sm border border-slate-300 bg-white px-2 py-1 text-xs text-slate-800 placeholder:text-slate-400 focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500';
const field =
  'w-full rounded-md border border-slate-300 bg-white px-2.5 py-1.5 text-sm text-slate-800 focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500 disabled:bg-slate-100 disabled:text-slate-500';
const btn = 'rounded border border-slate-300 bg-white px-3 py-1 text-xs font-semibold text-slate-800 hover:bg-slate-100 disabled:opacity-50';
const darkBtn = 'rounded bg-slate-800 px-3 py-1 text-xs font-semibold text-white hover:bg-slate-900 disabled:opacity-50';

const stamp = (iso: string) => (iso ? `${iso.slice(0, 10)} ${iso.slice(11, 19)}` : '');

type ColKey = 'name' | 'active' | 'table' | 'application' | 'order' | 'updated';

const COLUMNS: { key: ColKey; label: string; get: (r: BusinessRule) => string }[] = [
  { key: 'name', label: 'Name', get: (r) => r.name },
  { key: 'active', label: 'Active', get: (r) => String(r.enabled) },
  { key: 'table', label: 'Table', get: () => TABLE },
  { key: 'application', label: 'Application', get: () => APPLICATION },
  { key: 'order', label: 'Order', get: (r) => String(r.order) },
  { key: 'updated', label: 'Updated', get: (r) => stamp(r.updatedAt) },
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
  const [sortKey, setSortKey] = useState<ColKey>('name');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc');
  const [showFilters, setShowFilters] = useState(false);
  const [page, setPage] = useState(0);
  const [checked, setChecked] = useState<Set<string>>(new Set());
  const [testing, setTesting] = useState(false);
  const [tab, setTab] = useState<'when' | 'actions'>('when');
  const [menu, setMenu] = useState<{ x: number; y: number } | null>(null);

  const commit = (next: BusinessRule[]) => {
    setRules(next);
    setNotice(saveRules(next) ? null : 'The browser would not save the change (storage is full or blocked).');
  };

  const open = (rule: BusinessRule, fresh: boolean) => {
    setEditing(JSON.parse(JSON.stringify(rule)) as BusinessRule);
    setIsNew(fresh);
    setTab('when');
    setProblem(null);
    setNotice(null);
  };

  /** Writes the rule being edited. The first Save of a new rule adds it; the form stays open so it can carry on. */
  const persist = (): boolean => {
    if (!editing) return false;
    const p = ruleProblem(editing);
    if (p) {
      setProblem(p);
      return false;
    }
    const stamped = { ...editing, updatedAt: new Date().toISOString() };
    const exists = rules.some((r) => r.id === stamped.id);
    commit(exists ? rules.map((r) => (r.id === stamped.id ? stamped : r)) : [...rules, stamped]);
    setEditing(stamped);
    setIsNew(false);
    setProblem(null);
    setNotice('Record saved.');
    return true;
  };

  const save = () => {
    if (persist()) {
      setEditing(null);
      setNotice(null);
    }
  };

  const reloadForm = () => {
    if (!editing) return;
    const stored = rules.find((r) => r.id === editing.id);
    setEditing(stored ? (JSON.parse(JSON.stringify(stored)) as BusinessRule) : blankRule());
    setProblem(null);
    setNotice(null);
  };

  const exportRule = () => {
    if (!editing) return;
    const url = URL.createObjectURL(new Blob([JSON.stringify(editing, null, 2)], { type: 'application/json' }));
    const a = document.createElement('a');
    a.href = url;
    a.download = `${(editing.name || 'business-rule').replace(/[^w-]+/g, '-')}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const copyText = (text: string) => {
    navigator.clipboard?.writeText(text).catch(() => setNotice('The browser would not copy to the clipboard.'));
  };

  const runMenu = (cmd: 'save' | 'export' | 'url' | 'id' | 'reload') => {
    setMenu(null);
    if (cmd === 'save') persist();
    else if (cmd === 'export') exportRule();
    else if (cmd === 'url') copyText(window.location.href);
    else if (cmd === 'id') editing && copyText(editing.id);
    else reloadForm();
  };

  // the right-click menu closes on any click, scroll or Escape
  useEffect(() => {
    if (!menu) return;
    const close = () => setMenu(null);
    const esc = (e: KeyboardEvent) => e.key === 'Escape' && close();
    window.addEventListener('click', close);
    window.addEventListener('scroll', close, true);
    window.addEventListener('keydown', esc);
    return () => {
      window.removeEventListener('click', close);
      window.removeEventListener('scroll', close, true);
      window.removeEventListener('keydown', esc);
    };
  }, [menu]);

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
    // Once a rule says "Category is X", Subcategory only offers the subcategories of X.
    const pickedCategory = editing?.conditions.find((c) => c.field === 'category' && c.op === 'is' && c.value)?.value ?? '';
    const options: string[] | null =
      fact === 'category'
        ? Object.keys(categories)
        : fact === 'impact' || fact === 'urgency'
          ? LEVELS
          : fact === 'priority'
            ? PRIORITIES.map((p) => p.label)
            : fact === 'channel'
              ? loadFormSettings().channels
              : fact === 'assignmentGroup'
                ? groups.map((g) => g.name)
                : fact === 'subcategory'
                ? (categories[pickedCategory] ?? Array.from(new Set(Object.values(categories).flat())))
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
    const checkRow = 'flex items-center gap-3 text-sm text-slate-700';
    const labelCls = 'text-right text-sm text-slate-700';
    const tabBtn = (k: 'when' | 'actions', label: string) => (
      <button
        key={k}
        onClick={() => setTab(k)}
        role="tab"
        aria-selected={tab === k}
        className={`border-x border-t px-4 py-2 text-sm ${tab === k ? 'border-t-2 border-x-slate-200 border-t-emerald-700 bg-white text-emerald-800' : 'border-slate-200 bg-slate-100 text-slate-700 hover:bg-slate-50'}`}
      >
        {label}
      </button>
    );
    const submitBtn = (
      <button
        onClick={save}
        disabled={isNew}
        title={isNew ? 'Save the record first: right-click and choose Save' : undefined}
        className="rounded-md bg-indigo-600 px-5 py-1.5 text-sm font-semibold text-white hover:bg-indigo-700 disabled:opacity-50"
      >
        {isNew ? 'Submit' : 'Update'}
      </button>
    );
    const addCondition = (match: 'all' | 'any') => patch({ match, conditions: [...editing.conditions, { id: newId(), field: 'category', op: 'is', value: '' }] });
    const outlineBtn = 'rounded border border-indigo-300 bg-white px-3 py-1.5 text-sm font-medium text-indigo-700 hover:bg-indigo-50';
    return (
      <div
        className="-mx-1 min-h-[70vh]"
        onContextMenu={(e) => {
          e.preventDefault();
          setMenu({ x: e.clientX, y: e.clientY });
        }}
      >
        <div className="flex items-center gap-3 border-b border-slate-200 bg-slate-100 px-3 py-2">
          <button onClick={() => setEditing(null)} className="rounded-md border border-indigo-300 bg-white px-3 py-1.5 text-indigo-700 hover:bg-indigo-50" aria-label="Back to business rules">
            ‹
          </button>
          <h1 className="text-sm font-semibold leading-tight text-slate-900">
            Business Rule
            <span className="block">{isNew ? 'New record' : editing.name}</span>
          </h1>
          <div className="ml-auto flex items-center gap-2">
            <button onClick={() => setEditing(null)} className={btn}>
              Cancel
            </button>
            {submitBtn}
          </div>
        </div>

        <div className="space-y-4 p-4">
          {isNew && (
            <p className="rounded border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800">
              Fill in the Name, then <strong>right-click</strong> anywhere on this form and choose <strong>Save</strong>. The record has to be saved before it can be submitted.
            </p>
          )}
          {notice === 'Record saved.' && <p className="rounded border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-800">Record saved.</p>}
          {problem && <p className="rounded border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{problem}</p>}

          <p className="rounded border border-sky-300 bg-sky-100 px-3 py-3 text-sm text-slate-800">
            A business rule runs on the server when an incident is created (New Incident page, email or API). Use business rules to automatically change values in form fields (assign a
            group or technician, set the priority) or email a group when the specified conditions are met.
          </p>

          <div className="grid gap-x-10 gap-y-3 lg:grid-cols-2">
            <div className="grid grid-cols-[110px_minmax(0,28rem)] items-center gap-x-3 gap-y-3">
              <label htmlFor="br-name" className={labelCls}>
                <span className="text-red-600">* </span>Name
              </label>
              <input id="br-name" value={editing.name} onChange={(e) => patch({ name: e.target.value })} className={field} placeholder="Software ticket assignment" autoFocus />
              <label htmlFor="br-table" className={labelCls}>
                Table
              </label>
              <select id="br-table" value={TABLE} onChange={() => undefined} className={field}>
                <option>{TABLE}</option>
              </select>
              <label htmlFor="br-desc" className={labelCls}>
                Description
              </label>
              <input id="br-desc" value={editing.description} onChange={(e) => patch({ description: e.target.value })} className={field} placeholder="What is this rule for?" />
            </div>
            <div className="grid grid-cols-[110px_minmax(0,22rem)] items-center gap-x-3 gap-y-3">
              <label htmlFor="br-app" className={labelCls}>
                Application
              </label>
              <input id="br-app" value={APPLICATION} disabled className={field} />
              <label htmlFor="br-active" className={labelCls}>
                Active
              </label>
              <input id="br-active" type="checkbox" checked={editing.enabled} onChange={(e) => patch({ enabled: e.target.checked })} className="h-4 w-4" />
            </div>
          </div>

          <div role="tablist" className="flex gap-1 pt-4">
            {tabBtn('when', 'When to run')}
            {tabBtn('actions', 'Actions')}
          </div>

          {tab === 'when' && (
            <section className="space-y-4 rounded-b border border-slate-200 bg-white p-4 shadow-sm">
              <p className="rounded border border-sky-300 bg-sky-100 px-3 py-3 text-sm text-slate-800">
                Specify when the business rule should run. Use <strong>Filter Conditions</strong> to specify under which conditions the business rule should run.
              </p>
              <div className="grid gap-x-10 gap-y-3 lg:grid-cols-2">
                <div className="grid grid-cols-[110px_minmax(0,22rem)] items-center gap-x-3 gap-y-3">
                  <label htmlFor="br-when" className={labelCls}>
                    When
                  </label>
                  <select id="br-when" value={editing.when} onChange={(e) => patch({ when: e.target.value as RuleWhen })} className={field}>
                    {WHEN_OPTIONS.map((w) => (
                      <option key={w} value={w}>
                        {w}
                      </option>
                    ))}
                  </select>
                  <label htmlFor="br-order" className={labelCls}>
                    Order
                  </label>
                  <input
                    id="br-order"
                    type="number"
                    value={editing.order}
                    onChange={(e) => patch({ order: Number.isFinite(e.target.valueAsNumber) ? e.target.valueAsNumber : 100 })}
                    className={`${field} text-right`}
                  />
                  <label htmlFor="br-group" className={labelCls}>
                    Assignment group
                  </label>
                  <select
                    id="br-group"
                    value={editing.actions.find((a) => a.type === 'ASSIGN_GROUP')?.value ?? ''}
                    onChange={(e) => {
                      const g = groups.find((x) => String(x.id) === e.target.value);
                      const rest = editing.actions.filter((a) => a.type !== 'ASSIGN_GROUP');
                      patch({ actions: g ? [{ id: newId(), type: 'ASSIGN_GROUP', value: String(g.id), label: g.name }, ...rest] : rest });
                    }}
                    className={field}
                  >
                    <option value="">{groups.length ? '-- None --' : 'No technician groups yet'}</option>
                    {groups.map((g) => (
                      <option key={g.id} value={String(g.id)}>
                        {g.name}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="space-y-3 lg:pl-24">
                  {(Object.keys(EVENT_LABEL) as RuleEvent[]).map((ev) => (
                    <label key={ev} className={checkRow}>
                      <span className="w-16 text-right">{EVENT_LABEL[ev]}</span>
                      <input
                        type="checkbox"
                        checked={editing.events[ev]}
                        onChange={(e) => patch({ events: { ...editing.events, [ev]: e.target.checked } })}
                        className="h-4 w-4"
                        aria-label={EVENT_LABEL[ev]}
                      />
                    </label>
                  ))}
                  <p className="max-w-xs text-xs text-slate-500">
                    Rules run today when an incident is created (Insert). Update, Delete and Query are saved with the rule but not run yet.
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-[110px_1fr] gap-x-3 gap-y-2">
                <span className={`${labelCls} pt-2`}>Filter Conditions</span>
                <div className="space-y-2">
                  <div className="flex flex-wrap gap-2">
                    <button className={outlineBtn} onClick={() => addCondition('all')}>
                      Add Filter Condition
                    </button>
                    <button className={outlineBtn} onClick={() => addCondition('any')}>
                      Add "OR" Clause
                    </button>
                  </div>
                  {editing.conditions.map((c, i) => {
                    const needsValue = OPERATORS.find((o) => o.key === c.op)?.needsValue;
                    const upd = (p: Partial<typeof c>) => patch({ conditions: editing.conditions.map((x) => (x.id === c.id ? { ...x, ...p } : x)) });
                    return (
                      <div key={c.id} className="grid items-center gap-2 sm:grid-cols-[3rem_minmax(0,1fr)_minmax(0,1fr)_minmax(0,1.3fr)_auto]">
                        <span className="text-right text-xs font-semibold uppercase text-slate-500">{i === 0 ? '' : editing.match === 'all' ? 'and' : 'or'}</span>
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
                  {editing.conditions.length === 0 && <p className="text-xs text-amber-600">With no conditions the rule runs for every new incident.</p>}
                  {editing.conditions.length > 1 && (
                    <p className="text-xs text-slate-500">{editing.match === 'all' ? 'Runs when all of these match.' : 'Runs when any one of these matches.'}</p>
                  )}
                </div>
              </div>
            </section>
          )}

          {tab === 'actions' && (
            <section className="space-y-4 rounded-b border border-slate-200 bg-white p-4 shadow-sm">
              <div className="rounded border border-sky-300 bg-sky-100 px-3 py-3 text-sm text-slate-800">
                Specify field values using the <strong>Set field values</strong> choice lists:
                <ul className="mt-1 list-disc space-y-0.5 pl-6">
                  <li>
                    <strong>Field:</strong> what the rule changes on the new incident (incident state, priority, assigned to) or who it emails. The assignment group is set on the When to run tab.
                  </li>
                  <li>
                    <strong>To:</strong> the value, chosen from the options available for that field.
                  </li>
                </ul>
              </div>

              <div className="grid grid-cols-[110px_1fr] gap-x-3 gap-y-2">
                <span className={`${labelCls} pt-2`}>Set field values</span>
                <div className="space-y-2">
                  {editing.actions
                    .filter((a) => a.type !== 'ASSIGN_GROUP')
                    .map((a) => {
                    const upd = (p: Partial<typeof a>) => patch({ actions: editing.actions.map((x) => (x.id === a.id ? { ...x, ...p } : x)) });
                    const isGroup = a.type === 'EMAIL_GROUP';
                    return (
                      <div key={a.id} className="grid items-center gap-2 sm:grid-cols-[minmax(0,1fr)_7rem_minmax(0,1.4fr)_auto]">
                        <select value={a.type} onChange={(e) => upd({ type: e.target.value as ActionType, value: '', label: undefined })} className={field} aria-label="Field">
                          {ACTION_FIELDS.map((t) => (
                            <option key={t} value={t}>
                              {FIELD_LABEL[t]}
                            </option>
                          ))}
                        </select>
                        <select disabled className={field} aria-label="Operator">
                          <option>To</option>
                        </select>
                        {isGroup ? (
                          <select
                            value={a.value}
                            onChange={(e) => upd({ value: e.target.value, label: groups.find((g) => String(g.id) === e.target.value)?.name })}
                            className={field}
                            aria-label="Value"
                          >
                            <option value="">{groups.length ? '-- Choose a group --' : 'No technician groups yet'}</option>
                            {a.value && !groups.some((g) => String(g.id) === a.value) && <option value={a.value}>{a.label ?? `Group ${a.value}`}</option>}
                            {groups.map((g) => (
                              <option key={g.id} value={String(g.id)}>
                                {g.name}
                              </option>
                            ))}
                          </select>
                        ) : a.type === 'SET_STATE' ? (
                          <select value={a.value} onChange={(e) => upd({ value: e.target.value })} className={field} aria-label="Value">
                            <option value="">-- Choose a state --</option>
                            {STATES.map((p) => (
                              <option key={p.value} value={p.value}>
                                {p.label}
                              </option>
                            ))}
                          </select>
                        ) : a.type === 'SET_PRIORITY' ? (
                          <select value={a.value} onChange={(e) => upd({ value: e.target.value })} className={field} aria-label="Value">
                            <option value="">-- Choose a priority --</option>
                            {PRIORITIES.map((p) => (
                              <option key={p.value} value={p.value}>
                                {p.label}
                              </option>
                            ))}
                          </select>
                        ) : (
                          <input value={a.value} onChange={(e) => upd({ value: e.target.value })} className={field} placeholder="Technician username" aria-label="Value" />
                        )}
                        <button className={`${btn} text-red-600`} onClick={() => patch({ actions: editing.actions.filter((x) => x.id !== a.id) })} aria-label="Remove action">
                          ✕
                        </button>
                      </div>
                    );
                  })}
                  <div className="grid items-center gap-2 sm:grid-cols-[minmax(0,1fr)_7rem_minmax(0,1.4fr)_auto]">
                    <select
                      value=""
                      onChange={(e) => e.target.value && patch({ actions: [...editing.actions, { id: newId(), type: e.target.value as ActionType, value: '' }] })}
                      className={field}
                      aria-label="Choose a field to set"
                    >
                      <option value="">-- choose field --</option>
                      {ACTION_FIELDS.map((t) => (
                        <option key={t} value={t}>
                          {FIELD_LABEL[t]}
                        </option>
                      ))}
                    </select>
                    <input disabled placeholder="To" className={field} aria-hidden="true" />
                    <input disabled placeholder="-- value --" className={field} aria-hidden="true" />
                  </div>
                  <p className="text-xs text-slate-500">
                    Assignment actions only fill the group or technician when the person left them empty on the form. “Email group members” sends the “Ticket
                    created” template to every enabled technician and user in that group.
                  </p>
                </div>

                <label htmlFor="br-msg" className={`${labelCls} pt-1`}>
                  Add message
                </label>
                <div className="space-y-2">
                  <input id="br-msg" type="checkbox" checked={editing.addMessage} onChange={(e) => patch({ addMessage: e.target.checked })} className="h-4 w-4" />
                </div>
                {editing.addMessage && (
                  <>
                    <span className={`${labelCls} pt-2`}>Message</span>
                    <div className="max-w-3xl overflow-hidden rounded-md border border-slate-300 bg-white">
                      <RichTextEditor value={editing.message} resetKey={editing.id} onChange={(message) => patch({ message })} />
                      <p className="border-t border-slate-200 px-3 py-1.5 text-xs text-slate-500">Shown at the top of the incident right after it is created.</p>
                    </div>
                  </>
                )}

                <label htmlFor="br-abort" className={`${labelCls} pt-1`}>
                  Abort action
                </label>
                <div>
                  <input id="br-abort" type="checkbox" checked={editing.abort} onChange={(e) => patch({ abort: e.target.checked })} className="h-4 w-4" />
                  {editing.abort && <span className="ml-3 text-xs text-slate-500">The incident is not created when this rule matches.</span>}
                </div>

                <label htmlFor="br-stop" className={`${labelCls} pt-1`}>
                  Stop
                </label>
                <div>
                  <input id="br-stop" type="checkbox" checked={editing.stop} onChange={(e) => patch({ stop: e.target.checked })} className="h-4 w-4" />
                  <span className="ml-3 text-xs text-slate-500">Do not run the rules below this one when it matches.</span>
                </div>
              </div>
            </section>
          )}

          <div>{submitBtn}</div>
        </div>

        {menu && (
          <ul
            role="menu"
            style={{ left: Math.min(menu.x, window.innerWidth - 200), top: Math.min(menu.y, window.innerHeight - 200) }}
            className="fixed z-50 w-48 rounded border border-slate-200 bg-white py-1 text-sm shadow-lg"
            onClick={(e) => e.stopPropagation()}
          >
            {(
              [
                ['save', 'Save'],
                ['export', 'Export (JSON)'],
                ['url', 'Copy URL'],
                ['id', 'Copy rule id'],
                ['reload', 'Reload form'],
              ] as const
            ).map(([cmd, label], i) => (
              <li key={cmd} role="none" className={i === 1 || i === 2 ? 'border-t border-slate-200' : ''}>
                <button role="menuitem" onClick={() => runMenu(cmd)} className="block w-full px-4 py-1.5 text-left text-slate-800 hover:bg-primary-600 hover:text-white">
                  {label}
                </button>
              </li>
            ))}
          </ul>
        )}
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
        <Link to="/setup" className="text-base text-slate-500 hover:text-slate-800" aria-label="Back to Setup" title="Back to Setup">
          ☰
        </Link>
        <button onClick={() => setShowFilters((v) => !v)} className="text-base text-slate-500 hover:text-slate-800" aria-pressed={showFilters} aria-label="Show column filters" title="Column filters">
          ⛛
        </button>
        <h1 className="text-base font-semibold text-slate-900">Business Rules</h1>
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
          <button onClick={() => setTesting((t) => !t)} className="text-base text-slate-500 hover:text-slate-800" aria-pressed={testing} aria-label="Test rules" title="Test rules">
            ∿
          </button>
          <select value="" onChange={(e) => runAction(e.target.value)} className={`${input} w-56 rounded`} aria-label="Actions on selected rows">
            <option value="">Actions on selected rows...</option>
            <option value="edit">Edit</option>
            <option value="activate">Activate</option>
            <option value="deactivate">Deactivate</option>
            <option value="copy">Copy</option>
            <option value="delete">Delete</option>
          </select>
          <button onClick={() => open(blankRule(), true)} className={darkBtn}>
            New
          </button>
        </div>
      </div>

      <div className="px-3 py-2 text-xs">
        <span className="font-medium text-primary-700">All</span>
        <span className="mx-2 text-slate-400">&gt;</span>
        <span className="text-primary-700">Table = incident</span>
        <span className="ml-4 text-slate-400">Rules run lowest Order first, when an incident is created.</span>
        {notice && <span className="ml-4 text-amber-600">{notice}</span>}
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-sm">
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
            <tr className={`border-b border-slate-300 bg-slate-100 ${showFilters ? '' : 'hidden'}`}>
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
            {visible.map((r) => (
              <tr key={r.id} className="border-b border-slate-200 bg-white hover:bg-primary-50/40">
                <td className="px-2.5 py-3.5 align-top">
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
                <td className="whitespace-nowrap px-2.5 py-3.5 align-top">
                  <button onClick={() => open(r, false)} className="font-medium text-primary-700 hover:underline">
                    {r.name}
                  </button>
                </td>
                <td className="px-2.5 py-3.5 align-top text-slate-800">{String(r.enabled)}</td>
                <td className="whitespace-nowrap px-2.5 py-3.5 align-top text-slate-800">{TABLE}</td>
                <td className="px-2.5 py-3.5 align-top text-primary-700">{APPLICATION}</td>
                <td className="px-2.5 py-3.5 align-top text-slate-800">{r.order}</td>
                <td className="whitespace-nowrap px-2.5 py-3.5 align-top text-slate-700">{stamp(r.updatedAt) || EMPTY}</td>
              </tr>
            ))}
            {visible.length === 0 && (
              <tr>
                <td colSpan={COLUMNS.length + 1} className="px-3 py-10 text-center text-slate-400">
                  No records to display
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
        <span className="flex items-center gap-2">
          <input
            type="number"
            min={1}
            max={pages}
            value={page + 1}
            onChange={(e) => setPage(Math.min(pages - 1, Math.max(0, (Number(e.target.value) || 1) - 1)))}
            aria-label="Page number"
            className={`${input} w-14 text-center`}
          />
          to {Math.min((page + 1) * PAGE_SIZE, rows.length)} of {rows.length}
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
