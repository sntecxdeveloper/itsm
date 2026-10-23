import { useEffect, useMemo, useState } from 'react';
import { getRuleFields, previewRule } from '../../api/groupApi';
import { OPERATOR_LABEL } from './groupMeta';
import { ruleIsComplete } from './ruleUtils';
import type { GroupRule, RuleCondition, RuleFieldInfo, RulePreview } from '../../types/group';

const control =
  'h-9 rounded-lg border border-line bg-panel px-2.5 text-[13px] text-slate-800 transition-all hover:border-line-strong focus:border-primary-400/60 focus:outline-none focus:ring-2 focus:ring-primary-500/20';

interface Props {
  value: GroupRule;
  onChange: (rule: GroupRule) => void;
}

/**
 * Builds a membership rule: "match ALL / ANY of these conditions". The fields and operators come from the server, so
 * what is offered always matches what the server accepts. A live count shows who would be in the group before saving.
 */
export default function RuleBuilder({ value, onChange }: Props) {
  const [fields, setFields] = useState<RuleFieldInfo[]>([]);
  const [loadError, setLoadError] = useState(false);
  const [preview, setPreview] = useState<RulePreview | null>(null);
  const [previewError, setPreviewError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoadError(false);
    getRuleFields()
      .then((f) => !cancelled && setFields(f))
      .catch(() => !cancelled && setLoadError(true));
    return () => {
      cancelled = true;
    };
  }, []);

  const byKey = useMemo(() => new Map(fields.map((f) => [f.key, f])), [fields]);
  const complete = useMemo(() => ruleIsComplete(value, fields), [value, fields]);

  // Live preview, a moment after the last change.
  const ruleKey = JSON.stringify(value);
  useEffect(() => {
    if (!complete) {
      setPreview(null);
      setPreviewError(null);
      return;
    }
    let cancelled = false;
    const timer = window.setTimeout(() => {
      previewRule(value)
        .then((p) => {
          if (cancelled) return;
          setPreview(p);
          setPreviewError(null);
        })
        .catch((err) => {
          if (cancelled) return;
          setPreview(null);
          setPreviewError((err as { response?: { data?: { message?: string } } })?.response?.data?.message || 'Could not count matches');
        });
    }, 500);
    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
    // value is captured through ruleKey
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ruleKey, complete]);

  const update = (i: number, patch: Partial<RuleCondition>) =>
    onChange({ ...value, conditions: value.conditions.map((c, idx) => (idx === i ? { ...c, ...patch } : c)) });

  const pickField = (i: number, key: string) => {
    const f = byKey.get(key);
    update(i, { field: key, op: f?.operators[0] ?? '', value: f?.kind === 'ENUM' ? (f.options[0] ?? '') : '' });
  };

  const remove = (i: number) => {
    if (value.conditions.length <= 1) return;
    onChange({ ...value, conditions: value.conditions.filter((_, idx) => idx !== i) });
  };

  const add = () => onChange({ ...value, conditions: [...value.conditions, { field: '', op: '', value: '' }] });

  if (loadError) {
    return <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">Could not load the rule fields. Try again in a moment.</p>;
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2 text-[13px] text-slate-700">
        <span>Include when</span>
        <select
          value={value.match}
          onChange={(e) => onChange({ ...value, match: e.target.value as 'ALL' | 'ANY' })}
          className={control}
          aria-label="Match all or any"
        >
          <option value="ALL">all</option>
          <option value="ANY">any</option>
        </select>
        <span>of these are true:</span>
      </div>

      <div className="space-y-2">
        {value.conditions.map((c, i) => {
          const f = byKey.get(c.field);
          return (
            <div key={i} className="flex flex-wrap items-center gap-2 rounded-lg border border-line bg-slate-50/60 p-2">
              <select value={c.field} onChange={(e) => pickField(i, e.target.value)} className={`${control} min-w-[160px]`} aria-label="Field">
                <option value="" disabled>
                  Choose a field…
                </option>
                {fields.map((x) => (
                  <option key={x.key} value={x.key}>
                    {x.label}
                  </option>
                ))}
              </select>

              <select
                value={c.op}
                onChange={(e) => update(i, { op: e.target.value })}
                disabled={!f}
                className={`${control} min-w-[140px] disabled:opacity-50`}
                aria-label="Condition"
              >
                {(f?.operators ?? []).map((op) => (
                  <option key={op} value={op}>
                    {OPERATOR_LABEL[op] ?? op}
                  </option>
                ))}
              </select>

              {f?.kind === 'ENUM' ? (
                <select value={c.value} onChange={(e) => update(i, { value: e.target.value })} className={`${control} min-w-[140px]`} aria-label="Value">
                  {f.options.map((o) => (
                    <option key={o} value={o}>
                      {o.replace('ROLE_', '').replace(/_/g, ' ')}
                    </option>
                  ))}
                </select>
              ) : f?.kind === 'BOOLEAN' ? null : (
                <input
                  value={c.value}
                  onChange={(e) => update(i, { value: e.target.value })}
                  disabled={!f}
                  type={f?.kind === 'NUMBER' ? 'number' : 'text'}
                  placeholder={f?.kind === 'NUMBER' ? 'A number' : 'Text to look for'}
                  maxLength={200}
                  className={`${control} min-w-[160px] flex-1 disabled:opacity-50`}
                  aria-label="Value"
                />
              )}

              <button
                type="button"
                onClick={() => remove(i)}
                disabled={value.conditions.length <= 1}
                className="ml-auto flex h-8 w-8 items-center justify-center rounded-lg text-slate-400 hover:bg-red-50 hover:text-red-600 disabled:opacity-30 disabled:hover:bg-transparent disabled:hover:text-slate-400"
                aria-label="Remove condition"
                title="Remove condition"
              >
                <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
          );
        })}
      </div>

      <button type="button" onClick={add} className="text-xs font-medium text-primary-600 hover:text-primary-700">
        + Add a condition
      </button>

      <div className="rounded-lg border border-line bg-panel px-3 py-2.5">
        {!complete ? (
          <p className="text-xs text-slate-500">Fill in every condition to see who would be in this group.</p>
        ) : previewError ? (
          <p className="text-xs text-red-600">{previewError}</p>
        ) : preview === null ? (
          <p className="text-xs text-slate-500">Counting…</p>
        ) : (
          <div>
            <p className="text-[13px] font-medium text-slate-800">
              {preview.total} {preview.total === 1 ? 'match' : 'matches'} right now
            </p>
            {preview.sample.length > 0 && (
              <p className="mt-1 text-[11px] text-slate-500">
                {preview.sample
                  .slice(0, 6)
                  .map((s) => s.name)
                  .join(', ')}
                {preview.total > 6 ? `, and ${preview.total - 6} more` : ''}
              </p>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
