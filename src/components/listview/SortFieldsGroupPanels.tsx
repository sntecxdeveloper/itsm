import { useState } from 'react';
import type { Field, FieldType, SortLevel, View } from '../../utils/listView';

const control =
  'h-8 rounded-md border border-slate-300 bg-white px-2 text-xs text-slate-800 focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500';

/** What ascending and descending mean for each kind of field, in words. */
export const DIRECTION_LABEL: Record<FieldType, [string, string]> = {
  text: ['A → Z', 'Z → A'],
  choice: ['A → Z', 'Z → A'],
  number: ['Low → High', 'High → Low'],
  date: ['Oldest first', 'Newest first'],
  list: ['Fewest first', 'Most first'],
};

interface PanelProps<T> {
  fields: Field<T>[];
  view: View;
  onChange: (next: View) => void;
}

/** Sort by one field, then by another, and so on. */
export function SortPanel<T>({ fields, view, onChange }: PanelProps<T>) {
  const byKey = new Map(fields.map((f) => [f.key, f]));
  const set = (sorts: SortLevel[]) => onChange({ ...view, sorts });
  const used = new Set(view.sorts.map((s) => s.field));
  const free = fields.find((f) => !used.has(f.key));

  return (
    <div className="space-y-2">
      <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">Sort</p>
      {view.sorts.length === 0 && <p className="rounded-md bg-slate-50 px-2.5 py-3 text-slate-500">Not sorted. Add a level to order the list.</p>}
      {view.sorts.map((s, i) => {
        const field = byKey.get(s.field);
        if (!field) return null;
        const [up, down] = DIRECTION_LABEL[field.type];
        return (
          <div key={s.field} className="flex items-center gap-1.5">
            <span className="w-12 text-[10px] font-semibold uppercase text-slate-400">{i === 0 ? 'Sort by' : 'then by'}</span>
            <select
              value={s.field}
              onChange={(e) => set(view.sorts.map((x, j) => (j === i ? { ...x, field: e.target.value } : x)))}
              className={`${control} flex-1`}
              aria-label="Sort field"
            >
              {fields.map((f) => (
                <option key={f.key} value={f.key} disabled={f.key !== s.field && used.has(f.key)}>
                  {f.label}
                </option>
              ))}
            </select>
            <select
              value={s.dir}
              onChange={(e) => set(view.sorts.map((x, j) => (j === i ? { ...x, dir: e.target.value as 'asc' | 'desc' } : x)))}
              className={`${control} w-[116px]`}
              aria-label="Direction"
            >
              <option value="asc">{up}</option>
              <option value="desc">{down}</option>
            </select>
            <button type="button" onClick={() => set(view.sorts.filter((_, j) => j !== i))} aria-label="Remove sort" className="flex h-7 w-7 items-center justify-center rounded text-slate-400 hover:bg-red-50 hover:text-red-600">
              ✕
            </button>
          </div>
        );
      })}
      <div className="flex items-center justify-between pt-1">
        <button
          type="button"
          disabled={!free}
          onClick={() => free && set([...view.sorts, { field: free.key, dir: 'asc' }])}
          className="rounded-md px-2 py-1 font-medium text-primary-700 hover:bg-primary-50 disabled:text-slate-300 disabled:hover:bg-transparent"
        >
          + Add sort
        </button>
        {view.sorts.length > 0 && (
          <button type="button" onClick={() => set([])} className="px-2 py-1 text-slate-500 hover:text-slate-900">
            Clear sort
          </button>
        )}
      </div>
    </div>
  );
}

/** Show, hide and reorder the columns. */
export function FieldsPanel<T>({ fields, view, onChange, reset }: PanelProps<T> & { reset: () => void }) {
  const [query, setQuery] = useState('');
  const byKey = new Map(fields.map((f) => [f.key, f]));
  const shownKeys = view.columns.filter((k) => byKey.has(k));
  const hidden = fields.filter((f) => !shownKeys.includes(f.key));
  const q = query.trim().toLowerCase();
  const match = (f: Field<T>) => !q || f.label.toLowerCase().includes(q);

  const move = (key: string, delta: number) => {
    const list = [...shownKeys];
    const i = list.indexOf(key);
    const j = i + delta;
    if (i < 0 || j < 0 || j >= list.length) return;
    [list[i], list[j]] = [list[j], list[i]];
    onChange({ ...view, columns: list });
  };
  const hide = (key: string) => onChange({ ...view, columns: shownKeys.filter((k) => k !== key) });
  const show = (key: string) => onChange({ ...view, columns: [...shownKeys, key] });

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">Fields ({shownKeys.length} of {fields.length})</p>
        <div className="flex gap-3 text-[11px] font-medium">
          <button type="button" onClick={() => onChange({ ...view, columns: [...shownKeys, ...hidden.map((f) => f.key)] })} className="text-primary-700 hover:underline">
            Show all
          </button>
          <button type="button" onClick={() => onChange({ ...view, columns: fields.filter((f) => f.fixed).map((f) => f.key) })} className="text-slate-500 hover:underline">
            Hide all
          </button>
          <button type="button" onClick={reset} className="text-slate-500 hover:underline">
            Reset
          </button>
        </div>
      </div>
      <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Find a field…" aria-label="Find a field" className={`${control} w-full`} />
      <ul className="max-h-72 overflow-y-auto">
        {shownKeys.map((k) => {
          const f = byKey.get(k)!;
          if (!match(f)) return null;
          const i = shownKeys.indexOf(k);
          return (
            <li key={k} className="flex items-center gap-2 rounded px-1.5 py-1 hover:bg-slate-50">
              <input type="checkbox" checked disabled={f.fixed} onChange={() => hide(k)} aria-label={`Show ${f.label}`} className="h-3.5 w-3.5 accent-sky-600" />
              <span className="flex-1 truncate text-slate-800">{f.label}</span>
              <button type="button" disabled={i === 0} onClick={() => move(k, -1)} aria-label={`Move ${f.label} left`} className="px-1 text-slate-400 hover:text-slate-900 disabled:opacity-30">
                ↑
              </button>
              <button type="button" disabled={i === shownKeys.length - 1} onClick={() => move(k, 1)} aria-label={`Move ${f.label} right`} className="px-1 text-slate-400 hover:text-slate-900 disabled:opacity-30">
                ↓
              </button>
            </li>
          );
        })}
        {hidden.filter(match).length > 0 && <li className="px-1.5 pb-0.5 pt-2 text-[10px] font-semibold uppercase tracking-wide text-slate-400">Hidden</li>}
        {hidden.filter(match).map((f) => (
          <li key={f.key} className="flex items-center gap-2 rounded px-1.5 py-1 hover:bg-slate-50">
            <input type="checkbox" checked={false} onChange={() => show(f.key)} aria-label={`Show ${f.label}`} className="h-3.5 w-3.5 accent-sky-600" />
            <span className="flex-1 truncate text-slate-500">{f.label}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

/** Split the list into sections by one field. */
export function GroupPanel<T>({ fields, view, onChange }: PanelProps<T>) {
  const groupable = fields.filter((f) => f.groupable);
  return (
    <div className="space-y-1">
      <p className="pb-1 text-[11px] font-semibold uppercase tracking-wide text-slate-500">Group by</p>
      {[{ key: '', label: 'No grouping' }, ...groupable].map((f) => (
        <label key={f.key || 'none'} className="flex cursor-pointer items-center gap-2 rounded px-1.5 py-1 hover:bg-slate-50">
          <input
            type="radio"
            name="group-by"
            checked={(view.groupBy ?? '') === f.key}
            onChange={() => onChange({ ...view, groupBy: f.key === '' ? null : f.key })}
            className="h-3.5 w-3.5 accent-sky-600"
          />
          <span className="text-slate-800">{f.label}</span>
        </label>
      ))}
    </div>
  );
}
