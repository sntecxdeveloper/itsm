import { useMemo, useState, type FormEvent } from 'react';
import { Link } from 'react-router-dom';

type Tab = 'inbound' | 'templates' | 'quick' | 'ai';
type Rule = {
  id: number;
  name: string;
  condition: string;
  destination: 'Incident' | 'Service request';
  enabled: boolean;
};
type TextItem = { id: number; name: string; subject: string; body: string };

const inputClass =
  'w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm text-slate-800 focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500';

const initialRules: Rule[] = [
  { id: 1, name: 'Report a device issue', condition: 'Subject contains “device”', destination: 'Incident', enabled: true },
  { id: 2, name: 'Request software access', condition: 'Subject contains “access request”', destination: 'Service request', enabled: false },
];
const initialTemplates: TextItem[] = [
  {
    id: 1,
    name: 'Incident acknowledgement',
    subject: 'We received your request {{ticket.number}}',
    body: 'Hello {{caller.name}},\n\nWe have received your request and our team is reviewing it.\n\nYou can follow its progress using {{ticket.number}}.\n\nRegards,\n{{agent.name}}',
  },
  {
    id: 2,
    name: 'Resolution update',
    subject: 'Update on {{ticket.number}}',
    body: 'Hello {{caller.name}},\n\n{{ticket.short_description}}\n\nReply to this email if you need further assistance.\n\nRegards,\n{{agent.name}}',
  },
];
const initialQuickMessages: TextItem[] = [
  { id: 1, name: 'Request more information', subject: '', body: 'Could you share a few more details so we can investigate?\n\n- What were you trying to do?\n- When did the issue start?\n- Is there an error message?' },
  { id: 2, name: 'Troubleshooting steps', subject: '', body: 'Please try these steps and let us know if the issue continues:\n\n1. Restart the affected device.\n2. Confirm you are connected to the network.\n3. Try the action once more.' },
];

export default function MailFilterPage() {
  const [tab, setTab] = useState<Tab>('inbound');
  const [rules, setRules] = useState(initialRules);
  const [templates, setTemplates] = useState(initialTemplates);
  const [quickMessages, setQuickMessages] = useState(initialQuickMessages);
  const [selectedId, setSelectedId] = useState(1);
  const [newRuleOpen, setNewRuleOpen] = useState(false);
  const [ruleName, setRuleName] = useState('');
  const [ruleCondition, setRuleCondition] = useState('');
  const [ruleDestination, setRuleDestination] = useState<Rule['destination']>('Incident');
  const [aiEnabled, setAiEnabled] = useState(false);
  const [autoDraft, setAutoDraft] = useState(false);

  const selectedTextItems = tab === 'templates' ? templates : quickMessages;
  const selectedItem = useMemo(
    () => selectedTextItems.find((item) => item.id === selectedId) ?? selectedTextItems[0],
    [selectedId, selectedTextItems],
  );

  const updateTextItem = (key: 'name' | 'subject' | 'body', value: string) => {
    if (!selectedItem) return;
    const update = (items: TextItem[]) =>
      items.map((item) => item.id === selectedItem.id ? { ...item, [key]: value } : item);
    if (tab === 'templates') setTemplates(update);
    else setQuickMessages(update);
  };

  const addTextItem = () => {
    const items = tab === 'templates' ? templates : quickMessages;
    const item: TextItem = {
      id: Date.now(),
      name: tab === 'templates' ? 'New email template' : 'New quick message',
      subject: '',
      body: '',
    };
    if (tab === 'templates') setTemplates([...items, item]);
    else setQuickMessages([...items, item]);
    setSelectedId(item.id);
  };

  const addRule = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!ruleName.trim() || !ruleCondition.trim()) return;
    setRules((current) => [
      ...current,
      {
        id: Date.now(),
        name: ruleName.trim(),
        condition: ruleCondition.trim(),
        destination: ruleDestination,
        enabled: false,
      },
    ]);
    setRuleName('');
    setRuleCondition('');
    setNewRuleOpen(false);
  };

  return (
    <div className="space-y-5">
      <nav aria-label="Breadcrumb" className="flex flex-wrap items-center gap-2 text-xs">
        <Link to="/setup" className="text-primary-700 hover:underline">Setup</Link>
        <span className="text-slate-300">›</span>
        <Link to="/setup/mail/server" className="text-primary-700 hover:underline">Mail Settings</Link>
        <span className="text-slate-300">›</span>
        <span className="text-slate-500">Mail Filter</span>
      </nav>

      <header>
        <h1 className="text-lg font-semibold text-slate-900">Mail Filter</h1>
        <p className="mt-1 max-w-3xl text-sm text-slate-500">
          Shape how DEX handles incoming support emails and helps agents respond to customers.
        </p>
      </header>

      <div role="status" className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
        <p className="font-semibold">Preview only — mail filter backend is not connected</p>
        <p className="mt-1 text-amber-800">
          You can explore and edit this interface, but changes are temporary and will reset when you leave or reload.
          Rules will not process emails, templates will not be sent, and AI suggestions are not generated.
        </p>
      </div>

      <section className="grid gap-3 sm:grid-cols-3" aria-label="Mail filter capabilities">
        <StatusCard title="Incoming email" value="Rule designer" detail="Match messages and map fields to records" />
        <StatusCard title="Agent responses" value={`${templates.length} templates · ${quickMessages.length} messages`} detail="Reusable email content and reply snippets" />
        <StatusCard title="AI reply assist" value={aiEnabled ? 'Preview enabled' : 'Not connected'} detail="Backend AI response service required" />
      </section>

      <div className="overflow-x-auto border-b border-slate-200">
        <div role="tablist" aria-label="Mail filter tools" className="flex min-w-max gap-1">
          <TabButton active={tab === 'inbound'} onClick={() => setTab('inbound')}>Inbound rules</TabButton>
          <TabButton active={tab === 'templates'} onClick={() => { setTab('templates'); setSelectedId(templates[0]?.id ?? 0); }}>Email templates</TabButton>
          <TabButton active={tab === 'quick'} onClick={() => { setTab('quick'); setSelectedId(quickMessages[0]?.id ?? 0); }}>Quick messages</TabButton>
          <TabButton active={tab === 'ai'} onClick={() => setTab('ai')}>AI reply assist</TabButton>
        </div>
      </div>

      {tab === 'inbound' && (
        <section className="space-y-4 rounded-lg border border-slate-200 bg-white p-5">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <h2 className="text-base font-semibold text-slate-900">Inbound email rules</h2>
              <p className="mt-1 text-sm text-slate-500">
                Route incoming messages into incidents or service requests and map email content to record fields.
              </p>
            </div>
            <button type="button" onClick={() => setNewRuleOpen((open) => !open)} className="rounded-md bg-primary-600 px-3 py-2 text-sm font-medium text-white hover:bg-primary-700">
              {newRuleOpen ? 'Cancel' : 'Add rule'}
            </button>
          </div>

          {newRuleOpen && (
            <form onSubmit={addRule} className="grid gap-3 rounded-md border border-primary-100 bg-primary-50/40 p-4 sm:grid-cols-2">
              <label className="space-y-1 text-sm font-medium text-slate-700">
                Rule name
                <input required value={ruleName} onChange={(event) => setRuleName(event.target.value)} placeholder="e.g. Report a device issue" className={inputClass} />
              </label>
              <label className="space-y-1 text-sm font-medium text-slate-700">
                Match condition
                <input required value={ruleCondition} onChange={(event) => setRuleCondition(event.target.value)} placeholder="e.g. Subject contains “device”" className={inputClass} />
              </label>
              <label className="space-y-1 text-sm font-medium text-slate-700">
                Create record
                <select value={ruleDestination} onChange={(event) => setRuleDestination(event.target.value as Rule['destination'])} className={inputClass}>
                  <option>Incident</option>
                  <option>Service request</option>
                </select>
              </label>
              <div className="flex items-end">
                <button type="submit" className="rounded-md border border-primary-600 px-4 py-2 text-sm font-medium text-primary-700 hover:bg-white">Add draft rule</button>
              </div>
            </form>
          )}

          <div className="space-y-3">
            {rules.map((rule) => (
              <article key={rule.id} className="rounded-md border border-slate-200 p-4">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <h3 className="text-sm font-semibold text-slate-900">{rule.name}</h3>
                      <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs text-slate-600">{rule.destination}</span>
                    </div>
                    <p className="mt-1 text-sm text-slate-500">When {rule.condition}</p>
                  </div>
                  <label className="flex items-center gap-2 text-sm text-slate-600">
                    <input
                      type="checkbox"
                      checked={rule.enabled}
                      onChange={(event) => setRules((current) => current.map((item) => item.id === rule.id ? { ...item, enabled: event.target.checked } : item))}
                      className="h-4 w-4 rounded border-slate-300 text-primary-600 focus:ring-primary-500"
                    />
                    {rule.enabled ? 'Enabled in preview' : 'Draft'}
                  </label>
                </div>
                <div className="mt-3 grid gap-2 border-t border-slate-100 pt-3 text-xs sm:grid-cols-3">
                  <Mapping label="Email subject" value="Record title" />
                  <Mapping label="Email body" value="Description" />
                  <Mapping label="Sender address" value="Requested by" />
                </div>
              </article>
            ))}
          </div>
          <p className="rounded-md bg-slate-50 px-3 py-2 text-xs text-slate-500">
            Production processing also requires a mailbox listener, rule storage, and an inbound email action service.
          </p>
        </section>
      )}

      {(tab === 'templates' || tab === 'quick') && (
        <section className="grid gap-4 lg:grid-cols-[minmax(220px,0.8fr)_minmax(0,2fr)]">
          <div className="rounded-lg border border-slate-200 bg-white p-4">
            <div className="mb-3 flex items-center justify-between gap-2">
              <h2 className="text-sm font-semibold text-slate-900">{tab === 'templates' ? 'Email templates' : 'Quick messages'}</h2>
              <button type="button" onClick={addTextItem} className="rounded-md border border-slate-300 px-2.5 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50">
                Add new
              </button>
            </div>
            <div className="space-y-1">
              {selectedTextItems.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => setSelectedId(item.id)}
                  className={`block w-full rounded-md px-3 py-2 text-left text-sm ${selectedItem?.id === item.id ? 'bg-primary-50 font-medium text-primary-800' : 'text-slate-700 hover:bg-slate-50'}`}
                >
                  {item.name || 'Untitled'}
                </button>
              ))}
              {selectedTextItems.length === 0 && <p className="px-3 py-4 text-sm text-slate-500">Add a message to get started.</p>}
            </div>
          </div>

          {selectedItem ? (
            <div className="space-y-4 rounded-lg border border-slate-200 bg-white p-5">
              <div>
                <h2 className="text-base font-semibold text-slate-900">
                  {tab === 'templates' ? 'Email client template' : 'Quick message'}
                </h2>
                <p className="mt-1 text-sm text-slate-500">
                  {tab === 'templates'
                    ? 'Pre-fill an agent email using fields from the active record.'
                    : 'Reusable snippets agents can insert while replying to a customer.'}
                </p>
              </div>
              <label className="block space-y-1 text-sm font-medium text-slate-700">
                Name
                <input value={selectedItem.name} onChange={(event) => updateTextItem('name', event.target.value)} className={inputClass} />
              </label>
              {tab === 'templates' && (
                <label className="block space-y-1 text-sm font-medium text-slate-700">
                  Subject
                  <input value={selectedItem.subject} onChange={(event) => updateTextItem('subject', event.target.value)} className={inputClass} />
                </label>
              )}
              <label className="block space-y-1 text-sm font-medium text-slate-700">
                {tab === 'templates' ? 'Email body' : 'Message text'}
                <textarea rows={8} value={selectedItem.body} onChange={(event) => updateTextItem('body', event.target.value)} className={`${inputClass} resize-y`} />
              </label>
              {tab === 'templates' && (
                <div className="rounded-md bg-slate-50 px-3 py-2 text-xs text-slate-600">
                  Available record fields: <code>{'{{ticket.number}}'}</code>, <code>{'{{ticket.short_description}}'}</code>, <code>{'{{caller.name}}'}</code>, <code>{'{{agent.name}}'}</code>
                </div>
              )}
              <p className="text-xs text-amber-700">Preview edits only; templates and snippets are not saved to the server.</p>
            </div>
          ) : (
            <div className="flex min-h-64 items-center justify-center rounded-lg border border-dashed border-slate-300 bg-white p-5 text-sm text-slate-500">
              Select a message or add a new one.
            </div>
          )}
        </section>
      )}

      {tab === 'ai' && (
        <section className="space-y-5 rounded-lg border border-slate-200 bg-white p-5">
          <div>
            <h2 className="text-base font-semibold text-slate-900">AI email response recommendations</h2>
            <p className="mt-1 max-w-3xl text-sm text-slate-500">
              Give agents a draft reply based on the inbound email and its linked incident or service request.
              An agent should review and send every suggested response.
            </p>
          </div>
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-4 rounded-md border border-slate-200 p-4">
              <PreviewToggle label="Show reply suggestions to agents" checked={aiEnabled} onChange={setAiEnabled} />
              <PreviewToggle label="Prepare a draft automatically" checked={autoDraft} onChange={setAutoDraft} />
              <p className="text-xs text-amber-700">Controls are visual previews only. DEX has no mail-response AI endpoint connected.</p>
            </div>
            <div className="rounded-md border border-slate-200 bg-slate-50 p-4">
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Suggested response preview</p>
              <p className="mt-3 text-sm leading-6 text-slate-700">
                Hello {'{{caller.name}}'},<br /><br />
                Thanks for reporting this issue. We are reviewing the details and will update your ticket
                {' {{ticket.number}}'} as soon as we have more information.<br /><br />
                Regards,<br />DEX Support
              </p>
              <button type="button" disabled title="AI response service is not connected" className="mt-4 rounded-md bg-slate-300 px-3 py-2 text-sm font-medium text-white">
                Generate suggestion
              </button>
            </div>
          </div>
          <div className="rounded-md bg-blue-50 px-4 py-3 text-sm text-blue-800">
            To make this operational, DEX needs an AI response endpoint, ticket/email context access, and agent review controls before sending.
          </div>
        </section>
      )}
    </div>
  );
}

function TabButton({ active, onClick, children }: { active: boolean; onClick: () => void; children: string }) {
  return (
    <button
      type="button"
      role="tab"
      aria-selected={active}
      onClick={onClick}
      className={`border-b-2 px-3 py-2.5 text-sm font-medium ${active ? 'border-primary-600 text-primary-700' : 'border-transparent text-slate-500 hover:text-slate-800'}`}
    >
      {children}
    </button>
  );
}

function StatusCard({ title, value, detail }: { title: string; value: string; detail: string }) {
  return (
    <div className="rounded-lg border border-slate-200 bg-white p-4">
      <p className="text-xs font-medium uppercase tracking-wide text-slate-500">{title}</p>
      <p className="mt-2 text-sm font-semibold text-slate-900">{value}</p>
      <p className="mt-1 text-xs text-slate-500">{detail}</p>
    </div>
  );
}

function Mapping({ label, value }: { label: string; value: string }) {
  return (
    <p className="text-slate-500">
      <span className="text-slate-700">{label}</span> → {value}
    </p>
  );
}

function PreviewToggle({ label, checked, onChange }: { label: string; checked: boolean; onChange: (value: boolean) => void }) {
  return (
    <label className="flex items-center justify-between gap-3 text-sm text-slate-700">
      {label}
      <input
        type="checkbox"
        checked={checked}
        onChange={(event) => onChange(event.target.checked)}
        className="h-4 w-4 rounded border-slate-300 text-primary-600 focus:ring-primary-500"
      />
    </label>
  );
}
