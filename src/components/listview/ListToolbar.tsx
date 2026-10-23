import { useMemo, useState, type ReactNode } from 'react';
import Popover from './Popover';
import FilterPanel from './FilterPanel';
import { FieldsPanel, GroupPanel, SortPanel } from './SortFieldsGroupPanels';
import type { SavedView } from '../../hooks/useListView';
import type { ListLayoutControls, SharedView } from '../../hooks/useListLayout';
import ListLayoutPanel from './ListLayoutPanel';
import { activeRules, applyView, describeRule, toCsv, type Field, type QuickFilter, type View } from '../../utils/listView';

interface Props<T> {
  fields: Field<T>[];
  /** Every row, before any filtering (for choices and counts). */
  rows: T[];
  /** The rows left after the view is applied. */
  shown: T[];
  view: View;
  setView: (next: View | ((v: View) => View)) => void;
  saved: SavedView[];
  onSaveView: (name: string) => void;
  onDeleteView: (id: string) => void;
  onApplyView: (id: string) => void;
  onReset: () => void;
  quick?: QuickFilter[];
  searchPlaceholder?: string;
  /** Used for the name of the exported file. */
  exportName: string;
  /** Page-specific buttons (refresh, delete, ...) at the right-hand end. */
  children?: ReactNode;
  /** Server-side defaults and shared views (from useListView's `layout` and `shared`). */
  layout?: ListLayoutControls;
  shared?: SharedView[];
}

const ico = 'h-3.5 w-3.5';

function download(name: string, text: string) {
  const url = URL.createObjectURL(new Blob(['﻿' + text], { type: 'text/csv;charset=utf-8' }));
  const a = document.createElement('a');
  a.href = url;
  a.download = name;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

/**
 * The bar above an advanced list: search, quick filters, a filter builder, multi-level sort, fields to show, grouping, saved
 * views and CSV export, with a pill for every active condition. Everything applies the moment it is chosen.
 */
export default function ListToolbar<T>({
  fields, rows, shown, view, setView, saved, onSaveView, onDeleteView, onApplyView, onReset, quick = [], searchPlaceholder = 'Search', exportName, children, layout, shared = [],
}: Props<T>) {
  const [viewName, setViewName] = useState('');
  const byKey = useMemo(() => new Map(fields.map((f) => [f.key, f])), [fields]);
  const active = activeRules(view, fields, quick).user;
  const groupName = fields.find((f) => f.key === view.groupBy)?.label;

  // how many rows each quick filter would show on its own
  const quickCounts = useMemo(
    () => Object.fromEntries(quick.map((q) => [q.id, applyView(rows, fields, { ...view, rules: [], search: '', quick: q.id }, quick).length])),
    [quick, rows, fields, view],
  );

  const anyFilter = active.length > 0 || view.quick !== null || view.search.trim() !== '';
  const clearFilters = () => setView((v) => ({ ...v, rules: [], quick: null, search: '' }));

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative w-full sm:w-72">
          <svg className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.7} aria-hidden="true">
            <path strokeLinecap="round" strokeLinejoin="round" d="m21 21-5.197-5.197m0 0A7.5 7.5 0 1 0 5.196 5.196a7.5 7.5 0 0 0 10.607 10.607Z" />
          </svg>
          <input
            value={view.search}
            onChange={(e) => setView((v) => ({ ...v, search: e.target.value }))}
            placeholder={searchPlaceholder}
            aria-label="Search"
            className="h-8 w-full rounded-lg border border-line bg-white pl-8 pr-7 text-xs text-slate-800 placeholder:text-slate-400 focus:border-primary-400 focus:outline-none focus:ring-2 focus:ring-primary-500/20"
          />
          {view.search && (
            <button type="button" onClick={() => setView((v) => ({ ...v, search: '' }))} aria-label="Clear search" className="absolute right-1.5 top-1/2 -translate-y-1/2 px-1 text-slate-400 hover:text-slate-900">
              ✕
            </button>
          )}
        </div>

        <Popover title="Filter" width={460} label={<><svg className={ico} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} aria-hidden="true"><path strokeLinecap="round" strokeLinejoin="round" d="M12 3c2.755 0 5.455.232 8.083.678.533.09.917.556.917 1.096v1.044a2.25 2.25 0 0 1-.659 1.591l-5.432 5.432a2.25 2.25 0 0 0-.659 1.591v2.927a2.25 2.25 0 0 1-1.244 2.013L9.75 21v-6.568a2.25 2.25 0 0 0-.659-1.591L3.659 7.409A2.25 2.25 0 0 1 3 5.818V4.774c0-.54.384-1.006.917-1.096A48.32 48.32 0 0 1 12 3Z" /></svg>Filter</>} badge={active.length || undefined}>
          {() => <FilterPanel fields={fields} rows={rows} view={view} onChange={setView} />}
        </Popover>

        <Popover title="Sort" width={420} label={<><span aria-hidden="true">⇅</span>Sort</>} badge={view.sorts.length || undefined}>
          {() => <SortPanel fields={fields} view={view} onChange={setView} />}
        </Popover>

        <Popover title="Fields" width={340} label={<><svg className={ico} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} aria-hidden="true"><path strokeLinecap="round" strokeLinejoin="round" d="M9 4.5v15m6-15v15M4.5 9h15M4.5 15h15M5.25 4.5h13.5A.75.75 0 0 1 19.5 5.25v13.5a.75.75 0 0 1-.75.75H5.25a.75.75 0 0 1-.75-.75V5.25a.75.75 0 0 1 .75-.75Z" /></svg>Fields</>} badge={`${view.columns.length}/${fields.length}`}>
          {() => <FieldsPanel fields={fields} view={view} onChange={setView} reset={() => setView((v) => ({ ...v, columns: fields.filter((f) => f.fixed || f.initial).map((f) => f.key) }))} />}
        </Popover>

        {fields.some((f) => f.groupable) && (
          <Popover title="Group by" width={260} label={<><span aria-hidden="true">☰</span>{groupName ? `Group: ${groupName}` : 'Group'}</>} badge={groupName ? '✓' : undefined}>
            {() => <GroupPanel fields={fields} view={view} onChange={setView} />}
          </Popover>
        )}

        <Popover title="Saved views" width={320} label={<><span aria-hidden="true">★</span>Views</>} badge={saved.length + shared.length || undefined}>
          {(close) => (
            <div className="space-y-2">
              <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">Saved views</p>
              {saved.length === 0 && <p className="rounded-md bg-slate-50 px-2.5 py-3 text-slate-500">Save the filters, sort, fields and grouping you have now, and come back to them in one click.</p>}
              <ul>
                {saved.map((s) => (
                  <li key={s.id} className="flex items-center gap-1 rounded hover:bg-slate-50">
                    <button type="button" onClick={() => { onApplyView(s.id); close(); }} className="min-w-0 flex-1 truncate px-2 py-1.5 text-left text-slate-800">
                      {s.name}
                    </button>
                    <button type="button" onClick={() => onDeleteView(s.id)} aria-label={`Delete view ${s.name}`} className="px-2 text-slate-400 hover:text-red-600">
                      ✕
                    </button>
                  </li>
                ))}
              </ul>
              <form
                className="flex items-center gap-1.5 border-t border-slate-200 pt-2"
                onSubmit={(e) => {
                  e.preventDefault();
                  onSaveView(viewName);
                  setViewName('');
                }}
              >
                <input value={viewName} onChange={(e) => setViewName(e.target.value)} placeholder="Name this view" maxLength={40} aria-label="View name" className="h-8 flex-1 rounded-md border border-slate-300 px-2 text-xs focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500" />
                <button type="submit" disabled={!viewName.trim()} className="h-8 rounded-md bg-slate-800 px-3 text-xs font-semibold text-white hover:bg-slate-900 disabled:opacity-40">
                  Save
                </button>
              </form>
              <button type="button" onClick={() => { onReset(); close(); }} className="w-full rounded-md px-2 py-1.5 text-left text-slate-500 hover:bg-slate-50 hover:text-slate-900">
                Reset to the default view
              </button>
              {layout && <ListLayoutPanel layout={layout} shared={shared} saved={saved} view={view} onApply={onApplyView} close={close} />}
            </div>
          )}
        </Popover>

        <div className="ml-auto flex items-center gap-2">
          <span className="font-mono text-[11px] text-slate-500" aria-live="polite">
            {shown.length === rows.length ? `${rows.length}` : `${shown.length} of ${rows.length}`}
          </span>
          <button
            type="button"
            onClick={() => download(`${exportName}.csv`, toCsv(shown, fields, view.columns))}
            disabled={shown.length === 0}
            title="Download what you see as a spreadsheet (CSV)"
            className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-line bg-white px-2.5 text-xs font-medium text-slate-600 hover:border-line-strong hover:text-slate-900 disabled:opacity-40"
          >
            <svg className={ico} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} aria-hidden="true"><path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 0 0 5.25 21h13.5A2.25 2.25 0 0 0 21 18.75V16.5M16.5 12 12 16.5m0 0L7.5 12m4.5 4.5V3" /></svg>
            CSV
          </button>
          {children}
        </div>
      </div>

      {(quick.length > 0 || active.length > 0) && (
        <div className="flex flex-wrap items-center gap-1.5">
          {quick.map((q) => {
            const on = view.quick === q.id;
            return (
              <button
                key={q.id}
                type="button"
                onClick={() => setView((v) => ({ ...v, quick: on ? null : q.id }))}
                aria-pressed={on}
                className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium ring-1 ring-inset transition-colors ${
                  on ? 'bg-primary-600 text-white ring-primary-600' : 'bg-white text-slate-600 ring-slate-200 hover:bg-slate-50'
                }`}
              >
                {q.label}
                <span className={`font-mono text-[10px] ${on ? 'text-white/80' : 'text-slate-400'}`}>{quickCounts[q.id]}</span>
              </button>
            );
          })}
          {active.map((r) => {
            const f = byKey.get(r.field);
            if (!f) return null;
            return (
              <span key={r.id} className="inline-flex max-w-full items-center gap-1 rounded-full bg-primary-50 px-2.5 py-1 text-xs text-primary-800 ring-1 ring-inset ring-primary-200">
                <span className="truncate">{describeRule(r, f, rows)}</span>
                <button type="button" onClick={() => setView((v) => ({ ...v, rules: v.rules.filter((x) => x.id !== r.id) }))} aria-label={`Remove filter ${f.label}`} className="px-0.5 text-primary-500 hover:text-primary-900">
                  ✕
                </button>
              </span>
            );
          })}
          {anyFilter && (
            <button type="button" onClick={clearFilters} className="px-1.5 text-xs font-medium text-slate-500 hover:text-slate-900">
              Clear all
            </button>
          )}
        </div>
      )}
    </div>
  );
}
