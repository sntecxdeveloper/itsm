import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { Link } from 'react-router-dom';
import RichTextEditor, { type RichTextEditorHandle } from '../../components/RichTextEditor';
import { isHtmlBody, previewHtml, renderBody } from '../../utils/emailHtml';
import { sendTestMail } from '../../api/mailSettingsApi';
import { getCategoryMap } from '../../utils/categoryStore';
import { getUsers, type ManagedUser } from '../../api/userApi';

const STORAGE_KEY = 'dex.notificationTemplates.v2';

type Channel = 'EMAIL' | 'IN_APP';

interface TemplateType {
  id: string;
  label: string;
  variables: Record<string, string>;
  subject: string;
  body: string;
}

const TICKET = {
  'ticket.id': 'INC-1042',
  'ticket.title': 'Laptop will not boot',
  'requester.name': 'Asha Rao',
  'ticket.link': 'https://dex.example.com/tickets/incidents/1042',
  'raise.link': 'mailto:servicedesk@example.com?subject=[ITSM] New incident',
};

const TYPES: TemplateType[] = [
  {
    id: 'TICKET_CREATED', label: 'Ticket created',
    variables: { ...TICKET, 'ticket.priority': 'High' },
    subject: '[{{ticket.id}}] New ticket: {{ticket.title}}',
    body: `Hi {{requester.name}},

Your ticket {{ticket.id}} ({{ticket.title}}) has been created with {{ticket.priority}} priority.

View your ticket: {{ticket.link}}
Need to raise another ticket? Email it: {{raise.link}}

Thanks,
DEX IT Operations`,
  },
  {
    id: 'TICKET_ASSIGNED', label: 'Ticket assigned',
    variables: { ...TICKET, 'technician.name': 'Ravi Kumar' },
    subject: '[{{ticket.id}}] Assigned to {{technician.name}}',
    body: `Hi {{requester.name}},

{{technician.name}} is now working on {{ticket.id}} ({{ticket.title}}).

DEX IT Operations`,
  },
  {
    id: 'TICKET_STATUS', label: 'Status updated',
    variables: { ...TICKET, 'ticket.status': 'In Progress', 'technician.name': 'Ravi Kumar' },
    subject: '[{{ticket.id}}] Status changed to {{ticket.status}}',
    body: `Hi {{requester.name}},

The status of {{ticket.id}} ({{ticket.title}}) is now {{ticket.status}}.

DEX IT Operations`,
  },
  {
    id: 'TICKET_COMMENT', label: 'Comment added',
    variables: { ...TICKET, 'comment.author': 'Ravi Kumar', 'comment.text': 'Please restart and share the error code.' },
    subject: '[{{ticket.id}}] New comment from {{comment.author}}',
    body: `{{comment.author}} commented on {{ticket.id}} ({{ticket.title}}):

"{{comment.text}}"`,
  },
  {
    id: 'TICKET_RESOLVED', label: 'Ticket resolved',
    variables: { ...TICKET, 'technician.name': 'Ravi Kumar', 'resolution.note': 'Replaced the faulty battery.' },
    subject: '[{{ticket.id}}] Resolved: {{ticket.title}}',
    body: `Hi {{requester.name}},

{{ticket.id}} has been resolved by {{technician.name}}.
Resolution: {{resolution.note}}

Reply if the issue continues.`,
  },
  {
    id: 'TICKET_CLOSED', label: 'Ticket closed',
    variables: { ...TICKET },
    subject: '[{{ticket.id}}] Closed',
    body: `Hi {{requester.name}},

Ticket {{ticket.id}} ({{ticket.title}}) is now closed. Thank you.`,
  },
  {
    id: 'SLA_REMINDER', label: 'SLA reminder',
    variables: { ...TICKET, 'ticket.priority': 'High', 'sla.due': '2 PM today' },
    subject: '[{{ticket.id}}] SLA due {{sla.due}}',
    body: '{{ticket.id}} ({{ticket.title}}, {{ticket.priority}}) must be resolved by {{sla.due}}.',
  },
  {
    id: 'SLA_BREACHED', label: 'SLA breached',
    variables: { ...TICKET, 'ticket.priority': 'High', 'sla.due': '2 PM today' },
    subject: '[{{ticket.id}}] SLA breached',
    body: 'The SLA target ({{sla.due}}) for {{ticket.id}} ({{ticket.title}}) has been missed. Please escalate.',
  },
  {
    id: 'APPROVAL_REQUEST', label: 'Approval requested',
    variables: { 'approver.name': 'Meena Iyer', 'request.title': 'New laptop for design team', 'requester.name': 'Asha Rao', 'approval.link': 'https://dex.example.com/approvals/77' },
    subject: 'Approval needed: {{request.title}}',
    body: `Hi {{approver.name}},

{{requester.name}} is waiting for your approval on "{{request.title}}".
Review it here: {{approval.link}}`,
  },
  {
    id: 'ASSET_ASSIGNED', label: 'Asset assigned',
    variables: { 'user.name': 'Asha Rao', 'asset.name': 'Dell Latitude 5440', 'asset.tag': 'AST-2231' },
    subject: 'Asset assigned: {{asset.name}}',
    body: `Hi {{user.name}},

{{asset.name}} ({{asset.tag}}) has been assigned to you.`,
  },
  {
    id: 'DEVICE_ALERT', label: 'Device alert',
    variables: { 'device.name': 'LAPTOP-042', 'alert.name': 'High CPU usage', 'alert.severity': 'Critical' },
    subject: '[{{alert.severity}}] {{alert.name}} on {{device.name}}',
    body: 'Alert "{{alert.name}}" ({{alert.severity}}) was raised on {{device.name}}.',
  },
  {
    id: 'PASSWORD_RESET', label: 'Password reset',
    variables: { 'user.name': 'Asha Rao', 'reset.link': 'https://dex.example.com/reset/abc123', 'reset.expiry': '30 minutes' },
    subject: 'Reset your DEX password',
    body: `Hi {{user.name}},

Use this link to reset your password: {{reset.link}}
It expires in {{reset.expiry}}.

If you did not ask for this, ignore this email.`,
  },
  {
    id: 'WELCOME', label: 'Welcome',
    variables: { 'user.name': 'Asha Rao', 'login.link': 'https://dex.example.com/login' },
    subject: 'Welcome to DEX',
    body: `Hi {{user.name}},

Your DEX account is ready. Sign in here: {{login.link}}`,
  },
];

interface Condition {
  field: string;
  op: string;
  value: string;
  /** How this row joins the previous one. */
  join: 'AND' | 'OR';
}

interface Template {
  id: string;
  name: string;
  type: string;
  channel: Channel;
  subject: string;
  body: string;
  active: boolean;
  updatedAt: string;
  table?: string;
  category?: string;
  allowDigest?: boolean;
  sendWhen?: 'RECORD' | 'EVENT';
  inserted?: boolean;
  updated?: boolean;
  conditions?: Condition[];
  /** Who will receive. When absent, the Notification Rules page decides. */
  who?: { requester: boolean; technician: boolean; extra: string; users?: string[]; groups?: string[]; assignmentGroup?: boolean; subscribable?: boolean };
}

const TABLES = ['Incident', 'Problem', 'Change request', 'Service request', 'Asset', 'Device', 'User'];
const CATEGORIES = ['Uncategorized', 'Ticket updates', 'Approvals', 'SLA', 'Alerts', 'Account'];
const CONDITION_FIELDS = ['Priority', 'State', 'Category', 'Assignment group', 'Assigned to', 'Channel'];
const CONDITION_OPS = [
  'is', 'is not', 'is one of', 'is not one of', 'is empty', 'is not empty', 'less than', 'greater than',
  'less than or is', 'greater than or is', 'between', 'is anything', 'changes', 'changes from', 'changes to',
  'is same', 'is different',
];
/** Operators that need no value to compare against. */
const NO_VALUE_OPS = ['is empty', 'is not empty', 'is anything', 'changes'];
/** Operators that take free text (a list, a range) instead of one pick from the field's values. */
const TEXT_VALUE_OPS = ['is one of', 'is not one of', 'between'];
const FIELD_VALUES: Record<string, string[]> = {
  State: ['New', 'In Progress', 'Resolved', 'Closed'],
  Priority: ['1 - Critical', '2 - High', '3 - Moderate', '4 - Low'],
  Category: Object.keys(getCategoryMap()),
  'Assignment group': ['Service Desk', 'Network', 'Hardware', 'Software', 'Database'],
  Channel: ['Self-service', 'Phone', 'Email', 'Chat', 'Walk-in'],
  'Assigned to': [],
};

const now = () => new Date().toISOString();
const uid = () => `tpl-${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;

const seed = (): Template[] =>
  TYPES.map((t) => ({
    id: uid(), name: `Default - ${t.label.toLowerCase()}`, type: t.id, channel: 'EMAIL' as Channel,
    subject: t.subject, body: t.body, active: true, updatedAt: now(),
  }));

function load(): Template[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) return JSON.parse(raw) as Template[];
  } catch {
    /* fall through to defaults */
  }
  return seed();
}

const render = (text: string, vars: Record<string, string>) =>
  text.replace(/\{\{\s*([\w.]+)\s*\}\}/g, (match, key: string) => vars[key] ?? match);

const typeOf = (id: string) => TYPES.find((t) => t.id === id) ?? TYPES[0];
const validEmail = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const control =
  'w-full rounded border border-slate-300 bg-white px-2 py-1.5 text-sm text-slate-800 focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500';
const btn =
  'rounded border border-slate-300 bg-white px-3 py-1.5 text-[13px] font-medium text-slate-800 hover:bg-slate-50 disabled:opacity-50';

function Field({ label, required, children }: { label: string; required?: boolean; children: ReactNode }) {
  return (
    <div className="grid grid-cols-[110px_1fr] items-center gap-3">
      <label className="text-right text-sm text-slate-700">
        {required && <span className="mr-1 text-red-500">*</span>}
        {label}
      </label>
      {children}
    </div>
  );
}

const Banner = ({ children }: { children: ReactNode }) => (
  <div className="rounded border border-sky-200 bg-sky-50 px-4 py-3 text-sm text-slate-700">{children}</div>
);

const TABS = ['When to send', 'Who will receive', 'What it will contain'] as const;
type Tab = (typeof TABS)[number];

export default function NotificationTemplatesPage() {
  const [templates, setTemplates] = useState<Template[]>(load);
  const [draft, setDraft] = useState<Template | null>(null);
  const [isNew, setIsNew] = useState(false);
  const [tab, setTab] = useState<Tab>('When to send');
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [testTo, setTestTo] = useState('');
  const [sending, setSending] = useState(false);
  const [sendResult, setSendResult] = useState<{ ok: boolean; text: string } | null>(null);
  const [systemUsers, setSystemUsers] = useState<ManagedUser[]>([]);
  const editor = useRef<RichTextEditorHandle>(null);

  useEffect(() => {
    getUsers()
      .then((list) => setSystemUsers(list.filter((u) => u.enabled && u.email)))
      .catch(() => setSystemUsers([]));
  }, []);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(templates));
    } catch {
      /* storage unavailable */
    }
  }, [templates]);

  const type = draft ? typeOf(draft.type) : null;
  const saved = draft ? templates.find((t) => t.id === draft.id) : undefined;
  const dirty = draft !== null && (isNew || JSON.stringify(draft) !== JSON.stringify(saved));
  const sorted = useMemo(() => [...templates].sort((a, b) => (a.updatedAt < b.updatedAt ? 1 : -1)), [templates]);

  const open = (t: Template, fresh = false) => {
    setDraft({ ...t });
    setIsNew(fresh);
    setTab('When to send');
    setMessage(null);
    setError(null);
    setSendResult(null);
  };

  const create = () => {
    const base = TYPES[0];
    open(
      {
        id: uid(), name: '', type: base.id, channel: 'EMAIL', subject: base.subject, body: base.body, active: true,
        updatedAt: now(), table: 'Incident', category: 'Ticket updates', allowDigest: false, sendWhen: 'RECORD',
        inserted: true, updated: false, conditions: [], who: { requester: true, technician: false, extra: '' },
      },
      true,
    );
  };

  const close = () => {
    if (dirty && !window.confirm('Discard unsaved changes?')) return;
    setDraft(null);
  };

  const patch = (p: Partial<Template>) => draft && setDraft({ ...draft, ...p });

  const save = () => {
    if (!draft) return;
    if (!draft.name.trim()) return setError('Name is required.');
    const extra = (draft.who?.extra ?? '').split(/[,;\s]+/).filter(Boolean);
    const bad = extra.find((a) => !validEmail.test(a));
    if (bad) {
      setTab('Who will receive');
      return setError(`Invalid email address: ${bad}`);
    }
    const next = { ...draft, name: draft.name.trim(), updatedAt: now() };
    // Only one active notification per event and channel: activating this one switches the others off.
    setTemplates((list) => {
      const others = list
        .filter((t) => t.id !== next.id)
        .map((t) => (next.active && t.type === next.type && t.channel === next.channel ? { ...t, active: false } : t));
      return [next, ...others];
    });
    setDraft(next);
    setIsNew(false);
    setError(null);
    setMessage('Notification saved.');
  };

  const remove = () => {
    if (!draft || !window.confirm(`Delete "${draft.name || 'this notification'}"?`)) return;
    setTemplates((list) => list.filter((t) => t.id !== draft.id));
    setDraft(null);
  };

  const duplicate = () => {
    if (!draft) return;
    const copy = { ...draft, id: uid(), name: `${draft.name} (copy)`, active: false, updatedAt: now() };
    setTemplates((list) => [copy, ...list]);
    open(copy);
  };

  const sendTest = async () => {
    if (!draft || !type) return;
    setSending(true);
    setSendResult(null);
    try {
      await sendTestMail(testTo.trim(), {
        subject: render(draft.subject, type.variables),
        body: renderBody(draft.body, type.variables),
      });
      setSendResult({ ok: true, text: `Test email sent to ${testTo.trim()}.` });
    } catch (e) {
      const data = (e as { response?: { data?: { message?: string } } })?.response?.data;
      setSendResult({ ok: false, text: data?.message || (e instanceof Error ? e.message : 'The test email was not sent') });
    } finally {
      setSending(false);
    }
  };

  const setCondition = (index: number, p: Partial<Condition>) =>
    draft && patch({ conditions: (draft.conditions ?? []).map((c, i) => (i === index ? { ...c, ...p } : c)) });
  /** Adds a row after `after` (or at the end), joined to the previous row with AND / OR. */
  const addCondition = (join: 'AND' | 'OR', after?: number) => {
    if (!draft) return;
    const list = draft.conditions ?? [];
    const at = after === undefined ? list.length : after + 1;
    const row: Condition = { field: 'State', op: 'is', value: '', join };
    patch({ conditions: [...list.slice(0, at), row, ...list.slice(at)] });
  };

  /* ------------------------------------------------------------------ list */
  if (!draft) {
    return (
      <div className="-mx-1">
        <div className="flex flex-wrap items-center gap-3 border-b border-slate-200 bg-slate-100 px-3 py-2">
          <Link to="/setup" className={btn} aria-label="Back to Setup">← Back</Link>
          <div>
            <h1 className="text-[15px] font-semibold text-slate-800">Notifications</h1>
            <p className="text-xs text-slate-500">Setup › Automation › Notification Templates</p>
          </div>
          <button onClick={create} className="ml-auto rounded bg-primary-600 px-4 py-1.5 text-[13px] font-medium text-white hover:bg-primary-700">
            New
          </button>
        </div>
        <div className="overflow-x-auto bg-white">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-left text-xs font-semibold text-slate-700">
              <tr>
                {['Name', 'Table', 'Event', 'Category', 'Channel', 'Active', 'Updated'].map((h) => (
                  <th key={h} className="whitespace-nowrap px-3 py-2">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {sorted.map((t) => (
                <tr key={t.id} onClick={() => open(t)} className="cursor-pointer hover:bg-slate-50">
                  <td className="px-3 py-2 font-medium text-primary-700">{t.name}</td>
                  <td className="px-3 py-2 text-slate-600">{t.table ?? 'Incident'}</td>
                  <td className="px-3 py-2 text-slate-600">{typeOf(t.type).label}</td>
                  <td className="px-3 py-2 text-slate-600">{t.category ?? 'Uncategorized'}</td>
                  <td className="px-3 py-2 text-slate-600">{t.channel === 'EMAIL' ? 'Email' : 'In-app'}</td>
                  <td className="px-3 py-2">{t.active ? <span className="text-green-700">true</span> : <span className="text-slate-400">false</span>}</td>
                  <td className="whitespace-nowrap px-3 py-2 text-slate-500">{t.updatedAt.replace('T', ' ').slice(0, 16)}</td>
                </tr>
              ))}
              {sorted.length === 0 && (
                <tr><td colSpan={7} className="px-3 py-10 text-center text-slate-400">No notifications yet. Click New.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    );
  }

  /* ------------------------------------------------------------------ form */
  const who = draft.who ?? { requester: false, technician: false, extra: '' };
  const conditions = draft.conditions ?? [];

  return (
    <div className="-mx-1">
      <div className="flex flex-wrap items-center gap-3 border-b border-slate-200 bg-slate-100 px-3 py-2">
        <button onClick={close} className={btn} aria-label="Back to notifications">←</button>
        <div>
          <h1 className="text-[15px] font-semibold leading-tight text-slate-800">Notification</h1>
          <p className="text-xs text-slate-500">{isNew ? 'New record' : draft.name}</p>
        </div>
        <div className="ml-auto flex gap-2">
          {!isNew && <button onClick={duplicate} className={btn}>Duplicate</button>}
          {!isNew && <button onClick={remove} className={`${btn} !border-red-200 !text-red-600`}>Delete</button>}
          <button onClick={save} disabled={!dirty} className="rounded bg-primary-600 px-4 py-1.5 text-[13px] font-medium text-white hover:bg-primary-700 disabled:opacity-50">
            {isNew ? 'Submit' : 'Update'}
          </button>
        </div>
      </div>

      {(error || message) && (
        <p className={`px-4 py-2 text-[13px] ${error ? 'bg-red-50 text-red-600' : 'bg-green-50 text-green-700'}`}>{error ?? message}</p>
      )}

      <div className="space-y-4 bg-white p-4">
        <Banner>
          Use Notifications to notify users about specific activities in DEX, such as updates to incidents or change requests.
          Notifications let administrators specify
          <ul className="ml-5 mt-1 list-disc">
            <li>When to send the notification</li>
            <li>Who receives the notification</li>
            <li>What content is in the notification</li>
          </ul>
        </Banner>

        <div className="grid gap-x-12 gap-y-3 lg:grid-cols-2">
          <div className="space-y-3">
            <Field label="Name" required>
              <input autoFocus={isNew} value={draft.name} onChange={(e) => patch({ name: e.target.value })} className={control} />
            </Field>
            <Field label="Table" required>
              <select value={draft.table ?? 'Incident'} onChange={(e) => patch({ table: e.target.value })} className={control}>
                {TABLES.map((t) => <option key={t}>{t}</option>)}
              </select>
            </Field>
            <Field label="Category" required>
              <select value={draft.category ?? 'Uncategorized'} onChange={(e) => patch({ category: e.target.value })} className={control}>
                {CATEGORIES.map((c) => <option key={c}>{c}</option>)}
              </select>
            </Field>
          </div>
          <div className="space-y-3">
            <Field label="Application">
              <input disabled value="Global" className={`${control} bg-slate-100 text-slate-500`} />
            </Field>
            <Field label="Active">
              <input type="checkbox" checked={draft.active} onChange={(e) => patch({ active: e.target.checked })} className="h-4 w-4 justify-self-start" />
            </Field>
            <Field label="Allow Digest">
              <input type="checkbox" checked={draft.allowDigest ?? false} onChange={(e) => patch({ allowDigest: e.target.checked })} className="h-4 w-4 justify-self-start" />
            </Field>
          </div>
        </div>

        <div>
          <div className="flex gap-1 border-b border-slate-200">
            {TABS.map((k) => (
              <button
                key={k}
                onClick={() => setTab(k)}
                className={`rounded-t border border-b-0 px-4 py-2 text-sm ${tab === k ? 'border-slate-200 border-t-2 border-t-green-600 bg-white font-medium text-slate-900' : 'border-transparent bg-slate-100 text-slate-600 hover:bg-slate-200'}`}
              >
                {k}
              </button>
            ))}
          </div>

          <div className="space-y-4 border border-t-0 border-slate-200 p-4">
            {tab === 'When to send' && (
              <>
                <Banner>
                  Notifications can be sent (if the specified <b>Conditions</b> are met) under one of the following circumstances:
                  <ul className="ml-5 mt-1 list-disc">
                    <li>A record is <b>Inserted</b> or <b>Updated</b> into the <b>Table</b> specified above</li>
                    <li>The specified event is fired</li>
                  </ul>
                </Banner>
                <div className="grid gap-x-12 gap-y-3 lg:grid-cols-2">
                  <div className="space-y-3">
                    <Field label="Send when">
                      <select value={draft.sendWhen ?? 'RECORD'} onChange={(e) => patch({ sendWhen: e.target.value as 'RECORD' | 'EVENT' })} className={control}>
                        <option value="RECORD">Record inserted or updated</option>
                        <option value="EVENT">Event is fired</option>
                      </select>
                    </Field>
                    <Field label="Event" required>
                      <select
                        value={draft.type}
                        onChange={(e) => patch({ type: e.target.value, subject: draft.subject || typeOf(e.target.value).subject, body: draft.body || typeOf(e.target.value).body })}
                        className={control}
                      >
                        {TYPES.map((t) => <option key={t.id} value={t.id}>{t.label}</option>)}
                      </select>
                    </Field>
                  </div>
                  {(draft.sendWhen ?? 'RECORD') === 'RECORD' && (
                    <div className="space-y-3">
                      <Field label="Inserted">
                        <input type="checkbox" checked={draft.inserted ?? false} onChange={(e) => patch({ inserted: e.target.checked })} className="h-4 w-4 justify-self-start" />
                      </Field>
                      <Field label="Updated">
                        <input type="checkbox" checked={draft.updated ?? false} onChange={(e) => patch({ updated: e.target.checked })} className="h-4 w-4 justify-self-start" />
                      </Field>
                    </div>
                  )}
                </div>

                <div className="grid grid-cols-[110px_1fr] gap-3">
                  <span className="pt-2 text-right text-sm text-slate-700">Conditions</span>
                  <div className="space-y-2">
                    {conditions.map((c, i) => {
                      const options = FIELD_VALUES[c.field] ?? [];
                      const compareField = c.op === 'is same' || c.op === 'is different';
                      return (
                        <div key={i} className="flex flex-wrap items-center gap-2">
                          {i > 0 && <span className="w-9 text-xs font-semibold text-slate-500">{c.join}</span>}
                          <select value={c.field} onChange={(e) => setCondition(i, { field: e.target.value, value: '' })} className={`${control} !w-48`}>
                            {CONDITION_FIELDS.map((f) => <option key={f}>{f}</option>)}
                          </select>
                          <select value={c.op} onChange={(e) => setCondition(i, { op: e.target.value, value: '' })} className={`${control} !w-44`}>
                            {CONDITION_OPS.map((o) => <option key={o}>{o}</option>)}
                          </select>
                          {!NO_VALUE_OPS.includes(c.op) &&
                            (compareField ? (
                              <select value={c.value} onChange={(e) => setCondition(i, { value: e.target.value })} className={`${control} !w-52`}>
                                <option value="">-- None --</option>
                                {CONDITION_FIELDS.filter((f) => f !== c.field).map((f) => <option key={f}>{f}</option>)}
                              </select>
                            ) : TEXT_VALUE_OPS.includes(c.op) || options.length === 0 ? (
                              <input
                                value={c.value}
                                onChange={(e) => setCondition(i, { value: e.target.value })}
                                placeholder={c.op === 'between' ? 'from, to' : TEXT_VALUE_OPS.includes(c.op) ? 'value1, value2' : 'value'}
                                className={`${control} !w-52`}
                              />
                            ) : (
                              <select value={c.value} onChange={(e) => setCondition(i, { value: e.target.value })} className={`${control} !w-52`}>
                                <option value="">-- None --</option>
                                {options.map((o) => <option key={o}>{o}</option>)}
                              </select>
                            ))}
                          <button onClick={() => addCondition('AND', i)} className="rounded border border-primary-300 bg-white px-2.5 py-1 text-[12px] font-semibold text-primary-700 hover:bg-primary-50">AND</button>
                          <button onClick={() => addCondition('OR', i)} className="rounded border border-primary-300 bg-white px-2.5 py-1 text-[12px] font-semibold text-primary-700 hover:bg-primary-50">OR</button>
                          <button onClick={() => patch({ conditions: conditions.filter((_, x) => x !== i) })} className="rounded border border-slate-300 px-2 py-1 text-slate-500 hover:text-red-600" aria-label="Remove condition">✕</button>
                        </div>
                      );
                    })}
                    <div className="flex gap-2">
                      <button onClick={() => addCondition('AND')} className="rounded border border-primary-300 bg-white px-3 py-1.5 text-[13px] font-medium text-primary-700 hover:bg-primary-50">Add Filter Condition</button>
                      <button onClick={() => addCondition('OR')} className="rounded border border-primary-300 bg-white px-3 py-1.5 text-[13px] font-medium text-primary-700 hover:bg-primary-50">Add &quot;OR&quot; Clause</button>
                    </div>
                    <p className="text-xs text-slate-400">Conditions are saved with the notification. Until the backend evaluates them, the notification is sent whenever its event happens.</p>
                  </div>
                </div>
              </>
            )}

            {tab === 'Who will receive' && (
              <>
                <Banner>
                  Notifications can be sent to specific <b>Users</b> and <b>Groups</b> or to <b>User/Groups in fields</b> on the
                  record that generated this notification.
                </Banner>
                <div className="grid grid-cols-[150px_1fr] items-start gap-x-3 gap-y-4">
                  <span className="pt-1.5 text-right text-sm text-slate-700">Users</span>
                  <div className="space-y-2">
                    <div className="flex flex-wrap gap-1.5">
                      {(who.users ?? []).map((email) => (
                        <span key={email} className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-2.5 py-1 text-xs text-slate-700">
                          {systemUsers.find((u) => u.email === email)?.fullName || email}
                          <button onClick={() => patch({ who: { ...who, users: (who.users ?? []).filter((x) => x !== email) } })} aria-label={'Remove ' + email} className="text-slate-400 hover:text-red-600">✕</button>
                        </span>
                      ))}
                    </div>
                    <select
                      value=""
                      onChange={(e) => e.target.value && patch({ who: { ...who, users: [...(who.users ?? []), e.target.value] } })}
                      className={`${control} !w-64`}
                    >
                      <option value="">Add a user…</option>
                      {systemUsers.filter((u) => !(who.users ?? []).includes(u.email)).map((u) => (
                        <option key={u.id} value={u.email}>{u.fullName ? u.fullName + ' (' + u.username + ')' : u.username}</option>
                      ))}
                    </select>
                  </div>

                  <span className="pt-1.5 text-right text-sm text-slate-700">Groups</span>
                  <div className="space-y-2">
                    <div className="flex flex-wrap gap-1.5">
                      {(who.groups ?? []).map((g) => (
                        <span key={g} className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-2.5 py-1 text-xs text-slate-700">
                          {g}
                          <button onClick={() => patch({ who: { ...who, groups: (who.groups ?? []).filter((x) => x !== g) } })} aria-label={'Remove ' + g} className="text-slate-400 hover:text-red-600">✕</button>
                        </span>
                      ))}
                    </div>
                    <select
                      value=""
                      onChange={(e) => e.target.value && patch({ who: { ...who, groups: [...(who.groups ?? []), e.target.value] } })}
                      className={`${control} !w-64`}
                    >
                      <option value="">Add a group…</option>
                      {['Service Desk', 'Network', 'Hardware', 'Software', 'Database'].filter((g) => !(who.groups ?? []).includes(g)).map((g) => <option key={g}>{g}</option>)}
                    </select>
                    <p className="text-xs text-slate-400">Groups are saved; group members can&apos;t be emailed until the backend exposes their addresses.</p>
                  </div>

                  <span className="pt-0.5 text-right text-sm text-slate-700">Users/Groups in fields</span>
                  <div className="space-y-2">
                    <label className="flex items-center gap-2 text-sm text-slate-800">
                      <input type="checkbox" checked={who.requester} onChange={(e) => patch({ who: { ...who, requester: e.target.checked } })} className="h-4 w-4" />
                      Requester (the incident&apos;s Mail ID)
                    </label>
                    <label className="flex items-center gap-2 text-sm text-slate-800">
                      <input type="checkbox" checked={who.technician} onChange={(e) => patch({ who: { ...who, technician: e.target.checked } })} className="h-4 w-4" />
                      Assigned to
                    </label>
                    <label className="flex items-center gap-2 text-sm text-slate-800">
                      <input type="checkbox" checked={who.assignmentGroup ?? false} onChange={(e) => patch({ who: { ...who, assignmentGroup: e.target.checked } })} className="h-4 w-4" />
                      Assignment group
                    </label>
                  </div>

                  <span className="pt-0.5 text-right text-sm text-slate-700">Subscribable</span>
                  <input type="checkbox" checked={who.subscribable ?? false} onChange={(e) => patch({ who: { ...who, subscribable: e.target.checked } })} className="h-4 w-4 justify-self-start" />

                  <span className="pt-2 text-right text-sm text-slate-700">Additional emails</span>
                  <div>
                    <textarea
                      rows={2}
                      value={who.extra}
                      onChange={(e) => patch({ who: { ...who, extra: e.target.value } })}
                      placeholder="it-operations@example.com, service-desk@example.com"
                      className={control}
                    />
                    <p className="mt-1 text-xs text-slate-400">Separate addresses with commas.</p>
                  </div>

                  <span className="pt-2 text-right text-sm text-slate-700">Channel</span>
                  <select value={draft.channel} onChange={(e) => patch({ channel: e.target.value as Channel })} className={`${control} !w-48`}>
                    <option value="EMAIL">Email</option>
                    <option value="IN_APP">In-app</option>
                  </select>
                </div>
              </>
            )}

            {tab === 'What it will contain' && type && (
              <div className="grid gap-6 lg:grid-cols-2">
                <div className="space-y-3">
                  {draft.channel === 'EMAIL' && (
                    <label className="block text-sm font-medium text-slate-700">Subject
                      <input value={draft.subject} onChange={(e) => patch({ subject: e.target.value })} className={`${control} mt-1`} />
                    </label>
                  )}
                  <div className="text-sm font-medium text-slate-700">
                    Message
                    <div className="mt-1">
                      {draft.channel === 'EMAIL' ? (
                        <RichTextEditor ref={editor} value={draft.body} resetKey={draft.id} onChange={(body) => patch({ body })} />
                      ) : (
                        <textarea rows={10} value={draft.body} onChange={(e) => patch({ body: e.target.value })} className={`${control} font-mono`} />
                      )}
                    </div>
                  </div>
                  <div>
                    <p className="mb-1 text-xs font-medium text-slate-500">Select variables (click to insert at the cursor)</p>
                    <div className="max-h-56 overflow-auto rounded border border-slate-200 bg-slate-50 p-2 text-xs">
                      <details open>
                        <summary className="cursor-pointer font-medium text-slate-700">Fields</summary>
                        {Object.entries(
                          Object.keys(type.variables).reduce<Record<string, string[]>>((groups, key) => {
                            const group = key.includes('.') ? key.slice(0, key.indexOf('.')) : 'other';
                            (groups[group] ??= []).push(key);
                            return groups;
                          }, {}),
                        ).map(([group, keys]) => (
                          <details key={group} open className="ml-3 mt-1">
                            <summary className="cursor-pointer capitalize text-slate-600">{group}</summary>
                            <div className="ml-4 mt-1 flex flex-col items-start gap-1">
                              {keys.map((key) => (
                                <button
                                  key={key}
                                  onMouseDown={(e) => e.preventDefault()}
                                  onClick={() => (draft.channel === 'EMAIL' ? editor.current?.insertText(`{{${key}}}`) : patch({ body: `${draft.body}{{${key}}}` }))}
                                  className="rounded bg-white px-2 py-0.5 font-mono text-slate-700 hover:bg-slate-200"
                                >
                                  {`{{${key}}}`}
                                </button>
                              ))}
                            </div>
                          </details>
                        ))}
                      </details>
                    </div>
                  </div>
                </div>

                <div className="space-y-3">
                  <p className="text-sm font-medium text-slate-700">Preview <span className="font-normal text-slate-400">(sample data for “{type.label}”)</span></p>
                  <div className="overflow-hidden rounded border border-slate-200">
                    {draft.channel === 'EMAIL' && (
                      <div className="border-b border-slate-200 bg-slate-50 px-3 py-2 text-sm">
                        <span className="text-slate-500">Subject: </span>
                        <span className="font-medium text-slate-900">{render(draft.subject, type.variables) || '(empty)'}</span>
                      </div>
                    )}
                    {draft.channel === 'EMAIL' || isHtmlBody(draft.body) ? (
                      <div
                        className="px-3 py-3 text-sm text-slate-800 [&_a]:text-sky-700 [&_a]:underline [&_ol]:ml-5 [&_ol]:list-decimal [&_ul]:ml-5 [&_ul]:list-disc"
                        dangerouslySetInnerHTML={{ __html: previewHtml(draft.body, type.variables) || '(empty message)' }}
                      />
                    ) : (
                      <div className="whitespace-pre-wrap px-3 py-3 text-sm text-slate-800">{render(draft.body, type.variables) || '(empty message)'}</div>
                    )}
                  </div>
                  {draft.channel === 'EMAIL' && (
                    <div className="flex flex-wrap items-center gap-2">
                      <input type="email" value={testTo} onChange={(e) => setTestTo(e.target.value)} placeholder="Send a test to name@example.com" className={`${control} max-w-xs`} />
                      <button onClick={() => void sendTest()} disabled={sending || !validEmail.test(testTo.trim())} className="rounded bg-primary-600 px-4 py-1.5 text-[13px] font-medium text-white hover:bg-primary-700 disabled:opacity-50">
                        {sending ? 'Sending…' : 'Send test email'}
                      </button>
                      {sendResult && <span className={`text-sm ${sendResult.ok ? 'text-green-700' : 'text-red-600'}`}>{sendResult.text}</span>}
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
