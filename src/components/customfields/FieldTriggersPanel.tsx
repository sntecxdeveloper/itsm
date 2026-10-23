import { useCallback, useEffect, useState } from 'react';
import api from '../../api/axios';
import { getGroups } from '../../api/groupApi';
import { Button } from '../ui/Button';
import { toast } from '../common/Toast';
import { getErrorMessage } from '../../utils/errorHandler';
import type { CustomFieldDef } from '../../api/customFieldApi';

interface Trigger {
  id: number;
  fieldKey: string;
  operator: 'EQUALS' | 'CONTAINS' | 'FILLED';
  matchValue?: string | null;
  action: 'SET_PRIORITY' | 'ASSIGN_GROUP' | 'RUN_SCRIPT' | 'NOTIFY_GROUP';
  actionValue: string;
  active: boolean;
}

interface ApiResponse<T> {
  data: T;
}

const ACTIONS = [
  { value: 'SET_PRIORITY', label: 'set the priority to' },
  { value: 'ASSIGN_GROUP', label: 'assign it to the group (e.g. approvers)' },
  { value: 'NOTIFY_GROUP', label: 'email the group' },
  { value: 'RUN_SCRIPT', label: 'run fix script # on its computer' },
] as const;

/** "When a ticket field gets this value, do that" rules, for administrators. */
export default function FieldTriggersPanel({ fields }: { fields: CustomFieldDef[] }) {
  const [triggers, setTriggers] = useState<Trigger[]>([]);
  const [groups, setGroups] = useState<{ id: number; name: string }[]>([]);
  const [draft, setDraft] = useState({ fieldKey: '', operator: 'FILLED', matchValue: '', action: 'SET_PRIORITY', actionValue: 'HIGH' });

  const load = useCallback(async () => {
    try {
      setTriggers((await api.get<ApiResponse<Trigger[]>>('/custom-fields/triggers')).data.data);
    } catch (err) {
      toast(getErrorMessage(err), 'error');
    }
  }, []);
  useEffect(() => {
    void load();
    getGroups().then((g) => setGroups(g.map((x) => ({ id: x.id, name: x.name })))).catch(() => undefined);
  }, [load]);

  const add = async () => {
    try {
      await api.post('/custom-fields/triggers', { ...draft, fieldKey: draft.fieldKey || fields[0]?.key, matchValue: draft.operator === 'FILLED' ? null : draft.matchValue, active: true });
      await load();
      toast('Trigger added', 'success');
    } catch (err) {
      toast(getErrorMessage(err), 'error');
    }
  };

  const fieldLabel = (k: string) => fields.find((f) => f.key === k)?.label ?? k;
  const describe = (t: Trigger) => {
    const when = t.operator === 'FILLED' ? 'is filled in / ticked' : t.operator === 'EQUALS' ? `is "${t.matchValue}"` : `contains "${t.matchValue}"`;
    const what =
      t.action === 'SET_PRIORITY' ? `set priority ${t.actionValue}` :
      t.action === 'RUN_SCRIPT' ? `run fix script #${t.actionValue} on the ticket's computer` :
      `${t.action === 'ASSIGN_GROUP' ? 'assign to' : 'email'} ${groups.find((g) => String(g.id) === t.actionValue)?.name ?? `group ${t.actionValue}`}`;
    return `When "${fieldLabel(t.fieldKey)}" ${when}: ${what}`;
  };

  if (fields.length === 0) return null;
  const sel = 'h-8 rounded border border-slate-300 bg-white px-2 text-[12px]';

  return (
    <section className="space-y-3 rounded-xl border border-line bg-panel p-5">
      <div>
        <h3 className="text-sm font-semibold text-slate-800">Triggers</h3>
        <p className="text-[12px] text-slate-500">When a ticket field gets a value, DEX acts at once. Each trigger fires when its condition becomes true.</p>
      </div>
      <ul className="space-y-1.5 text-[13px]">
        {triggers.map((t) => (
          <li key={t.id} className="flex items-center justify-between gap-2 rounded-lg border border-line px-3 py-2">
            <span className="text-slate-700">{describe(t)}</span>
            <button
              type="button"
              className="text-[12px] text-red-600 hover:text-red-700"
              onClick={() => void api.delete(`/custom-fields/triggers/${t.id}`).then(load).catch((err) => toast(getErrorMessage(err), 'error'))}
            >
              Remove
            </button>
          </li>
        ))}
        {triggers.length === 0 && <li className="text-[12px] text-slate-400">No triggers yet.</li>}
      </ul>
      <div className="flex flex-wrap items-center gap-2 rounded-lg bg-slate-50 p-3 text-[12px] text-slate-700">
        When
        <select value={draft.fieldKey || fields[0]?.key} onChange={(e) => setDraft({ ...draft, fieldKey: e.target.value })} className={sel} aria-label="Field">
          {fields.map((f) => (
            <option key={f.key} value={f.key}>
              {f.label}
            </option>
          ))}
        </select>
        <select value={draft.operator} onChange={(e) => setDraft({ ...draft, operator: e.target.value })} className={sel} aria-label="Condition">
          <option value="FILLED">is filled in / ticked</option>
          <option value="EQUALS">is</option>
          <option value="CONTAINS">contains</option>
        </select>
        {draft.operator !== 'FILLED' && <input value={draft.matchValue} onChange={(e) => setDraft({ ...draft, matchValue: e.target.value })} placeholder="value" aria-label="Value" className={`${sel} w-32`} />}
        then
        <select value={draft.action} onChange={(e) => setDraft({ ...draft, action: e.target.value, actionValue: e.target.value === 'SET_PRIORITY' ? 'HIGH' : '' })} className={sel} aria-label="Action">
          {ACTIONS.map((a) => (
            <option key={a.value} value={a.value}>
              {a.label}
            </option>
          ))}
        </select>
        {draft.action === 'SET_PRIORITY' && (
          <select value={draft.actionValue} onChange={(e) => setDraft({ ...draft, actionValue: e.target.value })} className={sel} aria-label="Priority">
            {['CRITICAL', 'HIGH', 'MEDIUM', 'LOW'].map((p) => (
              <option key={p} value={p}>
                {p.charAt(0) + p.slice(1).toLowerCase()}
              </option>
            ))}
          </select>
        )}
        {(draft.action === 'ASSIGN_GROUP' || draft.action === 'NOTIFY_GROUP') && (
          <select value={draft.actionValue} onChange={(e) => setDraft({ ...draft, actionValue: e.target.value })} className={sel} aria-label="Group">
            <option value="">choose a group…</option>
            {groups.map((g) => (
              <option key={g.id} value={g.id}>
                {g.name}
              </option>
            ))}
          </select>
        )}
        {draft.action === 'RUN_SCRIPT' && <input value={draft.actionValue} onChange={(e) => setDraft({ ...draft, actionValue: e.target.value })} placeholder="script id" aria-label="Fix script id" className={`${sel} w-24`} />}
        <Button size="sm" onClick={() => void add()}>
          Add trigger
        </Button>
      </div>
    </section>
  );
}
