import { useCallback, useEffect, useState } from 'react';
import { getDeviceKbRuns, getDeviceKbSuggestions } from '../../api/commandApi';
import { agentKbRunsTopic, subscribeTopic } from '../../api/liveBus';
import type { DeviceKbSuggestion, KbScriptRun } from '../../types/knowledge';
import { formatDateTime } from '../../utils/formatDate';
import { AdminBadge, RiskBadge, RunStatusBadge, ScriptKeyChip } from '../knowledge/scriptMeta';
import { TRIGGER_LABEL } from '../knowledge/scriptParams';

/**
 * KB fixes for one device: approved fixes that match its open issues, and
 * every fix run on it with its check/fix/verify/undo outcome.
 */
export default function DeviceFixesTab({
  deviceId,
  agentId,
  onRunFix,
}: {
  deviceId: number;
  /** Enables live run updates pushed by the backend. */
  agentId?: string;
  onRunFix?: () => void;
}) {
  const [suggestions, setSuggestions] = useState<DeviceKbSuggestion[] | null>(null);
  const [runs, setRuns] = useState<KbScriptRun[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [openRun, setOpenRun] = useState<number | null>(null);

  const load = useCallback(async () => {
    setError(null);
    try {
      const [s, r] = await Promise.all([getDeviceKbSuggestions(deviceId), getDeviceKbRuns(deviceId, 30)]);
      setSuggestions(s);
      setRuns(r);
    } catch {
      setError('Could not load fixes for this device.');
      setSuggestions((v) => v ?? []);
      setRuns((v) => v ?? []);
    }
  }, [deviceId]);

  useEffect(() => {
    void load();
  }, [load]);

  // Live: a queued/finished run replaces its row (or is added on top).
  useEffect(() => {
    if (!agentId) return;
    return subscribeTopic(agentKbRunsTopic(agentId), (data) => {
      const run = data as KbScriptRun;
      if (!run?.id) return;
      setRuns((prev) => {
        const list = prev ?? [];
        const idx = list.findIndex((r) => r.id === run.id);
        if (idx < 0) return [run, ...list];
        const next = [...list];
        next[idx] = run;
        return next;
      });
    });
  }, [agentId]);

  const card = 'rounded-xl border border-line bg-panel';
  const eyebrow = 'font-mono text-[10px] font-medium uppercase tracking-[0.18em] text-slate-500';

  return (
    <div className="space-y-4">
      <div className={card}>
        <div className="flex items-center justify-between px-5 pb-3 pt-5">
          <div>
            <p className={eyebrow}>Suggested</p>
            <h3 className="mt-1 text-sm font-semibold text-slate-900">Fixes for this device’s open issues</h3>
          </div>
          <div className="flex items-center gap-2">
            <button type="button" onClick={() => void load()} className="text-xs font-medium text-slate-500 hover:text-slate-800">
              Refresh
            </button>
            {onRunFix && (
              <button
                type="button"
                onClick={onRunFix}
                className="rounded-lg bg-primary-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-primary-700"
              >
                Run a fix…
              </button>
            )}
          </div>
        </div>
        <div className="border-t border-line">
          {suggestions === null ? (
            <p className="px-5 py-6 text-sm text-slate-400">Loading…</p>
          ) : suggestions.length === 0 ? (
            <p className="px-5 py-6 text-sm text-slate-500">No approved fix matches an open issue on this device.</p>
          ) : (
            suggestions.map((s) => (
              <div key={`${s.issueId}-${s.script.id}`} className="flex flex-wrap items-center gap-3 border-b border-line/60 px-5 py-3 last:border-b-0">
                <div className="min-w-0 flex-1">
                  <p className="truncate text-[13px] font-medium text-slate-800">{s.script.title}</p>
                  <p className="truncate text-[11px] text-slate-500">
                    <ScriptKeyChip script={s.script} /> · for <span className="font-mono">{s.issueCode}</span> {s.issueTitle}
                  </p>
                </div>
                <RiskBadge risk={s.script.riskLevel} />
                {s.script.requiresAdmin && <AdminBadge />}
                {s.script.autoRun && <span className="text-[11px] text-sky-700">auto-run</span>}
              </div>
            ))
          )}
        </div>
      </div>

      <div className={card}>
        <div className="px-5 pb-3 pt-5">
          <p className={eyebrow}>History</p>
          <h3 className="mt-1 text-sm font-semibold text-slate-900">Fixes run on this device</h3>
        </div>
        <div className="border-t border-line">
          {runs === null ? (
            <p className="px-5 py-6 text-sm text-slate-400">Loading…</p>
          ) : runs.length === 0 ? (
            <p className="px-5 py-6 text-sm text-slate-500">No KB fixes have run on this device yet.</p>
          ) : (
            runs.map((r) => (
              <div key={r.id} className="border-b border-line/60 px-5 py-3 last:border-b-0">
                <button type="button" onClick={() => setOpenRun(openRun === r.id ? null : r.id)} className="flex w-full flex-wrap items-center gap-2 text-left">
                  <RunStatusBadge status={r.status} />
                  <span className="font-mono text-[12px] text-slate-700">
                    {r.scriptKey} <span className="text-slate-400">v{r.scriptVersion}</span>
                  </span>
                  <span className="text-[11px] text-slate-500">
                    {TRIGGER_LABEL[r.triggerType] ?? r.triggerType}
                    {r.requestedBy && r.triggerType === 'MANUAL' ? ` (${r.requestedBy})` : ''}
                  </span>
                  <span className="ml-auto text-[11px] text-slate-400">{formatDateTime(r.createdAt)}</span>
                </button>
                {openRun === r.id && (
                  <pre className="mt-2 max-h-64 overflow-auto whitespace-pre-wrap rounded-lg border border-line bg-slate-50 px-3 py-2 font-mono text-[11px] text-slate-700">
                    {r.output || (r.status === 'QUEUED' ? 'Waiting for the device…' : 'No output.')}
                  </pre>
                )}
              </div>
            ))
          )}
        </div>
      </div>
      {error && <p className="text-xs text-red-500">{error}</p>}
    </div>
  );
}
