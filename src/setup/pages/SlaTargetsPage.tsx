import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { getSlaPolicies, setSlaPolicyEnabled, updateSlaPolicy, type SlaPolicy, type SlaPriority } from '../../api/slaPolicyApi';

type Unit = 'minutes' | 'hours' | 'days';
const UNIT_MINUTES: Record<Unit, number> = { minutes: 1, hours: 60, days: 1440 };

const ORDER: SlaPriority[] = ['CRITICAL', 'HIGH', 'MEDIUM', 'LOW'];
const LABEL: Record<SlaPriority, string> = { CRITICAL: '1 - Critical', HIGH: '2 - High', MEDIUM: '3 - Moderate', LOW: '4 - Low' };

/** Largest unit that divides the minutes evenly, so 120 shows as "2 Hours" and 90 as "90 Minutes". */
function split(minutes: number): { amount: number; unit: Unit } {
  if (minutes >= 1440 && minutes % 1440 === 0) return { amount: minutes / 1440, unit: 'days' };
  if (minutes >= 60 && minutes % 60 === 0) return { amount: minutes / 60, unit: 'hours' };
  return { amount: minutes, unit: 'minutes' };
}

function describe(minutes: number): string {
  const { amount, unit } = split(minutes);
  const name = unit === 'minutes' ? 'Minute' : unit === 'hours' ? 'Hour' : 'Day';
  return `${amount} ${name}${amount === 1 ? '' : 's'}`;
}

interface Draft {
  responseAmount: string;
  responseUnit: Unit;
  resolutionAmount: string;
  resolutionUnit: Unit;
}

const toDraft = (p: SlaPolicy): Draft => {
  const r = split(p.responseMinutes);
  const s = split(p.resolutionMinutes);
  return { responseAmount: String(r.amount), responseUnit: r.unit, resolutionAmount: String(s.amount), resolutionUnit: s.unit };
};

const minutesOf = (amount: string, unit: Unit) => Math.round(Number(amount) * UNIT_MINUTES[unit]);

/** The same checks the server makes, so mistakes show before the request is sent. */
function problem(d: Draft): string | null {
  const response = minutesOf(d.responseAmount, d.responseUnit);
  const resolution = minutesOf(d.resolutionAmount, d.resolutionUnit);
  if (!Number.isFinite(response) || !Number.isFinite(resolution) || d.responseAmount === '' || d.resolutionAmount === '') return 'Enter both durations.';
  if (response < 1) return 'Response must be at least 1 minute.';
  if (resolution < response) return 'Response cannot be longer than the resolution time.';
  return null;
}

const input =
  'w-20 rounded-md border border-slate-300 bg-white px-2 py-1 text-xs text-slate-800 focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500';
const select =
  'rounded-md border border-slate-300 bg-white px-1.5 py-1 text-xs text-slate-800 focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500';
const btn = 'rounded border border-slate-300 bg-white px-3 py-1 text-xs font-semibold text-slate-800 hover:bg-slate-100 disabled:opacity-50';
const darkBtn = 'rounded bg-slate-800 px-3 py-1 text-xs font-semibold text-white hover:bg-slate-900 disabled:opacity-50';

const errorText = (e: unknown, fallback: string) => {
  const message = (e as { response?: { data?: { message?: string } } })?.response?.data?.message;
  return message || fallback;
};

function DurationInput({ amount, unit, onAmount, onUnit, label }: { amount: string; unit: Unit; onAmount: (v: string) => void; onUnit: (u: Unit) => void; label: string }) {
  return (
    <span className="inline-flex items-center gap-1">
      <input type="number" min={1} value={amount} onChange={(e) => onAmount(e.target.value)} aria-label={`${label} amount`} className={input} />
      <select value={unit} onChange={(e) => onUnit(e.target.value as Unit)} aria-label={`${label} unit`} className={select}>
        <option value="minutes">Minutes</option>
        <option value="hours">Hours</option>
        <option value="days">Days</option>
      </select>
    </span>
  );
}

export default function SlaTargetsPage() {
  const [policies, setPolicies] = useState<SlaPolicy[] | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [editing, setEditing] = useState<SlaPriority | null>(null);
  const [draft, setDraft] = useState<Draft | null>(null);
  const [saving, setSaving] = useState(false);
  const [toggling, setToggling] = useState<SlaPriority | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const load = () => {
    setLoadError(null);
    getSlaPolicies()
      .then((list) => setPolicies([...list].sort((a, b) => ORDER.indexOf(a.priority) - ORDER.indexOf(b.priority))))
      .catch((e) => setLoadError(errorText(e, 'Could not load the SLA targets.')));
  };
  useEffect(load, []);

  const edit = (p: SlaPolicy) => {
    setEditing(p.priority);
    setDraft(toDraft(p));
    setError(null);
    setNotice(null);
  };

  const cancel = () => {
    setEditing(null);
    setDraft(null);
    setError(null);
  };

  const save = async () => {
    if (!editing || !draft) return;
    const p = problem(draft);
    if (p) return setError(p);
    setSaving(true);
    setError(null);
    try {
      const updated = await updateSlaPolicy(editing, minutesOf(draft.responseAmount, draft.responseUnit), minutesOf(draft.resolutionAmount, draft.resolutionUnit));
      setPolicies((list) => (list ?? []).map((x) => (x.priority === updated.priority ? updated : x)));
      setNotice(`${LABEL[updated.priority]} targets saved.`);
      setEditing(null);
      setDraft(null);
    } catch (e) {
      setError(errorText(e, 'Could not save the targets.'));
    } finally {
      setSaving(false);
    }
  };

  const toggle = async (p: SlaPolicy) => {
    setToggling(p.priority);
    setError(null);
    setNotice(null);
    try {
      const updated = await setSlaPolicyEnabled(p.priority, !p.enabled);
      setPolicies((list) => (list ?? []).map((x) => (x.priority === updated.priority ? updated : x)));
      setNotice(`${LABEL[updated.priority]} SLA turned ${updated.enabled ? 'on' : 'off'}.`);
    } catch (e) {
      setError(errorText(e, 'Could not change the status.'));
    } finally {
      setToggling(null);
    }
  };

  const patch = (p: Partial<Draft>) => {
    setError(null);
    setDraft((d) => (d ? { ...d, ...p } : d));
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <Link to="/setup" className="text-xs text-primary-600 hover:underline">
          ‹ Setup
        </Link>
        <h1 className="text-base font-semibold text-slate-900">Service Level Agreements</h1>
      </div>

      <section className="rounded-xl border border-slate-200 bg-white p-4">
        <h2 className="text-[13px] font-semibold text-slate-900">SLA targets by priority</h2>
        <p className="mt-1 text-xs text-slate-500">
          How long the team has to respond to, and to resolve, an incident of each priority. The clock starts when the incident is created, and the deadlines are set on the incident at that moment.
        </p>

        {loadError ? (
          <div className="mt-4 flex items-center gap-3 text-xs text-red-600">
            <span>{loadError}</span>
            <button className={btn} onClick={load}>
              Retry
            </button>
          </div>
        ) : policies === null ? (
          <p className="mt-4 text-xs text-slate-400">Loading…</p>
        ) : (
          <div className="mt-4 overflow-x-auto">
            <table className="w-full min-w-[640px] border-collapse text-xs">
              <thead>
                <tr className="bg-slate-50 text-left text-slate-600">
                  <th className="border border-slate-200 px-3 py-2 font-semibold">Priority</th>
                  <th className="border border-slate-200 px-3 py-2 font-semibold">Response within</th>
                  <th className="border border-slate-200 px-3 py-2 font-semibold">Resolution within</th>
                  <th className="w-72 border border-slate-200 px-3 py-2 font-semibold">Status</th>
                </tr>
              </thead>
              <tbody>
                {policies.map((p) => {
                  const on = editing === p.priority && draft;
                  return (
                    <tr key={p.priority}>
                      <th className="border border-slate-200 bg-slate-50 px-3 py-2 text-left font-semibold text-slate-700">{LABEL[p.priority]}</th>
                      <td className="border border-slate-200 px-3 py-2 text-slate-800">
                        {on ? (
                          <DurationInput label="Response" amount={draft.responseAmount} unit={draft.responseUnit} onAmount={(v) => patch({ responseAmount: v })} onUnit={(u) => patch({ responseUnit: u })} />
                        ) : (
                          describe(p.responseMinutes)
                        )}
                      </td>
                      <td className="border border-slate-200 px-3 py-2 text-slate-800">
                        {on ? (
                          <DurationInput label="Resolution" amount={draft.resolutionAmount} unit={draft.resolutionUnit} onAmount={(v) => patch({ resolutionAmount: v })} onUnit={(u) => patch({ resolutionUnit: u })} />
                        ) : (
                          describe(p.resolutionMinutes)
                        )}
                      </td>
                      <td className="border border-slate-200 px-3 py-2">
                        <div className="flex items-center gap-3">
                          <span className="flex w-20 items-center">
                          <button
                            type="button"
                            role="switch"
                            aria-checked={p.enabled}
                            aria-label={`${LABEL[p.priority]} SLA ${p.enabled ? 'on' : 'off'}`}
                            disabled={toggling !== null || saving}
                            onClick={() => void toggle(p)}
                            className={`relative h-5 w-9 rounded-full transition-colors disabled:opacity-50 ${p.enabled ? 'bg-primary-600' : 'bg-slate-300'}`}
                          >
                            <span className={`absolute top-0.5 h-4 w-4 rounded-full bg-white transition-all ${p.enabled ? 'left-[18px]' : 'left-0.5'}`} />
                          </button>
                          <span className="ml-2 align-middle text-[11px] text-slate-600">{p.enabled ? 'On' : 'Off'}</span>
                          </span>
                          {on ? (
                            <span className="flex gap-2">
                              <button className={darkBtn} onClick={() => void save()} disabled={saving}>
                                {saving ? 'Saving…' : 'Save'}
                              </button>
                              <button className={btn} onClick={cancel} disabled={saving}>
                                Cancel
                              </button>
                            </span>
                          ) : (
                            <button className={btn} onClick={() => edit(p)} disabled={editing !== null}>
                              Edit
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
            {policies.length === 0 && <p className="mt-3 text-xs text-slate-500">No SLA targets are defined on the server yet.</p>}
          </div>
        )}

        {(error || notice) && <p className={`mt-3 text-xs ${error ? 'text-red-600' : 'text-slate-600'}`}>{error ?? notice}</p>}
      </section>
    </div>
  );
}
