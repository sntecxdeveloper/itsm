import type { KbAudience, KbRunStatus, KnowledgeScript, ScriptParameter, ScriptRisk, ScriptStatus } from '../../types/knowledge';

/* ── Status / risk / run badges shared by the KB, device and issue screens ── */

const STATUS_STYLE: Record<ScriptStatus, { label: string; cls: string }> = {
  DRAFT: { label: 'Draft', cls: 'bg-slate-100 text-slate-600 ring-slate-200' },
  PENDING_REVIEW: { label: 'Needs review', cls: 'bg-amber-50 text-amber-700 ring-amber-200' },
  APPROVED: { label: 'Approved', cls: 'bg-emerald-50 text-emerald-700 ring-emerald-200' },
  REJECTED: { label: 'Rejected', cls: 'bg-red-50 text-red-700 ring-red-200' },
  RETIRED: { label: 'Retired', cls: 'bg-slate-50 text-slate-400 ring-slate-200' },
};

const RISK_STYLE: Record<ScriptRisk, string> = {
  LOW: 'bg-emerald-50 text-emerald-700 ring-emerald-200',
  MEDIUM: 'bg-amber-50 text-amber-700 ring-amber-200',
  HIGH: 'bg-red-50 text-red-700 ring-red-200',
};

const RUN_STYLE: Record<KbRunStatus, { label: string; cls: string }> = {
  QUEUED: { label: 'Queued', cls: 'bg-sky-50 text-sky-700 ring-sky-200' },
  VERIFIED: { label: 'Fixed · verified', cls: 'bg-emerald-50 text-emerald-700 ring-emerald-200' },
  FIXED: { label: 'Fixed', cls: 'bg-emerald-50 text-emerald-700 ring-emerald-200' },
  NOT_NEEDED: { label: 'Nothing to fix', cls: 'bg-slate-100 text-slate-600 ring-slate-200' },
  ROLLED_BACK: { label: 'Rolled back', cls: 'bg-amber-50 text-amber-700 ring-amber-200' },
  VERIFY_FAILED: { label: 'Verify failed', cls: 'bg-red-50 text-red-700 ring-red-200' },
  FAILED: { label: 'Failed', cls: 'bg-red-50 text-red-700 ring-red-200' },
  DECLINED: { label: 'Declined by user', cls: 'bg-slate-100 text-slate-600 ring-slate-200' },
  CANCELLED: { label: 'Cancelled', cls: 'bg-slate-100 text-slate-600 ring-slate-200' },
  EXPIRED: { label: 'Expired (device offline)', cls: 'bg-slate-100 text-slate-600 ring-slate-200' },
};

const pill = 'inline-flex items-center whitespace-nowrap rounded-full px-2 py-0.5 text-[11px] font-medium ring-1 ring-inset';

export function ScriptStatusBadge({ status }: { status?: ScriptStatus | null }) {
  const s = (status && STATUS_STYLE[status]) || STATUS_STYLE.DRAFT;
  return <span className={`${pill} ${s.cls}`}>{s.label}</span>;
}

export function RiskBadge({ risk }: { risk?: ScriptRisk | null }) {
  const r: ScriptRisk = risk && risk in RISK_STYLE ? risk : 'MEDIUM';
  return <span className={`${pill} ${RISK_STYLE[r]}`}>{r.charAt(0) + r.slice(1).toLowerCase()} risk</span>;
}

/** Who may use it: people at a device ("Users") or technicians only. */
export function AudienceBadge({ audience }: { audience?: KbAudience | null }) {
  return audience === 'USER' ? (
    <span className={`${pill} bg-sky-50 text-sky-700 ring-sky-200`}>Everyone</span>
  ) : (
    <span className={`${pill} bg-slate-100 text-slate-600 ring-slate-200`}>Technicians only</span>
  );
}

export function AdminBadge() {
  return <span className={`${pill} bg-violet-50 text-violet-700 ring-violet-200`}>Admin</span>;
}

export function RunStatusBadge({ status }: { status?: KbRunStatus | null }) {
  const s = (status && RUN_STYLE[status]) || RUN_STYLE.FAILED;
  return <span className={`${pill} ${s.cls}`}>{s.label}</span>;
}

/** "CLEAR-USER-TEMP v2" in a monospace chip. */
export function ScriptKeyChip({ script }: { script: Pick<KnowledgeScript, 'scriptKey' | 'version'> }) {
  return (
    <span className="whitespace-nowrap font-mono text-[11px] text-slate-500">
      {script.scriptKey} <span className="text-slate-400">v{script.version}</span>
    </span>
  );
}

const inputCls =
  'w-full rounded-lg border border-line bg-canvas px-3 py-2 text-[13px] text-slate-800 placeholder:text-slate-400 focus:border-primary-400/60 focus:outline-none focus:ring-2 focus:ring-primary-500/20';

/** Inputs for a script's parameters when running it. */
export function ScriptParamsInputs({
  params,
  values,
  onChange,
}: {
  params: ScriptParameter[];
  values: Record<string, string>;
  onChange: (next: Record<string, string>) => void;
}) {
  if (params.length === 0) return null;
  const set = (name: string, v: string) => onChange({ ...values, [name]: v });
  return (
    <div className="space-y-3">
      {params.map((p) => {
        const hint =
          p.type === 'int' && (p.min != null || p.max != null)
            ? `${p.min ?? ''}–${p.max ?? ''}`
            : p.type === 'string' && p.required
              ? 'required'
              : '';
        return (
          <div key={p.name}>
            <label className="mb-1 block text-[12px] font-medium text-slate-700">
              {p.label || p.name}
              {hint && <span className="ml-1.5 font-normal text-slate-400">({hint})</span>}
            </label>
            {p.type === 'bool' ? (
              <select value={values[p.name] ?? 'false'} onChange={(e) => set(p.name, e.target.value)} className={inputCls}>
                <option value="true">Yes</option>
                <option value="false">No</option>
              </select>
            ) : p.type === 'choice' ? (
              <select value={values[p.name] ?? ''} onChange={(e) => set(p.name, e.target.value)} className={inputCls}>
                <option value="">Choose…</option>
                {p.options?.map((o) => (
                  <option key={o} value={o}>
                    {o}
                  </option>
                ))}
              </select>
            ) : (
              <input
                type={p.type === 'int' ? 'number' : 'text'}
                value={values[p.name] ?? ''}
                onChange={(e) => set(p.name, e.target.value)}
                className={inputCls}
                spellCheck={false}
              />
            )}
          </div>
        );
      })}
      <p className="text-[11px] text-slate-500">Values are passed to the script as parameters, never pasted into its code.</p>
    </div>
  );
}
