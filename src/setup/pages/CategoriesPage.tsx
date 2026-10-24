import { useState } from 'react';
import { Link } from 'react-router-dom';
import { loadCategories, type Category } from '../../utils/categoryStore';
import { loadCategoryGroups, subcategoryKey } from '../../utils/categoryGroupStore';
import { getIssues } from '../../utils/issueStore';
import { exportReferenceWorkbook } from '../utils/exportReference';
import ImportReferenceDialog from '../components/ImportReferenceDialog';

const btn = 'rounded border border-slate-300 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50';

/**
 * Setup → Category & Subcategory: the lists the incident forms use. They are loaded from an Excel file (Import from Excel) and kept in
 * the database; this page shows them. Nothing is typed in here.
 */
export default function CategoriesPage() {
  const [list, setList] = useState<Category[]>(loadCategories);
  const [openName, setOpenName] = useState<string | null>(null);
  const [openSub, setOpenSub] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [groupMap, setGroupMap] = useState(loadCategoryGroups);
  const [importing, setImporting] = useState(false);
  const [exporting, setExporting] = useState(false);

  const current = list.find((x) => x.name === openName);

  const exportExcel = async () => {
    setExporting(true);
    setNotice(null);
    try {
      await exportReferenceWorkbook();
    } catch (e) {
      setNotice(e instanceof Error ? `Could not export: ${e.message}` : 'Could not export the lists.');
    } finally {
      setExporting(false);
    }
  };

  const imported = () => {
    // The import saved the lists to the database and copied them into this browser.
    setList(loadCategories());
    setGroupMap(loadCategoryGroups());
    setOpenName(null);
    setOpenSub(null);
    setNotice(null);
  };

  const total = list.reduce((n, x) => n + x.subcategories.length, 0);

  return (
    <div className="space-y-4">
      {importing && <ImportReferenceDialog onClose={() => setImporting(false)} onImported={imported} />}
      {/* Breadcrumb */}
      <div className="flex flex-wrap items-center gap-2 text-xs">
        <Link to="/setup" className="text-primary-700 hover:underline">
          Setup
        </Link>
        <span className="text-slate-300">›</span>
        {current ? (
          <>
            <button
              onClick={() => {
                setOpenName(null);
                setOpenSub(null);
              }}
              className="text-primary-700 hover:underline"
            >
              Category &amp; Subcategory
            </button>
            <span className="text-slate-300">›</span>
            <span className="font-medium text-slate-800">{current.name}</span>
          </>
        ) : (
          <span className="font-medium text-slate-800">Category &amp; Subcategory</span>
        )}
      </div>
      {notice && <p className="rounded bg-amber-50 px-3 py-1.5 text-xs text-amber-700">{notice}</p>}

      {!current ? (
        /* Step 1: the categories */
        <div className="space-y-4">
          <div className="flex flex-wrap items-center gap-3">
            <h1 className="text-sm font-semibold text-slate-900">Categories</h1>
            <span className="text-xs text-slate-500">
              {list.length} categories, {total} subcategories. Click a category to see its subcategories.
            </span>
            <button onClick={exportExcel} disabled={exporting} className={`${btn} ml-auto`}>
              {exporting ? 'Preparing…' : 'Export to Excel'}
            </button>
            <button onClick={() => setImporting(true)} className={btn}>
              Import from Excel
            </button>
          </div>

          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            {list.map((x) => (
              <button
                key={x.name}
                onClick={() => setOpenName(x.name)}
                className="group flex items-center justify-between rounded-lg border border-slate-200 bg-white px-4 py-3 text-left transition-colors hover:border-primary-400 hover:bg-primary-50/40"
              >
                <span className="min-w-0">
                  <span className="block truncate text-sm font-medium text-slate-900">{x.name}</span>
                  <span className="mt-0.5 block text-[11px] text-slate-500">
                    {x.subcategories.length} subcategories{groupMap[x.name] ? ` · ${groupMap[x.name]}` : ''}
                  </span>
                </span>
                <span className="ml-2 text-slate-300 transition-colors group-hover:text-primary-500" aria-hidden>
                  ›
                </span>
              </button>
            ))}
            {list.length === 0 && (
              <p className="col-span-full py-10 text-center text-xs text-slate-500">
                No categories yet. Use <strong>Import from Excel</strong> to load them from your file.
              </p>
            )}
          </div>
        </div>
      ) : (
        /* Step 2: the subcategories of the clicked category */
        <div className="space-y-4">
          <div className="flex flex-wrap items-center gap-3">
            <button onClick={() => setOpenName(null)} className={btn}>
              ← Categories
            </button>
            <h1 className="text-sm font-semibold text-slate-900">{current.name}</h1>
            <span className="text-xs text-slate-500">{current.subcategories.length} subcategories</span>
            <span className="text-xs text-slate-500">Assignment group: {groupMap[current.name] || 'none'}</span>
          </div>

          <ul className="grid items-start gap-2 sm:grid-cols-2 xl:grid-cols-4">
            {current.subcategories.map((s) => {
              const items = getIssues(s);
              const group = groupMap[subcategoryKey(current.name, s)];
              return (
                <li key={s} className="rounded-lg border border-slate-200 bg-white text-sm text-slate-800">
                  <button
                    onClick={() => setOpenSub(openSub === s ? null : s)}
                    aria-expanded={openSub === s}
                    className="flex w-full items-center justify-between gap-2 px-4 py-2.5 text-left"
                  >
                    <span className="truncate">{s}</span>
                    <span className="shrink-0 text-[11px] text-slate-400">
                      {items.length} items {openSub === s ? '▴' : '▾'}
                    </span>
                  </button>
                  {openSub === s && (
                    <div className="space-y-2 border-t border-slate-100 px-4 py-3">
                      <p className="text-[11px] text-slate-500">Assignment group: {group || `same as ${current.name}`}</p>
                      <ul className="space-y-1">
                        {items.map((i) => (
                          <li key={i} className="truncate rounded bg-slate-50 px-2 py-1 text-xs">
                            {i}
                          </li>
                        ))}
                        {items.length === 0 && <li className="text-[11px] text-slate-400">No items.</li>}
                      </ul>
                    </div>
                  )}
                </li>
              );
            })}
            {current.subcategories.length === 0 && <li className="col-span-full py-10 text-center text-xs text-slate-400">No subcategories.</li>}
          </ul>
        </div>
      )}

      <p className="text-[11px] text-slate-400">
        This list feeds the Category, Subcategory and Item fields on the New Incident, incident and New Problem forms. It is loaded from Excel and saved in the database, so everyone sees the same lists. To
        change it, export it, edit the file and import it again.
      </p>
    </div>
  );
}
