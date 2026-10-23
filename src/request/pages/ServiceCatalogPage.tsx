import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { CATALOG } from './serviceRequestShared';

/** Landing page of Service Requests: click a category to show its items, click again to hide them. */
export default function ServiceCatalogPage() {
  const [search, setSearch] = useState('');
  const q = search.trim().toLowerCase();

  const categories = useMemo(
    () =>
      CATALOG.map((c) => ({
        ...c,
        items: q
          ? c.items.filter((i) => `${i.name} ${i.description} ${c.title}`.toLowerCase().includes(q))
          : c.items,
      })).filter((c) => c.items.length > 0),
    [q],
  );

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <h1 className="text-sm font-semibold text-slate-900">Service Catalog</h1>
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search the catalog"
          aria-label="Search the catalog"
          className="w-64 rounded border border-slate-300 bg-white px-2.5 py-1 text-xs text-slate-800 focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500"
        />
      </div>

      <div className="grid items-start gap-4 md:grid-cols-2 xl:grid-cols-3">
        {categories.map((c) => (
          <Link
            key={c.key}
            to={`/tickets/service-requests/catalog/${c.key}`}
            className="flex items-center gap-3 rounded-lg border border-slate-200 bg-white px-4 py-3 hover:bg-slate-50"
          >
            <span className="min-w-0 flex-1">
              <span className="block text-[13px] font-semibold text-slate-900">{c.title}</span>
              <span className="mt-0.5 block text-[11px] text-slate-500">{c.description}</span>
            </span>
            <span className="shrink-0 text-[11px] text-slate-400">{c.items.length}</span>
            <svg className="h-4 w-4 shrink-0 text-slate-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="m9 6 6 6-6 6" />
            </svg>
          </Link>
        ))}
        {categories.length === 0 && <p className="col-span-full py-10 text-center text-xs text-slate-400">Nothing in the catalog matches "{search}".</p>}
      </div>
    </div>
  );
}
