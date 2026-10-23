import { useEffect, useMemo, useState } from 'react';
import { updateGroupPolicy } from '../../api/groupApi';
import { getApprovedScripts } from '../../api/knowledgeApi';
import { getErrorMessage } from '../../utils/errorHandler';
import { toast } from '../common/Toast';
import { Button } from '../ui/Button';
import type { GroupDetail } from '../../types/group';
import type { KnowledgeScript } from '../../types';

interface Props {
  detail: GroupDetail;
  canEdit: boolean;
  onSaved: (detail: GroupDetail) => void;
}

const field =
  'h-9 rounded-lg border border-line bg-panel px-3 text-[13px] text-slate-800 transition-all hover:border-line-strong focus:border-primary-400/60 focus:outline-none focus:ring-2 focus:ring-primary-500/20 disabled:opacity-60';

function Card({ title, blurb, children }: { title: string; blurb: string; children: React.ReactNode }) {
  return (
    <section className="rounded-xl border border-line bg-panel p-5">
      <h3 className="text-sm font-semibold text-slate-800">{title}</h3>
      <p className="mt-0.5 text-xs text-slate-500">{blurb}</p>
      <div className="mt-4">{children}</div>
    </section>
  );
}

/**
 * What a group applies to its devices: how long their logs are kept, which approved fixes they may use, and whether new
 * issues go to the group's own technicians. Anyone can read it; admins and operators can change it.
 */
export default function PolicyPanel({ detail, canEdit, onSaved }: Props) {
  const policy = detail.policy;
  const [keepDefault, setKeepDefault] = useState(policy?.retentionDays == null);
  const [days, setDays] = useState(String(policy?.retentionDays ?? 90));
  const [limitFixes, setLimitFixes] = useState(policy?.allowedScripts != null);
  const [chosen, setChosen] = useState<Set<string>>(new Set(policy?.allowedScripts ?? []));
  const [autoAssign, setAutoAssign] = useState(policy?.autoAssignIssues ?? true);
  const [scripts, setScripts] = useState<KnowledgeScript[] | null>(null);
  const [filter, setFilter] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    getApprovedScripts().then((s) => !cancelled && setScripts(s)).catch(() => !cancelled && setScripts([]));
    return () => {
      cancelled = true;
    };
  }, []);

  // One row per fix key (the newest approved version carries the title).
  const fixes = useMemo(() => {
    const byKey = new Map<string, KnowledgeScript>();
    (scripts ?? []).forEach((s) => {
      const have = byKey.get(s.scriptKey);
      if (!have || s.version > have.version) byKey.set(s.scriptKey, s);
    });
    const q = filter.trim().toLowerCase();
    return [...byKey.values()]
      .filter((s) => !q || s.title.toLowerCase().includes(q) || s.scriptKey.toLowerCase().includes(q))
      .sort((a, b) => a.title.localeCompare(b.title));
  }, [scripts, filter]);

  // Keys already allowed but no longer approved still show, so they are not silently dropped.
  const unknownKeys = useMemo(() => {
    const known = new Set((scripts ?? []).map((s) => s.scriptKey));
    return [...chosen].filter((k) => scripts !== null && !known.has(k));
  }, [chosen, scripts]);

  const toggle = (key: string) =>
    setChosen((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });

  const daysNumber = Number(days);
  const daysOk = keepDefault || (Number.isInteger(daysNumber) && daysNumber >= 1 && daysNumber <= 3650);
  const techCount = detail.summary.technicianCount;

  const save = async () => {
    setSaving(true);
    setError(null);
    try {
      const saved = await updateGroupPolicy(detail.summary.id, {
        retentionDays: keepDefault ? null : daysNumber,
        allowedScripts: limitFixes ? [...chosen] : null,
        autoAssignIssues: autoAssign,
      });
      toast('Policies saved', 'success');
      onSaved(saved);
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-4">
      <Card title="Keep logs and history" blurb="How long telemetry and event logs of this group's devices are kept before the nightly clean-up removes them.">
        <label className="flex items-center gap-2 text-[13px] text-slate-700">
          <input type="checkbox" checked={keepDefault} disabled={!canEdit} onChange={(e) => setKeepDefault(e.target.checked)} className="h-4 w-4 accent-sky-600" />
          Use the platform default
        </label>
        {!keepDefault && (
          <div className="mt-3 flex items-center gap-2 text-[13px] text-slate-700">
            Keep for
            <input value={days} onChange={(e) => setDays(e.target.value)} disabled={!canEdit} inputMode="numeric" aria-label="Days to keep" className={`${field} w-24`} />
            days
          </div>
        )}
        {!daysOk && <p className="mt-2 text-xs text-red-600">Enter a whole number of days from 1 to 3650.</p>}
        <p className="mt-3 text-[11px] text-slate-400">If a device is in several groups, the longest period wins.</p>
      </Card>

      <Card title="Which fixes these devices may use" blurb="Limits the approved fixes offered on the device and used by group runs.">
        <div className="space-y-2 text-[13px] text-slate-700">
          <label className="flex items-center gap-2">
            <input type="radio" name="fixes" checked={!limitFixes} disabled={!canEdit} onChange={() => setLimitFixes(false)} className="h-4 w-4 accent-sky-600" />
            Every approved fix
          </label>
          <label className="flex items-center gap-2">
            <input type="radio" name="fixes" checked={limitFixes} disabled={!canEdit} onChange={() => setLimitFixes(true)} className="h-4 w-4 accent-sky-600" />
            Only the fixes I choose
          </label>
        </div>
        {limitFixes && (
          <div className="mt-3 space-y-2">
            <input value={filter} onChange={(e) => setFilter(e.target.value)} placeholder="Search fixes…" aria-label="Search fixes" className={`${field} w-full max-w-sm`} />
            <div className="max-h-64 space-y-1 overflow-y-auto rounded-lg border border-slate-200 p-2">
              {scripts === null ? (
                <p className="px-2 py-4 text-center text-xs text-slate-400">Loading fixes…</p>
              ) : fixes.length === 0 && unknownKeys.length === 0 ? (
                <p className="px-2 py-4 text-center text-xs text-slate-400">No approved fixes match.</p>
              ) : (
                <>
                  {fixes.map((s) => (
                    <label key={s.scriptKey} className="flex cursor-pointer items-center gap-2.5 rounded-lg px-2 py-1.5 hover:bg-slate-50">
                      <input type="checkbox" checked={chosen.has(s.scriptKey)} disabled={!canEdit} onChange={() => toggle(s.scriptKey)} className="h-4 w-4 accent-sky-600" />
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-[13px] font-medium text-slate-800">{s.title}</span>
                        <span className="block truncate font-mono text-[11px] text-slate-400">{s.scriptKey}</span>
                      </span>
                    </label>
                  ))}
                  {unknownKeys.map((k) => (
                    <label key={k} className="flex cursor-pointer items-center gap-2.5 rounded-lg px-2 py-1.5 hover:bg-slate-50">
                      <input type="checkbox" checked disabled={!canEdit} onChange={() => toggle(k)} className="h-4 w-4 accent-sky-600" />
                      <span className="font-mono text-[11px] text-slate-500">{k} (not approved right now)</span>
                    </label>
                  ))}
                </>
              )}
            </div>
            <p className="text-[11px] text-slate-500">
              {chosen.size === 0 ? 'No fixes ticked: these devices will be offered none.' : `${chosen.size} fix${chosen.size === 1 ? '' : 'es'} allowed.`}
            </p>
          </div>
        )}
        <p className="mt-3 text-[11px] text-slate-400">If a device is in several groups that limit fixes, it may use all of their lists together.</p>
      </Card>

      <Card title="Who takes the issues" blurb="New issues from this group's devices go to the technician inside the group with the fewest open issues.">
        <label className="flex items-center gap-2 text-[13px] text-slate-700">
          <input type="checkbox" checked={autoAssign} disabled={!canEdit} onChange={(e) => setAutoAssign(e.target.checked)} className="h-4 w-4 accent-sky-600" />
          Give new issues to this group&apos;s technicians automatically
        </label>
        <p className="mt-2 text-xs text-slate-500">
          {techCount === 0
            ? 'There are no technicians in this group yet, so issues stay unassigned. Add some under "Inside this group".'
            : `${techCount} technician${techCount === 1 ? '' : 's'} in this group can take them.`}
        </p>
      </Card>

      {error && <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">{error}</p>}
      {canEdit ? (
        <div className="flex justify-end">
          <Button onClick={() => void save()} disabled={saving || !daysOk} loading={saving}>
            Save policies
          </Button>
        </div>
      ) : (
        <p className="text-xs text-slate-500">An administrator or operator can change these policies.</p>
      )}
    </div>
  );
}
