import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';

const TEMPLATES_KEY = 'dex.notificationTemplates.v2';
const RULES_KEY = 'dex.notificationRules.v1';

const selectClass =
  'w-full rounded-md border border-slate-300 bg-white px-2 py-1.5 text-sm text-slate-800 focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500 disabled:bg-slate-100 disabled:text-slate-400';

/** Ticket events a template can be connected to. `type` matches the template type ids. */
const EVENTS = [
  { type: 'TICKET_CREATED', label: 'Ticket created', hint: 'A new ticket is raised', defaults: { requester: true, technician: false } },
  { type: 'TICKET_ASSIGNED', label: 'Ticket assigned', hint: 'A technician is assigned', defaults: { requester: true, technician: true } },
  { type: 'TICKET_STATUS', label: 'Status updated', hint: 'The ticket status changes', defaults: { requester: true, technician: false } },
  { type: 'TICKET_COMMENT', label: 'Comment added', hint: 'Someone replies on the ticket', defaults: { requester: true, technician: true } },
  { type: 'TICKET_RESOLVED', label: 'Ticket resolved', hint: 'The ticket is marked resolved', defaults: { requester: true, technician: false } },
  { type: 'TICKET_CLOSED', label: 'Ticket closed', hint: 'The ticket is closed', defaults: { requester: true, technician: false } },
  { type: 'SLA_REMINDER', label: 'SLA reminder', hint: 'One hour before the SLA target', defaults: { requester: false, technician: true } },
  { type: 'SLA_BREACHED', label: 'SLA breached', hint: 'The SLA target was missed', defaults: { requester: false, technician: true } },
] as const;

interface StoredTemplate {
  id: string;
  name: string;
  type: string;
  channel: 'EMAIL' | 'IN_APP';
  active: boolean;
}

interface Rule {
  enabled: boolean;
  /** Empty string = use whichever template of this type is currently active. */
  templateId: string;
  requester: boolean;
  technician: boolean;
}

type Rules = Record<string, Rule>;

const defaultRules = (): Rules =>
  Object.fromEntries(
    EVENTS.map((e) => [e.type, { enabled: false, templateId: '', ...e.defaults }]),
  );

function loadTemplates(): StoredTemplate[] {
  try {
    const raw = localStorage.getItem(TEMPLATES_KEY);
    if (raw) return JSON.parse(raw) as StoredTemplate[];
  } catch {
    /* no templates yet */
  }
  return [];
}

function loadRules(): Rules {
  try {
    const raw = localStorage.getItem(RULES_KEY);
    if (raw) return { ...defaultRules(), ...(JSON.parse(raw) as Rules) };
  } catch {
    /* use defaults */
  }
  return defaultRules();
}

export default function NotificationRulesPage() {
  const templates = useMemo(loadTemplates, []);
  const [rules, setRules] = useState<Rules>(loadRules);
  const [saved, setSaved] = useState<string>(JSON.stringify(rules));
  const dirty = JSON.stringify(rules) !== saved;

  useEffect(() => {
    if (!dirty) return;
    const warn = (event: BeforeUnloadEvent) => event.preventDefault();
    window.addEventListener('beforeunload', warn);
    return () => window.removeEventListener('beforeunload', warn);
  }, [dirty]);

  const update = (type: string, patch: Partial<Rule>) =>
    setRules((current) => ({ ...current, [type]: { ...current[type], ...patch } }));

  const save = () => {
    try {
      localStorage.setItem(RULES_KEY, JSON.stringify(rules));
    } catch {
      /* storage unavailable */
    }
    setSaved(JSON.stringify(rules));
  };

  return (
    <div className="mx-auto max-w-5xl space-y-4 p-6">
      <div>
        <nav className="text-xs text-slate-500">
          <Link to="/setup" className="hover:underline">Setup</Link> › Automation › Notification Rules
        </nav>
        <h1 className="mt-1 text-lg font-semibold text-slate-900">Notification Rules</h1>
        <p className="text-sm text-slate-500">
          Connect templates to ticket events and choose who receives the email.{' '}
          <Link to="/setup/automation/notification-templates" className="text-primary-600 hover:underline">
            Manage templates
          </Link>
        </p>
      </div>

      <ol className="flex flex-wrap items-center gap-2 text-xs text-slate-500">
        <li className="rounded-full bg-slate-100 px-3 py-1">1. Notification Templates</li>
        <li>→</li>
        <li className="rounded-full bg-primary-50 px-3 py-1 font-medium text-primary-700">2. Notification Rules</li>
        <li>→</li>
        <li className="rounded-full bg-slate-100 px-3 py-1">3. Email sent to user or technician</li>
      </ol>

      <div className="overflow-hidden rounded-lg border border-slate-200 bg-white">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500">
            <tr>
              <th className="px-4 py-2 font-medium">Event</th>
              <th className="px-4 py-2 font-medium">Template</th>
              <th className="px-4 py-2 font-medium">Send to</th>
              <th className="px-4 py-2 text-center font-medium">On</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {EVENTS.map((event) => {
              const rule = rules[event.type];
              const options = templates.filter((t) => t.type === event.type && t.channel === 'EMAIL');
              const active = options.find((t) => t.active);
              const missing = rule.enabled && !rule.templateId && !active;
              const noRecipient = rule.enabled && !rule.requester && !rule.technician;
              return (
                <tr key={event.type} className={rule.enabled ? '' : 'bg-slate-50/50'}>
                  <td className="px-4 py-3">
                    <div className="font-medium text-slate-800">{event.label}</div>
                    <div className="text-xs text-slate-500">{event.hint}</div>
                  </td>
                  <td className="px-4 py-3">
                    <select
                      value={rule.templateId}
                      onChange={(e) => update(event.type, { templateId: e.target.value })}
                      disabled={!rule.enabled}
                      className={selectClass}
                    >
                      <option value="">Active template{active ? ` (${active.name})` : ''}</option>
                      {options.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
                    </select>
                    {missing && <p className="mt-1 text-xs text-amber-600">No active template for this event.</p>}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex gap-4">
                      {(['requester', 'technician'] as const).map((who) => (
                        <label key={who} className="flex items-center gap-1.5 text-slate-700">
                          <input
                            type="checkbox"
                            checked={rule[who]}
                            disabled={!rule.enabled}
                            onChange={(e) => update(event.type, { [who]: e.target.checked })}
                            className="h-4 w-4 rounded border-slate-300 text-primary-600 focus:ring-primary-500"
                          />
                          {who === 'requester' ? 'User' : 'Technician'}
                        </label>
                      ))}
                    </div>
                    {noRecipient && <p className="mt-1 text-xs text-amber-600">Pick at least one recipient.</p>}
                  </td>
                  <td className="px-4 py-3 text-center">
                    <input
                      type="checkbox"
                      checked={rule.enabled}
                      onChange={(e) => update(event.type, { enabled: e.target.checked })}
                      aria-label={`Enable ${event.label} notification`}
                      className="h-4 w-4 rounded border-slate-300 text-primary-600 focus:ring-primary-500"
                    />
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <div className="flex items-center gap-3">
        <button
          onClick={save}
          disabled={!dirty}
          className="rounded-md bg-primary-600 px-5 py-2 text-sm font-medium text-white hover:bg-primary-700 disabled:opacity-50"
        >
          Save rules
        </button>
        <button
          onClick={() => setRules(JSON.parse(saved) as Rules)}
          disabled={!dirty}
          className="rounded-md border border-slate-300 px-5 py-2 text-sm text-slate-700 hover:bg-slate-50 disabled:opacity-50"
        >
          Cancel
        </button>
        {!dirty && <span className="text-sm text-slate-400">All changes saved.</span>}
      </div>
    </div>
  );
}
