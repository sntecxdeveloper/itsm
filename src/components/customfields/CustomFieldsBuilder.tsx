import { useCallback, useEffect, useState } from 'react';
import {
  createField,
  deleteField,
  getAllFields,
  reorderFields,
  updateField,
  type CustomFieldDef,
  type CustomFieldRequest,
  type CustomFieldType,
} from '../../api/customFieldApi';
import { Button } from '../ui/Button';
import { toast } from '../common/Toast';
import { getErrorMessage } from '../../utils/errorHandler';
import CustomFieldsForm from './CustomFieldsForm';
import FieldTriggersPanel from './FieldTriggersPanel';

const TYPES: { value: CustomFieldType; label: string }[] = [
  { value: 'TEXT', label: 'Short text' },
  { value: 'TEXTAREA', label: 'Long text' },
  { value: 'NUMBER', label: 'Number' },
  { value: 'DATE', label: 'Date' },
  { value: 'SELECT', label: 'One choice' },
  { value: 'MULTISELECT', label: 'Several choices' },
  { value: 'CHECKBOX', label: 'Yes / no' },
];

const ROLES = [
  { value: 'ROLE_OPERATOR', label: 'Operators' },
  { value: 'ROLE_ITSM_TECHNICIAN', label: 'ITSM technicians' },
  { value: 'ROLE_VIEWER', label: 'Viewers' },
];

interface Draft {
  id?: number;
  key: string;
  label: string;
  type: CustomFieldType;
  required: boolean;
  options: string;
  categories: string;
  roles: string[];
  helpText: string;
  active: boolean;
}

const EMPTY: Draft = { key: '', label: '', type: 'TEXT', required: false, options: '', categories: '', roles: [], helpText: '', active: true };

const keyFrom = (label: string) =>
  label.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '').replace(/^([0-9])/, 'f_$1').slice(0, 64) || 'field';

const lines = (text: string) => text.split(/[\n,]/).map((s) => s.trim()).filter(Boolean);

/**
 * Ticket fields builder (administrators): add, change and order the extra fields of tickets, with a live preview of the form. A field
 * can apply to some categories only and be visible to some roles only.
 */
export default function CustomFieldsBuilder() {
  const [fields, setFields] = useState<CustomFieldDef[] | null>(null);
  const [draft, setDraft] = useState<Draft | null>(null);
  const [busy, setBusy] = useState(false);
  const [dragId, setDragId] = useState<number | null>(null);
  const [preview, setPreview] = useState<Record<string, unknown>>({});

  const load = useCallback(async () => {
    try {
      setFields(await getAllFields());
    } catch (err) {
      toast(getErrorMessage(err), 'error');
    }
  }, []);
  useEffect(() => {
    void load();
  }, [load]);

  const save = async () => {
    if (!draft) return;
    setBusy(true);
    try {
      const body: CustomFieldRequest = {
        label: draft.label.trim(),
        type: draft.type,
        required: draft.required,
        options: draft.type === 'SELECT' || draft.type === 'MULTISELECT' ? lines(draft.options) : [],
        categories: lines(draft.categories),
        roles: draft.roles,
        helpText: draft.helpText,
        active: draft.active,
      };
      if (draft.id) await updateField(draft.id, body);
      else await createField({ ...body, key: draft.key || keyFrom(draft.label) });
      setDraft(null);
      await load();
      toast('Field saved', 'success');
    } catch (err) {
      toast(getErrorMessage(err), 'error');
    } finally {
      setBusy(false);
    }
  };

  const drop = async (targetId: number) => {
    if (!fields || dragId == null || dragId === targetId) return;
    const ids = fields.map((f) => f.id).filter((id) => id !== dragId);
    ids.splice(ids.indexOf(targetId), 0, dragId);
    setDragId(null);
    try {
      setFields(await reorderFields(ids));
    } catch (err) {
      toast(getErrorMessage(err), 'error');
    }
  };

  const edit = (f: CustomFieldDef) =>
    setDraft({
      id: f.id,
      key: f.key,
      label: f.label,
      type: f.type,
      required: f.required,
      options: f.options.join('\n'),
      categories: f.categories.join(', '),
      roles: f.roles,
      helpText: f.helpText ?? '',
      active: f.active,
    });

  const choice = draft && (draft.type === 'SELECT' || draft.type === 'MULTISELECT');

  return (
    <div className="space-y-4">
    <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_420px]">
      <section className="space-y-3 rounded-xl border border-line bg-panel p-5">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-sm font-semibold text-slate-800">Ticket fields</h3>
            <p className="text-[12px] text-slate-500">Extra fields on tickets. Drag to change their order on the form.</p>
          </div>
          <Button size="sm" onClick={() => setDraft({ ...EMPTY })}>
            Add field
          </Button>
        </div>

        {fields && fields.length === 0 && !draft && <p className="py-6 text-center text-sm text-slate-400">No extra fields yet.</p>}
        <ul className="space-y-1.5">
          {fields?.map((f) => (
            <li
              key={f.id}
              draggable
              onDragStart={() => setDragId(f.id)}
              onDragEnd={() => setDragId(null)}
              onDragOver={(e) => e.preventDefault()}
              onDrop={() => void drop(f.id)}
              className={`flex items-center gap-2 rounded-lg border border-line px-3 py-2 text-[13px] ${f.active ? 'bg-white' : 'bg-slate-50 text-slate-400'} ${dragId === f.id ? 'opacity-40' : ''}`}
            >
              <span className="cursor-grab select-none text-slate-300" aria-hidden="true">⠿</span>
              <span className="min-w-0 flex-1">
                <span className="font-medium text-slate-800">{f.label}</span>
                {f.required && <span className="ml-1 text-red-500">*</span>}
                <span className="ml-2 text-[11px] text-slate-400">
                  {TYPES.find((t) => t.value === f.type)?.label}
                  {f.categories.length > 0 ? ` · ${f.categories.join(', ')}` : ''}
                  {f.roles.length > 0 ? ` · only ${f.roles.map((r) => ROLES.find((x) => x.value === r)?.label ?? r).join(', ')}` : ''}
                  {!f.active ? ' · switched off' : ''}
                </span>
              </span>
              <button type="button" onClick={() => edit(f)} className="text-[12px] text-primary-600 hover:text-primary-700">
                Edit
              </button>
              <button
                type="button"
                onClick={() => void deleteField(f.id).then(load).catch((err) => toast(getErrorMessage(err), 'error'))}
                className="text-[12px] text-red-600 hover:text-red-700"
              >
                Remove
              </button>
            </li>
          ))}
        </ul>

        {draft && (
          <div className="space-y-3 rounded-lg border border-primary-200 bg-primary-50/30 p-4">
            <h4 className="text-[13px] font-semibold text-slate-800">{draft.id ? 'Change field' : 'New field'}</h4>
            <div className="grid gap-3 sm:grid-cols-2">
              <label className="text-[12px] text-slate-600">
                Name
                <input value={draft.label} onChange={(e) => setDraft({ ...draft, label: e.target.value })} maxLength={100} className="mt-0.5 block h-8 w-full rounded border border-slate-300 px-2 text-[13px]" />
              </label>
              <label className="text-[12px] text-slate-600">
                Kind
                <select value={draft.type} onChange={(e) => setDraft({ ...draft, type: e.target.value as CustomFieldType })} className="mt-0.5 block h-8 w-full rounded border border-slate-300 bg-white px-2 text-[13px]">
                  {TYPES.map((t) => (
                    <option key={t.value} value={t.value}>
                      {t.label}
                    </option>
                  ))}
                </select>
              </label>
              {!draft.id && (
                <label className="text-[12px] text-slate-600">
                  Key (cannot change later)
                  <input value={draft.key} placeholder={keyFrom(draft.label)} onChange={(e) => setDraft({ ...draft, key: e.target.value })} maxLength={64} className="mt-0.5 block h-8 w-full rounded border border-slate-300 px-2 font-mono text-[12px]" />
                </label>
              )}
              <label className="text-[12px] text-slate-600">
                Only for categories (comma separated, empty = all)
                <input value={draft.categories} onChange={(e) => setDraft({ ...draft, categories: e.target.value })} className="mt-0.5 block h-8 w-full rounded border border-slate-300 px-2 text-[13px]" />
              </label>
              {choice && (
                <label className="text-[12px] text-slate-600 sm:col-span-2">
                  Choices (one per line)
                  <textarea value={draft.options} onChange={(e) => setDraft({ ...draft, options: e.target.value })} rows={3} className="mt-0.5 block w-full rounded border border-slate-300 px-2 py-1 text-[13px]" />
                </label>
              )}
              <label className="text-[12px] text-slate-600 sm:col-span-2">
                Help text
                <input value={draft.helpText} onChange={(e) => setDraft({ ...draft, helpText: e.target.value })} maxLength={300} className="mt-0.5 block h-8 w-full rounded border border-slate-300 px-2 text-[13px]" />
              </label>
            </div>
            <div className="flex flex-wrap items-center gap-4 text-[12px] text-slate-700">
              <label className="flex items-center gap-1.5">
                <input type="checkbox" checked={draft.required} onChange={(e) => setDraft({ ...draft, required: e.target.checked })} className="h-3.5 w-3.5 accent-sky-600" />
                Required
              </label>
              <label className="flex items-center gap-1.5">
                <input type="checkbox" checked={draft.active} onChange={(e) => setDraft({ ...draft, active: e.target.checked })} className="h-3.5 w-3.5 accent-sky-600" />
                Switched on
              </label>
              <span className="text-slate-500">Visible to:</span>
              {ROLES.map((r) => (
                <label key={r.value} className="flex items-center gap-1.5">
                  <input
                    type="checkbox"
                    checked={draft.roles.includes(r.value)}
                    onChange={(e) => setDraft({ ...draft, roles: e.target.checked ? [...draft.roles, r.value] : draft.roles.filter((x) => x !== r.value) })}
                    className="h-3.5 w-3.5 accent-sky-600"
                  />
                  {r.label}
                </label>
              ))}
              <span className="text-[11px] text-slate-400">(none ticked = everyone; administrators always see it)</span>
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="secondary" size="sm" onClick={() => setDraft(null)}>
                Cancel
              </Button>
              <Button size="sm" disabled={busy || !draft.label.trim()} onClick={() => void save()}>
                {busy ? 'Saving…' : 'Save field'}
              </Button>
            </div>
          </div>
        )}
      </section>

      <aside className="rounded-xl border border-line bg-panel p-5" aria-label="Preview of the ticket form">
        <p className="mb-3 text-[11px] font-semibold uppercase tracking-wide text-slate-500">Preview: "More details" on a ticket</p>
        {fields && fields.filter((f) => f.active).length === 0 ? (
          <p className="text-[12px] text-slate-400">Nothing to show yet.</p>
        ) : (
          <CustomFieldsForm fields={(fields ?? []).filter((f) => f.active)} values={preview} onChange={(k, v) => setPreview((p) => ({ ...p, [k]: v }))} />
        )}
      </aside>
    </div>
    <FieldTriggersPanel fields={(fields ?? []).filter((f) => f.active)} />
    </div>
  );
}
