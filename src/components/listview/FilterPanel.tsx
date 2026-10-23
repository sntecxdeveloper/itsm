import { useMemo, useState } from 'react';
import { newRule, operatorInfo, operatorsFor, optionsFor, type ChoiceOption, type Field, type Rule, type View } from '../../utils/listView';

const control =
  'h-8 rounded-md border border-slate-300 bg-white px-2 text-xs text-slate-800 focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500';

interface Props<T> {
  fields: Field<T>[];
  rows: T[];
  view: View;
  onChange: (next: View) => void;
}

/** Choose values from a list, searchable, with headings when the choices come in groups (a tab and its features). */
function ChoiceBox({ options, chosen, onChange }: { options: ChoiceOption[]; chosen: string[]; onChange: (next: string[]) => void }) {
  const [query, setQuery] = useState('');
  const [closed, setClosed] = useState<Set<string>>(new Set());
  const q = query.trim().toLowerCase();
  const visible = q ? options.filter((o) => o.label.toLowerCase().includes(q) || (o.group ?? '').toLowerCase().includes(q)) : options;
  const headings = [...new Set(visible.map((o) => o.group ?? ''))];

  const toggle = (value: string) => onChange(chosen.includes(value) ? chosen.filter((c) => c !== value) : [...chosen, value]);

  return (
    <div className="mt-1.5 rounded-md border border-slate-200 bg-slate-50 p-1.5">
      {options.length > 8 && (
        <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search…" aria-label="Search choices" className={`${control} mb-1 w-full`} />
      )}
      <div className="max-h-44 overflow-y-auto">
        {headings.map((h) => {
          const inGroup = visible.filter((o) => (o.group ?? '') === h);
          const collapsed = !q && h !== '' && closed.has(h);
          const picked = inGroup.filter((o) => chosen.includes(o.value)).length;
          return (
            <div key={h || '_'}>
              {h !== '' && (
                <button
                  type="button"
                  onClick={() => setClosed((prev) => { const n = new Set(prev); if (n.has(h)) n.delete(h); else n.add(h); return n; })}
                  aria-expanded={!collapsed}
                  className="flex w-full items-center justify-between px-1.5 pb-0.5 pt-1.5 text-[10px] font-semibold uppercase tracking-wide text-slate-500 hover:text-slate-800"
                >
                  <span>{h}</span>
                  <span>{picked > 0 ? `${picked} · ` : ''}{collapsed ? '▾' : '▴'}</span>
                </button>
              )}
              {!collapsed &&
                inGroup.map((o) => (
                  <label key={o.value} className="flex cursor-pointer items-center gap-2 rounded px-1.5 py-1 hover:bg-white">
                    <input type="checkbox" checked={chosen.includes(o.value)} onChange={() => toggle(o.value)} className="h-3.5 w-3.5 accent-sky-600" />
                    <span className="min-w-0 flex-1 truncate text-slate-800">{o.label || '(empty)'}</span>
                    {o.count !== undefined && <span className="text-[10px] text-slate-400">{o.count}</span>}
                  </label>
                ))}
            </div>
          );
        })}
        {visible.length === 0 && <p className="px-2 py-2 text-slate-400">Nothing matches.</p>}
      </div>
    </div>
  );
}

/** The filter builder: each row is a field, a condition that fits it, and a value. */
export default function FilterPanel<T>({ fields, rows, view, onChange }: Props<T>) {
  const byKey = useMemo(() => new Map(fields.map((f) => [f.key, f])), [fields]);
  const [openBox, setOpenBox] = useState<string | null>(null);

  const update = (id: string, patch: Partial<Rule>) => onChange({ ...view, rules: view.rules.map((r) => (r.id === id ? { ...r, ...patch } : r)) });
  const remove = (id: string) => onChange({ ...view, rules: view.rules.filter((r) => r.id !== id) });
  const add = () => onChange({ ...view, rules: [...view.rules, newRule(fields[0] as Field<unknown>)] });

  const changeField = (rule: Rule, key: string) => {
    const f = byKey.get(key);
    if (!f) return;
    update(rule.id, { field: key, op: operatorsFor(f.type)[0].op, value: '', value2: undefined, values: undefined });
  };

  const changeOp = (rule: Rule, op: string) => {
    const f = byKey.get(rule.field);
    const was = f ? operatorInfo(f.type, rule.op)?.needs : undefined;
    const now = f ? operatorInfo(f.type, op)?.needs : undefined;
    update(rule.id, { op, ...(was !== now ? { value: '', value2: undefined, values: undefined } : {}) });
  };

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">Filter</p>
        {view.rules.length > 1 && (
          <label className="flex items-center gap-1.5 text-[11px] text-slate-600">
            Match
            <select value={view.match} onChange={(e) => onChange({ ...view, match: e.target.value as 'ALL' | 'ANY' })} className={`${control} h-7`} aria-label="Match all or any">
              <option value="ALL">all</option>
              <option value="ANY">any</option>
            </select>
            of these
          </label>
        )}
      </div>

      {view.rules.length === 0 && <p className="rounded-md bg-slate-50 px-2.5 py-3 text-slate-500">No conditions yet. Add one to narrow the list.</p>}

      {view.rules.map((rule, index) => {
        const field = byKey.get(rule.field);
        if (!field) return null;
        const info = operatorInfo(field.type, rule.op);
        const needs = info?.needs ?? 'none';
        const options = needs === 'many' ? optionsFor(field, rows) : [];
        return (
          <div key={rule.id} className="rounded-lg border border-slate-200 p-2">
            <div className="flex flex-wrap items-center gap-1.5">
              <span className="w-9 text-[10px] font-semibold uppercase text-slate-400">{index === 0 ? 'Where' : view.match === 'ALL' ? 'and' : 'or'}</span>
              <select value={rule.field} onChange={(e) => changeField(rule, e.target.value)} className={`${control} min-w-[110px] flex-1`} aria-label="Field">
                {fields.map((f) => (
                  <option key={f.key} value={f.key}>
                    {f.label}
                  </option>
                ))}
              </select>
              <select value={rule.op} onChange={(e) => changeOp(rule, e.target.value)} className={`${control} min-w-[120px] flex-1`} aria-label="Condition">
                {operatorsFor(field.type).map((o) => (
                  <option key={o.op} value={o.op}>
                    {o.label}
                  </option>
                ))}
              </select>
              <button type="button" onClick={() => remove(rule.id)} aria-label="Remove condition" title="Remove" className="ml-auto flex h-7 w-7 items-center justify-center rounded text-slate-400 hover:bg-red-50 hover:text-red-600">
                ✕
              </button>
            </div>

            {needs === 'one' && (
              <div className="mt-1.5 pl-10">
                <div className="flex items-center gap-1.5">
                  <input
                    value={rule.value}
                    onChange={(e) => update(rule.id, { value: e.target.value })}
                    type={field.type === 'number' || rule.op === 'in_last_days' || rule.op === 'older_than_days' ? 'number' : field.type === 'date' ? 'date' : 'text'}
                    placeholder={field.type === 'text' ? 'Type to match' : undefined}
                    aria-label="Value"
                    className={`${control} w-full`}
                  />
                  {(rule.op === 'in_last_days' || rule.op === 'older_than_days') && <span className="text-slate-500">days</span>}
                </div>
              </div>
            )}
            {needs === 'two' && (
              <div className="mt-1.5 flex items-center gap-1.5 pl-10">
                <input value={rule.value} onChange={(e) => update(rule.id, { value: e.target.value })} type="number" aria-label="From" className={`${control} w-full`} />
                <span className="text-slate-500">and</span>
                <input value={rule.value2 ?? ''} onChange={(e) => update(rule.id, { value2: e.target.value })} type="number" aria-label="To" className={`${control} w-full`} />
              </div>
            )}
            {needs === 'many' && (
              <div className="pl-10">
                <button
                  type="button"
                  onClick={() => setOpenBox(openBox === rule.id ? null : rule.id)}
                  aria-expanded={openBox === rule.id}
                  className={`${control} mt-1.5 flex w-full items-center justify-between text-left`}
                >
                  <span className="truncate">
                    {(rule.values ?? []).length === 0
                      ? 'Choose…'
                      : (rule.values ?? []).map((v) => options.find((o) => o.value === v)?.label ?? v).join(', ')}
                  </span>
                  <span className="ml-2 text-slate-400">{openBox === rule.id ? '▴' : '▾'}</span>
                </button>
                {openBox === rule.id && <ChoiceBox options={options} chosen={rule.values ?? []} onChange={(values) => update(rule.id, { values })} />}
              </div>
            )}
          </div>
        );
      })}

      <div className="flex items-center justify-between pt-1">
        <button type="button" onClick={add} className="rounded-md px-2 py-1 font-medium text-primary-700 hover:bg-primary-50">
          + Add filter
        </button>
        {view.rules.length > 0 && (
          <button type="button" onClick={() => onChange({ ...view, rules: [] })} className="px-2 py-1 text-slate-500 hover:text-slate-900">
            Clear filters
          </button>
        )}
      </div>
    </div>
  );
}
