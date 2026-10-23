import { useEffect, useMemo, useRef, useState, type FormEvent } from 'react';
import {
  cancelDeviceCommand,
  getDeviceKbSuggestions,
  queueDeviceCommand,
  runKbScript,
  waitForCommandResult,
  isFinished,
  type AgentCommand,
} from '../../api/commandApi';
import { AdminBadge, RiskBadge, ScriptKeyChip, ScriptParamsInputs } from '../knowledge/scriptMeta';
import { coerceParams, defaultParamValues, parseParams } from '../knowledge/scriptParams';
import { getApprovedScripts, getArticles } from '../../api/knowledgeApi';
import type { KnowledgeScript } from '../../types/knowledge';
import {
  AGENT_ACTIONS,
  SCRIPT_EXAMPLES,
  checkScriptCommand,
  describeStatus,
  formatOutput,
} from '../../utils/agentCommands';

interface CommandDialogProps {
  deviceId: number;
  agentId: string;
  agentHostname: string;
  online: boolean;
  /** Service names reported by the agent, for the service picker. */
  serviceNames?: string[];
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

const fieldClass =
  'w-full rounded-lg border border-line bg-canvas px-3 py-2.5 font-mono text-[13px] text-slate-800 placeholder:text-slate-400 transition-all focus:border-primary-400/60 focus:outline-none focus:ring-2 focus:ring-primary-500/20';

const labelClass = 'mb-2 block font-mono text-[10px] font-medium uppercase tracking-[0.16em] text-slate-500';

const FIELD_COPY = {
  command: { label: 'Command', placeholder: 'e.g. ipconfig /all' },
  serviceName: { label: 'Service name', placeholder: 'e.g. Spooler' },
  processName: { label: 'Process name', placeholder: 'e.g. chrome (without .exe)' },
} as const;

export default function CommandDialog({
  deviceId,
  agentId,
  agentHostname,
  online,
  serviceNames = [],
  isOpen,
  onClose,
  onSuccess,
}: CommandDialogProps) {
  const [mode, setMode] = useState<'commands' | 'kb'>('commands');
  const [actionId, setActionId] = useState('SCRIPT');
  const [value, setValue] = useState('');
  const [sending, setSending] = useState(false);
  const [error, setError] = useState('');
  const [tracked, setTracked] = useState<AgentCommand | null>(null);
  const [trackedLabel, setTrackedLabel] = useState('');
  const [timedOut, setTimedOut] = useState(false);
  const abortRef = useRef<AbortController | null>(null);

  // KB scripts
  const [scripts, setScripts] = useState<KnowledgeScript[] | null>(null);
  const [articleTitles, setArticleTitles] = useState<Record<number, string>>({});
  const [scriptsError, setScriptsError] = useState('');
  const [scriptQuery, setScriptQuery] = useState('');
  const [scriptId, setScriptId] = useState<number | null>(null);
  const [paramValues, setParamValues] = useState<Record<string, string>>({});
  const [suggested, setSuggested] = useState<Record<number, string>>({});

  const action = AGENT_ACTIONS.find((a) => a.id === actionId) ?? AGENT_ACTIONS[0];
  const scriptProblem = action.field === 'command' && value.trim() ? checkScriptCommand(value) : null;
  const selectedScript = scripts?.find((s) => s.id === scriptId) ?? null;
  const selectedParams = useMemo(() => parseParams(selectedScript?.parametersSchema), [selectedScript]);
  const canSend =
    !sending &&
    (mode === 'kb'
      ? !!selectedScript && isPowerShell(selectedScript)
      : !action.field || (!!value.trim() && !scriptProblem));

  const serviceOptions = useMemo(() => [...new Set(serviceNames)].sort((a, b) => a.localeCompare(b)), [serviceNames]);

  const visibleScripts = useMemo(() => {
    const q = scriptQuery.trim().toLowerCase();
    return (scripts ?? [])
      .filter(
        (s) =>
          !q ||
          s.title.toLowerCase().includes(q) ||
          s.scriptKey.toLowerCase().includes(q) ||
          s.description?.toLowerCase().includes(q) ||
          (s.articleId != null && articleTitles[s.articleId]?.toLowerCase().includes(q)),
      )
      // Fixes for this device's open issues first.
      .sort((a, b) => Number(b.id in suggested) - Number(a.id in suggested));
  }, [scripts, scriptQuery, articleTitles, suggested]);

  useEffect(() => () => abortRef.current?.abort(), []);

  // Load KB scripts (and their article titles) the first time the tab is opened.
  useEffect(() => {
    if (mode !== 'kb' || scripts !== null) return;
    let cancelled = false;
    getDeviceKbSuggestions(deviceId)
      .then((list) => !cancelled && setSuggested(Object.fromEntries(list.map((s) => [s.script.id, s.issueTitle]))))
      .catch(() => {});
    Promise.all([getApprovedScripts(), getArticles().catch(() => [])])
      .then(([list, articles]) => {
        if (cancelled) return;
        setScripts(list);
        setArticleTitles(Object.fromEntries(articles.map((a) => [a.id, a.title])));
      })
      .catch(() => !cancelled && setScriptsError('Could not load knowledge-base scripts.'));
    return () => {
      cancelled = true;
    };
  }, [mode, scripts, deviceId]);

  if (!isOpen) return null;

  const reset = () => {
    abortRef.current?.abort();
    setTracked(null);
    setParamValues(defaultParamValues(selectedParams));
    setTimedOut(false);
    setError('');
    setValue('');
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!canSend) return;
    let kbValues = {};
    if (mode === 'kb') {
      const coerced = coerceParams(selectedParams, paramValues);
      if ('error' in coerced) {
        setError(coerced.error);
        return;
      }
      kbValues = coerced.values;
    }
    setSending(true);
    setError('');
    try {
      const queued =
        mode === 'kb' && selectedScript
          ? await runKbScript(deviceId, selectedScript.id, kbValues)
          : await queueDeviceCommand(deviceId, action.build(value));
      setTrackedLabel(mode === 'kb' && selectedScript ? `KB script: ${selectedScript.title}` : action.label);
      setTracked(queued);
      onSuccess();
      const controller = new AbortController();
      abortRef.current = controller;
      const final = await waitForCommandResult(deviceId, queued.commandId, {
        onUpdate: setTracked,
        signal: controller.signal,
        agentId,
      });
      if (!controller.signal.aborted && final && !isFinished(final.status)) setTimedOut(true);
    } catch (err) {
      const message = (err as { response?: { data?: { message?: string } } })?.response?.data?.message;
      setError(message || 'Failed to queue the command. Please try again.');
      setTracked(null);
    } finally {
      setSending(false);
    }
  };

  const finished = tracked && isFinished(tracked.status);
  const failed = !!tracked && finished && tracked.status !== 'COMPLETED';
  const canCancel = tracked?.status === 'PENDING';

  const cancelTracked = async () => {
    if (!tracked) return;
    try {
      setTracked(await cancelDeviceCommand(deviceId, tracked.commandId));
    } catch (err) {
      const message = (err as { response?: { data?: { message?: string } } })?.response?.data?.message;
      setError(message || 'Could not cancel - the device may already have picked it up.');
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />

      <div className="relative flex max-h-[90vh] w-full max-w-xl flex-col overflow-hidden rounded-2xl border border-line bg-panel shadow-[0_40px_120px_-20px_rgba(15,23,42,0.3)]">
        {/* Header */}
        <div className="flex items-start justify-between border-b border-line bg-slate-50 px-6 py-5">
          <div className="min-w-0">
            <p className="font-mono text-[10px] font-medium uppercase tracking-[0.2em] text-primary-400">Remote action</p>
            <h2 className="mt-1.5 font-display text-[17px] font-semibold text-slate-900">Send command</h2>
            <p className="mt-0.5 truncate font-mono text-[11px] text-slate-500">
              {agentHostname} · {agentId}
            </p>
          </div>
          <button
            onClick={onClose}
            className="rounded-lg p-1.5 text-slate-500 transition-colors hover:bg-slate-100/70 hover:text-slate-800"
            aria-label="Close"
          >
            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" strokeWidth={1.8} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {tracked ? (
          /* ── Progress / result ── */
          <div className="space-y-4 overflow-y-auto px-6 py-5">
            <div className="flex items-center gap-3">
              {finished ? (
                <span
                  className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full ring-1 ring-inset ${
                    failed ? 'bg-red-500/10 text-red-500 ring-red-400/30' : 'bg-emerald-500/10 text-emerald-500 ring-emerald-400/30'
                  }`}
                >
                  {failed ? '✕' : '✓'}
                </span>
              ) : (
                <span className="h-9 w-9 shrink-0 animate-spin rounded-full border-2 border-primary-200 border-t-primary-500" />
              )}
              <div className="min-w-0">
                <p className="text-[14px] font-semibold text-slate-900">{trackedLabel}</p>
                <p className="text-[12px] text-slate-500">
                  {timedOut
                    ? 'No result after 5 minutes. It may still be waiting for the user - check the Terminal tab later.'
                    : describeStatus(tracked.status, mode === 'kb' || action.needsApproval)}
                </p>
              </div>
            </div>

            {finished && (
              <div>
                <p className={labelClass}>Output</p>
                <pre
                  className={`max-h-72 overflow-auto whitespace-pre-wrap rounded-lg border px-3 py-2.5 font-mono text-[12px] leading-relaxed ${
                    failed ? 'border-red-200 bg-red-50 text-red-700' : 'border-line bg-slate-50 text-slate-700'
                  }`}
                >
                  {formatOutput(tracked.result)}
                </pre>
              </div>
            )}

            <p className="font-mono text-[11px] text-slate-400">Command {tracked.commandId}</p>
            {error && <p className="text-[12px] text-red-600">{error}</p>}

            {canCancel && (
              <button
                type="button"
                onClick={() => void cancelTracked()}
                className="w-full rounded-lg border border-red-200 px-4 py-2 text-[13px] font-medium text-red-600 transition-colors hover:bg-red-50"
              >
                Cancel - the device hasn't picked it up yet
              </button>
            )}

            <div className="flex gap-3 pt-1">
              <button
                type="button"
                onClick={reset}
                className="flex-1 rounded-lg border border-line px-4 py-2.5 text-[13px] font-medium text-slate-600 transition-colors hover:border-line-strong hover:text-slate-900"
              >
                Send another
              </button>
              <button
                type="button"
                onClick={onClose}
                className="flex-1 rounded-lg bg-primary-500 px-4 py-2.5 text-[13px] font-semibold text-white transition-all hover:bg-primary-400"
              >
                {finished ? 'Close' : 'Close (keeps running)'}
              </button>
            </div>
          </div>
        ) : (
          /* ── Form ── */
          <form onSubmit={handleSubmit} className="space-y-5 overflow-y-auto px-6 py-5">
            {!online && (
              <div className="rounded-lg border border-amber-300/50 bg-amber-50 px-3 py-2 text-[12px] text-amber-800">
                This device is offline. The command will wait in the queue until the agent reconnects.
              </div>
            )}

            <div className="flex rounded-lg border border-line bg-slate-50 p-1">
              {(
                [
                  ['commands', 'Commands'],
                  ['kb', 'KB scripts'],
                ] as const
              ).map(([id, label]) => (
                <button
                  key={id}
                  type="button"
                  onClick={() => {
                    setMode(id);
                    setError('');
                  }}
                  className={`flex-1 rounded-md px-3 py-1.5 text-[13px] font-medium transition-all ${
                    mode === id ? 'bg-white text-slate-900 shadow-sm ring-1 ring-line' : 'text-slate-500 hover:text-slate-800'
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>

            {mode === 'kb' ? (
              <KbScriptPicker
                scripts={scripts}
                visible={visibleScripts}
                articleTitles={articleTitles}
                error={scriptsError}
                query={scriptQuery}
                onQuery={setScriptQuery}
                selected={selectedScript}
                onSelect={(id) => {
                  setScriptId(id);
                  const s = scripts?.find((x) => x.id === id);
                  setParamValues(defaultParamValues(parseParams(s?.parametersSchema)));
                }}
                suggested={suggested}
                params={selectedParams}
                paramValues={paramValues}
                onParamValues={setParamValues}
              />
            ) : (
            <>
            <div>
              <label className={labelClass}>Action</label>
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                {AGENT_ACTIONS.map((a) => {
                  const active = actionId === a.id;
                  return (
                    <button
                      key={a.id}
                      type="button"
                      onClick={() => {
                        setActionId(a.id);
                        setValue('');
                        setError('');
                      }}
                      className={`rounded-xl border p-2.5 text-left transition-all duration-150 ${
                        active
                          ? 'border-primary-300 bg-primary-50 ring-1 ring-inset ring-primary-300'
                          : 'border-line bg-white hover:border-line-strong'
                      }`}
                    >
                      <div className={`text-[12.5px] font-medium ${active ? 'text-primary-700' : 'text-slate-700'}`}>
                        {a.label}
                      </div>
                      <div className="mt-0.5 text-[10.5px] leading-snug text-slate-500">{a.description}</div>
                    </button>
                  );
                })}
              </div>
            </div>

            {action.field && (
              <div>
                <label className={labelClass}>{FIELD_COPY[action.field].label}</label>
                <input
                  type="text"
                  value={value}
                  onChange={(e) => setValue(e.target.value)}
                  placeholder={FIELD_COPY[action.field].placeholder}
                  list={action.field === 'serviceName' ? 'dex-service-names' : undefined}
                  spellCheck={false}
                  autoComplete="off"
                  autoFocus
                  className={fieldClass}
                />
                {action.field === 'serviceName' && serviceOptions.length > 0 && (
                  <datalist id="dex-service-names">
                    {serviceOptions.map((s) => (
                      <option key={s} value={s} />
                    ))}
                  </datalist>
                )}
                {scriptProblem && <p className="mt-1.5 text-[12px] text-amber-700">{scriptProblem}</p>}
              </div>
            )}

            {action.field === 'command' && (
              <div>
                <label className={labelClass}>Examples</label>
                <div className="flex flex-wrap gap-1.5">
                  {SCRIPT_EXAMPLES.map((ex) => (
                    <button
                      key={ex}
                      type="button"
                      onClick={() => setValue(ex)}
                      className="max-w-full truncate rounded-md border border-line bg-slate-50 px-2.5 py-1.5 font-mono text-[11px] text-slate-600 transition-colors hover:border-primary-300 hover:text-slate-900"
                      title={ex}
                    >
                      {ex}
                    </button>
                  ))}
                </div>
                <p className="mt-2 text-[11px] leading-relaxed text-slate-500">
                  Only allow-listed commands run here, one at a time. For sfc, DISM or anything multi-step, use a
                  KB script instead (it can run as administrator).
                </p>
              </div>
            )}

            <div className="rounded-lg border border-line bg-slate-50 px-3 py-2 text-[12px] text-slate-600">
              {action.needsApproval
                ? 'The user at that PC sees a prompt and must click Continue before this runs.'
                : 'Read-only - runs without asking the user.'}
              {action.needsAdmin &&
                ' It needs administrator rights, so the user approves a Windows admin prompt (an admin username and password on a standard account).'}
            </div>
            </>
            )}

            {error && (
              <div className="rounded-lg border border-red-500/25 bg-red-500/10 px-3 py-2 text-xs text-red-600">{error}</div>
            )}

            <div className="flex gap-3 pt-1">
              <button
                type="button"
                onClick={onClose}
                className="flex-1 rounded-lg border border-line px-4 py-2.5 text-[13px] font-medium text-slate-600 transition-colors hover:border-line-strong hover:text-slate-900"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={!canSend}
                className="flex flex-1 items-center justify-center gap-2 rounded-lg bg-primary-500 px-4 py-2.5 text-[13px] font-semibold text-white transition-all hover:bg-primary-400 disabled:cursor-not-allowed disabled:opacity-40"
              >
                {sending ? (
                  <>
                    <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-white/30 border-t-white" />
                    Sending…
                  </>
                ) : (
                  <>
                    <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth={1.8} stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M6 12 3.269 3.126A59.768 59.768 0 0 1 21.485 12 59.77 59.77 0 0 1 3.27 20.876L5.999 12Zm0 0h7.5" />
                    </svg>
                    Send command
                  </>
                )}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}

/** The agent runs PowerShell scripts only; a blank language is treated as PowerShell (the backend's default). */
function isPowerShell(script: KnowledgeScript): boolean {
  const lang = (script.language ?? '').trim().toLowerCase();
  return lang === '' || lang === 'powershell' || lang === 'ps1' || lang === 'pwsh';
}

function KbScriptPicker({
  scripts,
  visible,
  articleTitles,
  error,
  query,
  onQuery,
  selected,
  onSelect,
  suggested,
  params,
  paramValues,
  onParamValues,
}: {
  scripts: KnowledgeScript[] | null;
  visible: KnowledgeScript[];
  articleTitles: Record<number, string>;
  error: string;
  query: string;
  onQuery: (q: string) => void;
  selected: KnowledgeScript | null;
  onSelect: (id: number) => void;
  suggested: Record<number, string>;
  params: ReturnType<typeof parseParams>;
  paramValues: Record<string, string>;
  onParamValues: (v: Record<string, string>) => void;
}) {
  if (error) {
    return <div className="rounded-lg border border-red-500/25 bg-red-500/10 px-3 py-2 text-xs text-red-600">{error}</div>;
  }
  if (scripts === null) {
    return (
      <div className="flex items-center gap-2 py-6 text-[13px] text-slate-500">
        <span className="h-4 w-4 animate-spin rounded-full border-2 border-primary-200 border-t-primary-500" />
        Loading knowledge-base scripts…
      </div>
    );
  }
  if (scripts.length === 0) {
    return (
      <div className="rounded-lg border border-dashed border-line px-4 py-6 text-center text-[13px] text-slate-500">
        No approved scripts yet. A script must be submitted and approved (by someone other than its author) before it can run.
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div>
        <label className={labelClass}>Script</label>
        <input
          value={query}
          onChange={(e) => onQuery(e.target.value)}
          placeholder="Search scripts or articles…"
          className={fieldClass.replace('font-mono ', '')}
        />
        <div className="mt-2 max-h-52 space-y-1.5 overflow-y-auto pr-1">
          {visible.length === 0 && <p className="py-3 text-center text-[12px] text-slate-500">No scripts match.</p>}
          {visible.map((s) => {
            const active = selected?.id === s.id;
            const supported = isPowerShell(s);
            return (
              <button
                key={s.id}
                type="button"
                disabled={!supported}
                onClick={() => onSelect(s.id)}
                title={supported ? undefined : 'The agent runs PowerShell scripts only'}
                className={`w-full rounded-xl border px-3 py-2.5 text-left transition-all ${
                  active
                    ? 'border-primary-300 bg-primary-50 ring-1 ring-inset ring-primary-300'
                    : 'border-line bg-white hover:border-line-strong'
                } disabled:cursor-not-allowed disabled:opacity-50`}
              >
                <div className="flex items-center gap-2">
                  <span className={`truncate text-[13px] font-medium ${active ? 'text-primary-700' : 'text-slate-800'}`}>{s.title}</span>
                  <span className="ml-auto flex shrink-0 gap-1">
                    <RiskBadge risk={s.riskLevel} />
                    {s.requiresAdmin && <AdminBadge />}
                  </span>
                </div>
                <div className="mt-0.5 flex items-center gap-2 truncate text-[11px] text-slate-500">
                  <ScriptKeyChip script={s} />
                  {suggested[s.id] ? (
                    <span className="truncate font-medium text-amber-700">Suggested for: {suggested[s.id]}</span>
                  ) : (
                    <span className="truncate">
                      {s.articleId != null && articleTitles[s.articleId] ? `From: ${articleTitles[s.articleId]}` : s.description || ''}
                    </span>
                  )}
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {selected && (
        <>
          <div>
            <label className={labelClass}>Preview</label>
            <pre className="max-h-40 overflow-auto whitespace-pre-wrap rounded-lg border border-line bg-slate-50 px-3 py-2.5 font-mono text-[11.5px] leading-relaxed text-slate-700">
              {selected.content}
            </pre>
            {(selected.checkScript || selected.verifyScript || selected.undoScript) && (
              <p className="mt-1.5 text-[11px] text-slate-500">
                Runs{' '}
                {[selected.checkScript && 'check', 'fix', selected.verifyScript && 'verify'].filter(Boolean).join(' → ')}
                {selected.undoScript ? ', and undoes the change if it doesn’t work' : ''}.
              </p>
            )}
          </div>
          {params.length > 0 && (
            <div>
              <label className={labelClass}>Parameters</label>
              <ScriptParamsInputs params={params} values={paramValues} onChange={onParamValues} />
            </div>
          )}
          {selected.requiresAdmin && (
            <div className="rounded-lg border border-violet-200 bg-violet-50 px-3 py-2 text-[12px] text-violet-800">
              This fix needs administrator rights. The user at that PC approves one Windows admin prompt (an administrator's
              username and password on a standard account). The password never passes through DEX.
            </div>
          )}
        </>
      )}
      <div className="rounded-lg border border-line bg-slate-50 px-3 py-2 text-[12px] text-slate-600">
        Only approved, signed versions are listed. The agent checks the signature, shows the user exactly which fix and
        version it is, and runs nothing until they click Continue.
      </div>
    </div>
  );
}
