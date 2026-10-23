import { useState } from 'react';
import { Link } from 'react-router-dom';
import {
  LIFECYCLE_LABEL,
  LIFECYCLE_STATES,
  defaultTransitions,
  loadTransitions,
  saveTransitions,
  type LifecycleState,
  type Transitions,
} from '../../utils/lifecycle';

const btn = 'rounded border border-slate-300 bg-white px-3 py-1 text-xs font-semibold text-slate-800 hover:bg-slate-100 disabled:opacity-50';
const darkBtn = 'rounded bg-slate-800 px-3 py-1 text-xs font-semibold text-white hover:bg-slate-900 disabled:opacity-50';

const same = (a: Transitions, b: Transitions) => LIFECYCLE_STATES.every((s) => [...a[s]].sort().join() === [...b[s]].sort().join());

export default function LifeCyclesPage() {
  const [saved, setSaved] = useState<Transitions>(loadTransitions);
  const [draft, setDraft] = useState<Transitions>(saved);
  const [notice, setNotice] = useState<string | null>(null);
  const dirty = !same(saved, draft);

  const toggle = (from: LifecycleState, to: LifecycleState) => {
    setNotice(null);
    setDraft((d) => ({ ...d, [from]: d[from].includes(to) ? d[from].filter((s) => s !== to) : [...d[from], to] }));
  };

  const save = () => {
    if (saveTransitions(draft)) {
      setSaved(draft);
      setNotice('Life cycle saved.');
    } else setNotice('The browser would not save the change (storage is full or blocked).');
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <Link to="/setup" className="text-xs text-primary-600 hover:underline">
          ‹ Setup
        </Link>
        <h1 className="text-base font-semibold text-slate-900">Life Cycles</h1>
      </div>

      <section className="rounded-xl border border-slate-200 bg-white p-4">
        <h2 className="text-[13px] font-semibold text-slate-900">Incident life cycle</h2>
        <p className="mt-1 text-xs text-slate-500">
          Tick the states an incident may move to from each state. The State list on an incident only offers the states ticked here.
        </p>

        <div className="mt-4 overflow-x-auto">
          <table className="w-full min-w-[520px] border-collapse text-xs">
            <thead>
              <tr className="bg-slate-50 text-left text-slate-600">
                <th className="border border-slate-200 px-3 py-2 font-semibold">From ↓ &nbsp; To →</th>
                {LIFECYCLE_STATES.map((s) => (
                  <th key={s} className="border border-slate-200 px-3 py-2 text-center font-semibold">
                    {LIFECYCLE_LABEL[s]}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {LIFECYCLE_STATES.map((from) => (
                <tr key={from}>
                  <th className="border border-slate-200 bg-slate-50 px-3 py-2 text-left font-semibold text-slate-700">{LIFECYCLE_LABEL[from]}</th>
                  {LIFECYCLE_STATES.map((to) => (
                    <td key={to} className="border border-slate-200 px-3 py-2 text-center">
                      {from === to ? (
                        <span className="text-slate-300">—</span>
                      ) : (
                        <input
                          type="checkbox"
                          checked={draft[from].includes(to)}
                          onChange={() => toggle(from, to)}
                          aria-label={`${LIFECYCLE_LABEL[from]} to ${LIFECYCLE_LABEL[to]}`}
                          className="h-4 w-4 accent-primary-600"
                        />
                      )}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="mt-4 flex flex-wrap items-center gap-2">
          <button className={darkBtn} onClick={save} disabled={!dirty}>
            Save
          </button>
          <button className={btn} onClick={() => setDraft(saved)} disabled={!dirty}>
            Discard changes
          </button>
          <button
            className={btn}
            onClick={() => {
              setDraft(defaultTransitions());
              setNotice(null);
            }}
          >
            Reset to default
          </button>
          {notice && <span className="text-xs text-slate-600">{notice}</span>}
        </div>
      </section>
    </div>
  );
}
