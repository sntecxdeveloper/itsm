import { useEffect, useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import * as knowledgeApi from '../../api/knowledgeApi';
import { runScriptOnGroup } from '../../api/groupApi';
import { subscribeTopic } from '../../api/liveBus';
import type { BulkRunResult, KbScriptRun, KnowledgeScript } from '../../types';
import type { GroupSummary } from '../../types/group';
import { AdminBadge, RiskBadge, RunStatusBadge, ScriptParamsInputs } from '../knowledge/scriptMeta';
import { coerceParams, defaultParamValues, parseParams } from '../knowledge/scriptParams';

interface Props {
  group: GroupSummary;
  onClose: () => void;
}

type Step = 'pick' | 'params' | 'progress';

/**
 * Runs one approved fix on every device in a group. Choose the fix, fill in its parameters once, then watch each device
 * report back live. It is the same fleet run as picking devices by hand, so each device user still sees the approval
 * window before anything runs.
 */
export default function GroupRunModal({ group, onClose }: Props) {
  const [step, setStep] = useState<Step>('pick');
  const [scripts, setScripts] = useState<KnowledgeScript[] | null>(null);
  const [query, setQuery] = useState('');
  const [script, setScript] = useState<KnowledgeScript | null>(null);
  const [paramValues, setParamValues] = useState<Record<string, string>>({});
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState<BulkRunResult | null>(null);
  const [runs, setRuns] = useState<Map<number, KbScriptRun>>(new Map());

  const params = useMemo(() => parseParams(script?.parametersSchema), [script]);

  useEffect(() => {
    let cancelled = false;
    knowledgeApi
      .getApprovedScripts()
      .then((s) => !cancelled && setScripts(s))
      .catch(() => !cancelled && setScripts([]));
    return () => {
      cancelled = true;
    };
  }, []);

  // Live progress once running: seed from the batch endpoint, then update from pushes.
  useEffect(() => {
    if (!result) return;
    let cancelled = false;
    knowledgeApi.getBulkBatch(result.batchId).then((list) => {
      if (cancelled) return;
      setRuns((prev) => {
        const next = new Map(prev);
        list.forEach((r) => {
          const q = result.queued.find((x) => x.runId === r.id);
          if (q) next.set(q.deviceId, r);
        });
        return next;
      });
    });
    const unsubscribe = subscribeTopic(`/topic/kb-batches/${result.batchId}`, (data) => {
      const r = data as KbScriptRun;
      const q = result.queued.find((x) => x.runId === r.id);
      if (q) setRuns((prev) => new Map(prev).set(q.deviceId, r));
    });
    return () => {
      cancelled = true;
      unsubscribe();
    };
  }, [result]);

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    return (scripts ?? []).filter((s) => !q || s.title.toLowerCase().includes(q) || s.scriptKey.toLowerCase().includes(q));
  }, [scripts, query]);

  const choose = (s: KnowledgeScript) => {
    setScript(s);
    setParamValues(defaultParamValues(parseParams(s.parametersSchema)));
    setError(null);
    setStep('params');
  };

  const submit = async () => {
    if (!script) return;
    const coerced = coerceParams(params, paramValues);
    if ('error' in coerced) {
      setError(coerced.error);
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      setResult(await runScriptOnGroup(group.id, script.id, coerced.values));
      setStep('progress');
    } catch (err) {
      setError(knowledgeApi.apiError(err, 'Could not start the run.'));
    } finally {
      setSubmitting(false);
    }
  };

  const btn = 'px-4 py-2 text-sm font-medium rounded-lg disabled:opacity-50';
  const primary = `${btn} text-white bg-primary-600 hover:bg-primary-700`;
  const secondary = `${btn} text-slate-700 bg-slate-100 hover:bg-slate-200`;
  const finished = result ? [...runs.values()].filter((r) => r.status !== 'QUEUED').length : 0;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={onClose}>
      <motion.div
        initial={{ opacity: 0, scale: 0.96 }}
        animate={{ opacity: 1, scale: 1 }}
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-label="Run a fix on this group"
        className="max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-2xl bg-white shadow-xl"
      >
        <div className="space-y-4 p-6">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Run on group</p>
            <h2 className="mt-1 text-lg font-semibold text-slate-900">{group.name}</h2>
            <p className="text-xs text-slate-500">
              {group.deviceCount} device{group.deviceCount === 1 ? '' : 's'}
              {script && (
                <>
                  {' '}
                  · {script.title} <span className="ml-1"><RiskBadge risk={script.riskLevel} /></span>
                  {script.requiresAdmin && <span className="ml-1"><AdminBadge /></span>}
                </>
              )}
            </p>
          </div>

          {step === 'pick' && (
            <div className="space-y-3">
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search approved fixes…"
                className="h-10 w-full rounded-lg border border-line bg-panel px-3 text-[13px] focus:border-primary-400/60 focus:outline-none focus:ring-2 focus:ring-primary-500/20"
                autoFocus
              />
              <div className="max-h-72 space-y-1 overflow-y-auto rounded-lg border border-slate-200 p-2">
                {scripts === null ? (
                  <p className="px-2 py-6 text-center text-xs text-slate-400">Loading fixes…</p>
                ) : visible.length === 0 ? (
                  <p className="px-2 py-6 text-center text-xs text-slate-400">
                    {scripts.length === 0 ? 'No approved fixes yet. Approve one in the Knowledge Base first.' : 'No fix matches that search.'}
                  </p>
                ) : (
                  visible.map((s) => (
                    <button
                      key={s.id}
                      type="button"
                      onClick={() => choose(s)}
                      className="flex w-full items-center gap-3 rounded-lg px-2 py-2 text-left hover:bg-slate-50"
                    >
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-[13px] font-medium text-slate-800">{s.title}</span>
                        <span className="block truncate font-mono text-[11px] text-slate-400">
                          {s.scriptKey} v{s.version}
                        </span>
                      </span>
                      <RiskBadge risk={s.riskLevel} />
                    </button>
                  ))
                )}
              </div>
            </div>
          )}

          {step === 'params' && script && (
            <div className="space-y-3">
              <p className="text-sm text-slate-600">
                This runs on all {group.deviceCount} device{group.deviceCount === 1 ? '' : 's'} in the group. Each device user still sees the
                approval window before anything runs.
              </p>
              {params.length === 0 ? <p className="text-xs text-slate-500">This fix needs no settings.</p> : <ScriptParamsInputs params={params} values={paramValues} onChange={setParamValues} />}
            </div>
          )}

          {step === 'progress' && result && (
            <div className="space-y-3">
              <p className="text-sm text-slate-600">
                {finished} of {result.queued.length} finished · batch <span className="font-mono text-[11px]">{result.batchId}</span>
              </p>
              <div className="max-h-72 space-y-1.5 overflow-y-auto rounded-lg border border-slate-200 p-2">
                {result.queued.map((q) => (
                  <div key={q.deviceId} className="flex items-center gap-2.5 rounded-lg px-2 py-1.5">
                    <span className="min-w-0 flex-1 truncate text-[13px] text-slate-800">{q.hostname ?? `Device #${q.deviceId}`}</span>
                    <RunStatusBadge status={runs.get(q.deviceId)?.status ?? 'QUEUED'} />
                  </div>
                ))}
              </div>
              {result.skipped.length > 0 && (
                <div>
                  <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-slate-500">Skipped</p>
                  <div className="space-y-1 rounded-lg border border-slate-200 bg-slate-50 p-2">
                    {result.skipped.map((s) => (
                      <div key={s.deviceId} className="flex items-center gap-2.5 px-2 py-1 text-[12px]">
                        <span className="min-w-0 flex-1 truncate text-slate-700">{s.hostname ?? `Device #${s.deviceId}`}</span>
                        <span className="shrink-0 text-slate-500">{s.reason}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {error && <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">{error}</p>}

          <div className="flex justify-end gap-3 border-t border-slate-100 pt-4">
            {step === 'pick' && (
              <button type="button" onClick={onClose} className={secondary}>
                Cancel
              </button>
            )}
            {step === 'params' && (
              <>
                <button type="button" onClick={() => setStep('pick')} className={secondary}>
                  Back
                </button>
                <button type="button" disabled={submitting} onClick={() => void submit()} className={primary}>
                  {submitting ? 'Starting…' : `Run on ${group.deviceCount} device${group.deviceCount === 1 ? '' : 's'}`}
                </button>
              </>
            )}
            {step === 'progress' && (
              <button type="button" onClick={onClose} className={primary}>
                Close
              </button>
            )}
          </div>
        </div>
      </motion.div>
    </div>
  );
}
