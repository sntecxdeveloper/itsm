import { useState } from 'react';
import { getGroups } from '../../api/groupApi';
import { loadCategories } from '../../utils/categoryStore';
import { masterToBrowser } from '../../utils/setupSync';
import { readWorkbook } from '../../utils/xlsxRead';
import { exportReferenceWorkbook } from '../utils/exportReference';
import { applyImport, parseReference, type ImportPlan, type ImportResult } from '../utils/importReference';

const btn = 'rounded border border-slate-300 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50';
const primary = 'rounded bg-primary-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-primary-700 disabled:opacity-50';

const count = (plan: ImportPlan) => ({
  subcategories: plan.categories.reduce((n, c) => n + c.subcategories.length, 0),
  items: plan.categories.reduce((n, c) => n + c.subcategories.reduce((m, s) => m + s.items.length, 0), 0),
});

/** Setup → Categories → Import from Excel: choose the workbook, see what is in it, then save it to the database. */
export default function ImportReferenceDialog({ onClose, onImported }: { onClose: () => void; onImported: () => void }) {
  const [fileName, setFileName] = useState('');
  const [plan, setPlan] = useState<ImportPlan | null>(null);
  const [mode, setMode] = useState<'replace' | 'add'>('replace');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<ImportResult | null>(null);

  const choose = async (file: File | undefined) => {
    setPlan(null);
    setResult(null);
    setError(null);
    if (!file) return;
    setFileName(file.name);
    setBusy(true);
    try {
      const sheets = await readWorkbook(await file.arrayBuffer());
      const existing = await getGroups().catch(() => []);
      setPlan(parseReference(sheets, existing.map((g) => g.name)));
    } catch (e) {
      setError(e instanceof Error ? e.message : 'The file could not be read.');
    } finally {
      setBusy(false);
    }
  };

  const run = async () => {
    if (!plan) return;
    const saved = loadCategories().length;
    if (plan.hasCategories && mode === 'replace' && saved > 0 && !window.confirm(`This replaces the ${saved} categories saved now with the ones in the file. Continue?`)) return;
    setBusy(true);
    setError(null);
    try {
      const done = await applyImport(plan, mode);
      masterToBrowser(done.master);
      setResult(done);
      onImported();
    } catch (e) {
      setError(e instanceof Error ? `The lists were not saved: ${e.message}` : 'The import failed.');
    } finally {
      setBusy(false);
    }
  };

  const n = plan ? count(plan) : null;
  const nothing = !!plan && !plan.hasCategories && !plan.priority && plan.groups.length === 0 && plan.technicians.length === 0;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" role="dialog" aria-modal="true" aria-label="Import from Excel">
      <div className="max-h-[90vh] w-full max-w-xl space-y-3 overflow-auto rounded-lg bg-white p-5 shadow-xl">
        <div className="flex items-start justify-between gap-3">
          <h2 className="text-sm font-semibold text-slate-900">Import from Excel</h2>
          <button onClick={onClose} className="text-xs text-slate-500 hover:text-slate-800" aria-label="Close">
            Close
          </button>
        </div>
        <p className="text-xs text-slate-600">
          Choose an Excel (.xlsx) file with the sheets <strong>Categories</strong> (Category, Subcategory, Item, Assignment group), <strong>Priority</strong> (Impact, Urgency, Priority),{' '}
          <strong>Assignment groups</strong> (Group, Description) and <strong>Technicians</strong> (Username, Assignment groups). Nothing is built in: what you import is what the forms offer. A sheet that is
          not in the file is left alone.
        </p>
        <button onClick={() => exportReferenceWorkbook().catch((e) => setError(e instanceof Error ? e.message : 'Could not export.'))} className={btn}>
          Download the current lists as a template
        </button>

        <div>
          <input
            type="file"
            accept=".xlsx"
            onChange={(e) => void choose(e.target.files?.[0])}
            aria-label="Excel file"
            className="block w-full text-xs text-slate-700 file:mr-3 file:rounded file:border file:border-slate-300 file:bg-white file:px-3 file:py-1.5 file:text-xs"
          />
          {fileName && <p className="mt-1 text-[11px] text-slate-500">{busy && !plan ? 'Reading…' : fileName}</p>}
        </div>

        {error && <p className="rounded bg-red-50 px-3 py-2 text-xs text-red-700">{error}</p>}

        {plan && !result && (
          <div className="space-y-2">
            {plan.problems.length > 0 && (
              <ul className="list-disc space-y-0.5 rounded bg-red-50 py-2 pl-7 pr-3 text-xs text-red-700">
                {plan.problems.slice(0, 8).map((p) => (
                  <li key={p}>{p}</li>
                ))}
                {plan.problems.length > 8 && <li>…and {plan.problems.length - 8} more.</li>}
              </ul>
            )}
            {plan.warnings.map((w) => (
              <p key={w} className="rounded bg-amber-50 px-3 py-2 text-xs text-amber-800">
                {w}
              </p>
            ))}
            {plan.problems.length === 0 && n && (
              <div className="rounded border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-700">
                <p className="font-medium text-slate-900">The file contains</p>
                <ul className="mt-1 space-y-0.5">
                  {plan.hasCategories && (
                    <li>
                      {plan.categories.length} categories, {n.subcategories} subcategories, {n.items} items
                    </li>
                  )}
                  {plan.priority && <li>{plan.priority.length} priority rows</li>}
                  {plan.groups.length > 0 && <li>{plan.groups.length} assignment groups (new ones are created, existing ones are kept)</li>}
                  {plan.technicians.length > 0 && <li>{plan.technicians.length} technicians to put in their groups (they must already be DEX users)</li>}
                  {nothing && <li>Nothing to import.</li>}
                </ul>
              </div>
            )}
            {plan.problems.length === 0 && plan.hasCategories && (
              <fieldset className="space-y-1 text-xs text-slate-700">
                <legend className="font-medium text-slate-900">Categories</legend>
                <label className="flex items-center gap-2">
                  <input type="radio" name="import-mode" checked={mode === 'replace'} onChange={() => setMode('replace')} />
                  Replace the saved categories with the ones in the file
                </label>
                <label className="flex items-center gap-2">
                  <input type="radio" name="import-mode" checked={mode === 'add'} onChange={() => setMode('add')} />
                  Add the ones in the file to the saved categories
                </label>
              </fieldset>
            )}
          </div>
        )}

        {result && (
          <div className="space-y-1 rounded bg-emerald-50 px-3 py-2 text-xs text-emerald-800">
            <p className="font-medium">Saved to the database.</p>
            <p>
              Now {result.categories} categories, {result.subcategories} subcategories, {result.items} items. {result.groupsCreated} groups created, {result.membersAdded} technicians added to groups.
            </p>
            {result.skipped.length > 0 && (
              <ul className="list-disc pl-5 text-amber-800">
                {result.skipped.slice(0, 8).map((s) => (
                  <li key={s}>{s}</li>
                ))}
                {result.skipped.length > 8 && <li>…and {result.skipped.length - 8} more.</li>}
              </ul>
            )}
          </div>
        )}

        <div className="flex justify-end gap-2 pt-1">
          <button onClick={onClose} className={btn}>
            {result ? 'Done' : 'Cancel'}
          </button>
          {!result && (
            <button onClick={run} disabled={busy || !plan || plan.problems.length > 0 || nothing} className={primary}>
              {busy && plan ? 'Importing…' : 'Import'}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
