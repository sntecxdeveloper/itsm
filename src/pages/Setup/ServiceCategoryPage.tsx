import { useState } from 'react';
import { Link } from 'react-router-dom';
import { loadServices, saveServices } from '../../utils/serviceStore';
import { CATALOG } from '../ITSM/serviceRequestShared';

/** Setup → Service Category: the categories (and their items) users can pick from the Service Catalog. */
export default function ServiceCategoryPage() {
  const [services, setServices] = useState(loadServices);
  const [name, setName] = useState('');

  const update = (next: string[]) => {
    setServices(next);
    saveServices(next);
  };
  const add = () => {
    const n = name.trim();
    if (!n || services.some((s) => s.toLowerCase() === n.toLowerCase())) return;
    update([...services, n]);
    setName('');
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <h1 className="text-sm font-semibold text-slate-900">Service Category</h1>
        <Link to="/tickets/service-requests" className="text-xs text-primary-600 underline">
          View Service Catalog
        </Link>
      </div>

      <section className="rounded-lg border border-slate-200 bg-white p-4">
        <h2 className="text-[13px] font-semibold text-slate-900">Services</h2>
        <p className="mt-0.5 text-[11px] text-slate-500">Options for the Service field on catalog requests.</p>
        <div className="mt-3 flex gap-2">
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && add()}
            placeholder="New service"
            aria-label="New service"
            className="w-64 rounded border border-slate-300 bg-white px-2.5 py-1 text-xs text-slate-800 focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500"
          />
          <button type="button" onClick={add} className="rounded bg-primary-600 px-3 py-1 text-xs font-medium text-white hover:bg-primary-700">
            Add
          </button>
        </div>
        <ul className="mt-3 flex flex-wrap gap-2">
          {services.map((s) => (
            <li key={s} className="flex items-center gap-1.5 rounded-full border border-slate-200 bg-slate-50 px-2.5 py-1 text-[11px] text-slate-700">
              {s}
              <button type="button" aria-label={`Remove ${s}`} onClick={() => update(services.filter((x) => x !== s))} className="text-slate-400 hover:text-red-600">
                ×
              </button>
            </li>
          ))}
          {services.length === 0 && <li className="text-[11px] text-slate-400">No services yet.</li>}
        </ul>
      </section>

      <div className="grid items-start gap-4 md:grid-cols-2 xl:grid-cols-3">
        {CATALOG.map((c) => (
          <section key={c.key} className="rounded-lg border border-slate-200 bg-white">
            <div className="flex items-center gap-3 px-4 py-3">
              <span className="min-w-0 flex-1">
                <span className="block text-[13px] font-semibold text-slate-900">{c.title}</span>
                <span className="mt-0.5 block text-[11px] text-slate-500">{c.description}</span>
              </span>
              <span className="shrink-0 text-[11px] text-slate-400">{c.items.length}</span>
            </div>
            <ul className="divide-y divide-slate-100 border-t border-slate-200">
              {c.items.map((i) => (
                <li key={i.name} className="px-4 py-2.5">
                  <span className="text-[12px] font-medium text-slate-800">{i.name}</span>
                  <span className="mt-0.5 block text-[11px] text-slate-500">{i.description}</span>
                </li>
              ))}
            </ul>
          </section>
        ))}
      </div>
    </div>
  );
}
