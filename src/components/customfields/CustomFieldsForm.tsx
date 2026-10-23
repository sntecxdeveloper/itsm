import type { CustomFieldDef } from '../../api/customFieldApi';

interface Props {
  fields: CustomFieldDef[];
  values: Record<string, unknown>;
  onChange: (key: string, value: unknown) => void;
  disabled?: boolean;
  /** Keys of required fields that are still empty, to mark them. */
  missing?: string[];
}

const inputClass = 'w-full rounded border border-slate-300 bg-white px-2 py-1 text-[12px] focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500 disabled:bg-slate-50';

/** The inputs of a set of custom fields, two columns on wide screens. */
export default function CustomFieldsForm({ fields, values, onChange, disabled = false, missing = [] }: Props) {
  if (fields.length === 0) return null;
  return (
    <div className="grid gap-x-10 gap-y-3 lg:grid-cols-2">
      {fields.map((f) => {
        const id = `cf-${f.key}`;
        const value = values[f.key];
        const wrong = missing.includes(f.key);
        return (
          <div key={f.key} className={f.type === 'TEXTAREA' ? 'lg:col-span-2' : ''}>
            {f.type !== 'CHECKBOX' && (
              <label htmlFor={id} className="mb-0.5 block text-[11px] font-medium text-slate-600">
                {f.required && <span className="mr-0.5 text-red-500">*</span>}
                {f.label}
              </label>
            )}
            {f.type === 'TEXT' && <input id={id} value={(value as string) ?? ''} onChange={(e) => onChange(f.key, e.target.value)} maxLength={500} disabled={disabled} className={inputClass} />}
            {f.type === 'TEXTAREA' && <textarea id={id} value={(value as string) ?? ''} onChange={(e) => onChange(f.key, e.target.value)} maxLength={5000} rows={3} disabled={disabled} className={inputClass} />}
            {f.type === 'NUMBER' && <input id={id} type="number" value={value == null ? '' : String(value)} onChange={(e) => onChange(f.key, e.target.value)} disabled={disabled} className={inputClass} />}
            {f.type === 'DATE' && <input id={id} type="date" value={(value as string) ?? ''} onChange={(e) => onChange(f.key, e.target.value)} disabled={disabled} className={inputClass} />}
            {f.type === 'SELECT' && (
              <select id={id} value={(value as string) ?? ''} onChange={(e) => onChange(f.key, e.target.value)} disabled={disabled} className={inputClass}>
                <option value="">-- None --</option>
                {f.options.map((o) => (
                  <option key={o} value={o}>
                    {o}
                  </option>
                ))}
              </select>
            )}
            {f.type === 'MULTISELECT' && (
              <div id={id} className="flex flex-wrap gap-x-3 gap-y-1 rounded border border-slate-300 bg-white px-2 py-1.5">
                {f.options.map((o) => {
                  const picked = Array.isArray(value) ? (value as string[]) : [];
                  return (
                    <label key={o} className="flex items-center gap-1 text-[12px] text-slate-700">
                      <input
                        type="checkbox"
                        checked={picked.includes(o)}
                        disabled={disabled}
                        onChange={(e) => onChange(f.key, e.target.checked ? [...picked, o] : picked.filter((p) => p !== o))}
                        className="h-3.5 w-3.5 accent-sky-600"
                      />
                      {o}
                    </label>
                  );
                })}
              </div>
            )}
            {f.type === 'CHECKBOX' && (
              <label className="flex items-center gap-2 pt-4 text-[12px] text-slate-700">
                <input id={id} type="checkbox" checked={value === true} disabled={disabled} onChange={(e) => onChange(f.key, e.target.checked)} className="h-4 w-4 accent-sky-600" />
                {f.required && <span className="text-red-500">*</span>}
                {f.label}
              </label>
            )}
            {wrong && <p className="mt-0.5 text-[11px] text-red-600">Required</p>}
            {f.helpText && !wrong && <p className="mt-0.5 text-[11px] text-slate-400">{f.helpText}</p>}
          </div>
        );
      })}
    </div>
  );
}
