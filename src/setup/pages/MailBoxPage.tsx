import { useEffect, useState, type FormEvent, type ReactNode } from 'react';
import { Link } from 'react-router-dom';
import MailboxMessages from './MailboxMessages';
import {
  getMailSettings,
  saveMailSettings,
  testIncomingMail,
  type MailSettings,
} from '../../api/mailSettingsApi';

type Protocol = 'IMAP' | 'POP3';
type SecurityMode = 'NONE' | 'STARTTLS' | 'SSL';
type Feedback = { ok: boolean; text: string };

const field =
  'w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm text-slate-800 focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500';
const errorText = (error: unknown, fallback: string) =>
  error instanceof Error ? error.message : fallback;

function MailBoxConnection() {
  const [settings, setSettings] = useState<MailSettings | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [protocol, setProtocol] = useState<Protocol>('IMAP');
  const [host, setHost] = useState('');
  const [port, setPort] = useState('993');
  const [security, setSecurity] = useState<SecurityMode>('SSL');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [enabled, setEnabled] = useState(false);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [saveFeedback, setSaveFeedback] = useState<Feedback | null>(null);
  const [testFeedback, setTestFeedback] = useState<Feedback | null>(null);

  const fill = (value: MailSettings) => {
    setSettings(value);
    const currentProtocol = value.incomingProtocol ?? 'IMAP';
    setProtocol(currentProtocol);
    setHost(value.incomingHost ?? '');
    setPort(value.incomingPort?.toString() ?? (currentProtocol === 'IMAP' ? '993' : '995'));
    setSecurity(value.incomingTlsMode ?? 'SSL');
    setUsername(value.incomingUsername ?? '');
    setPassword('');
    setEnabled(value.incomingEnabled ?? false);
  };

  useEffect(() => {
    let active = true;
    getMailSettings()
      .then((value) => {
        if (active) fill(value);
      })
      .catch((error: unknown) => {
        if (active) setLoadError(errorText(error, 'Could not load mailbox settings'));
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, []);

  const isDirty =
    settings !== null &&
    (protocol !== (settings.incomingProtocol ?? 'IMAP') ||
      host !== (settings.incomingHost ?? '') ||
      port !== (settings.incomingPort?.toString() ?? (settings.incomingProtocol === 'POP3' ? '995' : '993')) ||
      security !== (settings.incomingTlsMode ?? 'SSL') ||
      username !== (settings.incomingUsername ?? '') ||
      password !== '' ||
      enabled !== (settings.incomingEnabled ?? false));

  const canSave =
    settings !== null &&
    !saving &&
    isDirty &&
    (!enabled ||
      (host.trim().length > 0 &&
        Number(port) >= 1 &&
        Number(port) <= 65535 &&
        username.trim().length > 0 &&
        (password.length > 0 || settings.incomingPasswordConfigured)));

  const save = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!settings) return;
    setSaving(true);
    setSaveFeedback(null);
    setTestFeedback(null);
    try {
      fill(await saveMailSettings({
        provider: settings.provider?.toUpperCase() === 'SMTP' ? 'SMTP' : 'RESEND',
        fromEmail: settings.fromEmail,
        fromName: settings.fromName,
        replyTo: settings.replyTo ?? '',
        smtpHost: settings.smtpHost ?? '',
        smtpPort: settings.smtpPort ?? null,
        smtpTlsMode: settings.smtpTlsMode ?? 'STARTTLS',
        smtpRequiresAuth: settings.smtpRequiresAuth,
        smtpUsername: settings.smtpUsername ?? '',
        incomingEnabled: enabled,
        incomingProtocol: protocol,
        incomingHost: host.trim(),
        incomingPort: port.trim() ? Number(port) : null,
        incomingTlsMode: security,
        incomingUsername: username.trim(),
        incomingPassword: password,
      }));
      setSaveFeedback({ ok: true, text: 'Mailbox connection settings saved.' });
    } catch (error) {
      setSaveFeedback({ ok: false, text: errorText(error, 'Could not save mailbox settings') });
    } finally {
      setSaving(false);
    }
  };

  const testConnection = async () => {
    setTesting(true);
    setTestFeedback(null);
    try {
      setTestFeedback({ ok: true, text: await testIncomingMail() });
    } catch (error) {
      setTestFeedback({ ok: false, text: errorText(error, 'Could not connect to the mailbox') });
    } finally {
      setTesting(false);
    }
  };

  const changeProtocol = (value: Protocol) => {
    setProtocol(value);
    if (port === '993' || port === '995' || !port) {
      setPort(value === 'IMAP' ? '993' : '995');
    }
  };

  return (
    <div className="space-y-5">
      <nav aria-label="Breadcrumb" className="flex flex-wrap items-center gap-2 text-xs">
        <Link to="/setup" className="text-primary-700 hover:underline">Setup</Link>
        <span className="text-slate-300">›</span>
        <Link to="/setup/mail/server" className="text-primary-700 hover:underline">Mail Settings</Link>
        <span className="text-slate-300">›</span>
        <span className="text-slate-500">Mail Box</span>
      </nav>

      <div>
        <h1 className="text-lg font-semibold text-slate-900">Mail Box</h1>
        <p className="mt-1 max-w-3xl text-sm text-slate-500">
          Connect an existing mailbox so DEX can verify its incoming mail connection.
          This does not create a mailbox with an email provider.
        </p>
      </div>

      {loadError && <Notice feedback={{ ok: false, text: loadError }} />}
      {loading && <p className="py-8 text-center text-sm text-slate-400">Loading mailbox settings…</p>}

      {settings && !loading && (
        <>
          <section className="grid gap-3 sm:grid-cols-3">
            <SummaryCard
              label="Mailbox connection"
              value={enabled ? 'Enabled' : 'Not enabled'}
              detail={enabled ? `${protocol} · ${host || 'server not set'}` : 'Configure the connection below'}
              tone={enabled ? 'green' : 'slate'}
            />
            <SummaryCard
              label="Connection test"
              value="Manual"
              detail="Test the mailbox connection after saving"
              tone="blue"
            />
            <SummaryCard
              label="Email processing"
              value="Not active"
              detail="Messages are not yet converted to tickets"
              tone="amber"
            />
          </section>

          <form onSubmit={(event) => void save(event)} className="space-y-5">
            <section className="space-y-5 rounded-lg border border-slate-200 bg-white p-5">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <SectionHeading
                  title="Incoming mailbox connection"
                  description="Enter the server details for a mailbox that already exists with your email provider."
                />
                <label className="flex items-center gap-2 text-sm font-medium text-slate-700">
                  <input
                    type="checkbox"
                    checked={enabled}
                    onChange={(event) => setEnabled(event.target.checked)}
                    className="h-4 w-4 rounded border-slate-300 text-primary-600 focus:ring-primary-500"
                  />
                  Enable connection
                </label>
              </div>

              {enabled && (
                <>
                  <div className="grid gap-4 sm:grid-cols-2">
                    <Field label="Protocol">
                      <select value={protocol} onChange={(event) => changeProtocol(event.target.value as Protocol)} className={field}>
                        <option value="IMAP">IMAP - sync mailbox on server</option>
                        <option value="POP3">POP3 - retrieve from mailbox server</option>
                      </select>
                    </Field>
                    <Field label="Connection security">
                      <select value={security} onChange={(event) => setSecurity(event.target.value as SecurityMode)} className={field}>
                        <option value="SSL">SSL/TLS</option>
                        <option value="STARTTLS">STARTTLS</option>
                        <option value="NONE">None</option>
                      </select>
                    </Field>
                  </div>

                  <div className="grid gap-4 sm:grid-cols-2">
                    <Field label="Server hostname" required>
                      <input
                        value={host}
                        onChange={(event) => setHost(event.target.value)}
                        placeholder={protocol === 'IMAP' ? 'imap.example.com' : 'pop.example.com'}
                        autoComplete="url"
                        className={field}
                      />
                    </Field>
                    <Field label="Port" required>
                      <input
                        type="number"
                        min="1"
                        max="65535"
                        value={port}
                        onChange={(event) => setPort(event.target.value)}
                        placeholder={protocol === 'IMAP' ? '993' : '995'}
                        className={field}
                      />
                    </Field>
                  </div>

                  <div className="grid gap-4 sm:grid-cols-2">
                    <Field label="Mailbox username" required>
                      <input value={username} onChange={(event) => setUsername(event.target.value)} autoComplete="username" className={field} />
                    </Field>
                    <Field label="Mailbox password" hint={settings.incomingPasswordConfigured ? 'Leave blank to keep the saved password.' : 'Credentials are encrypted before storage.'}>
                      <input type="password" value={password} onChange={(event) => setPassword(event.target.value)} autoComplete="new-password" className={field} />
                    </Field>
                  </div>
                </>
              )}
              {!enabled && (
                <p className="rounded-md bg-slate-50 px-4 py-3 text-sm text-slate-600">
                  Turn on the connection to configure an IMAP or POP3 mailbox.
                </p>
              )}
            </section>

            <section className="space-y-4 rounded-lg border border-slate-200 bg-white p-5">
              <SectionHeading
                title="Email-to-record rules"
                description="Define which DEX record receives an incoming message and how its subject and body are used."
              />
              <div className="rounded-md border border-dashed border-slate-300 bg-slate-50 px-4 py-5">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <p className="text-sm font-medium text-slate-800">Incident and service-request mapping</p>
                    <p className="mt-1 max-w-2xl text-sm text-slate-500">
                      Mapping and automatic record creation require an incoming-message processor,
                      which is not currently available in the backend.
                    </p>
                  </div>
                  <span className="rounded-full bg-amber-100 px-2.5 py-1 text-xs font-medium text-amber-800">
                    Not configured
                  </span>
                </div>
                <div className="mt-4 grid gap-3 text-sm sm:grid-cols-2">
                  <MappingPreview title="Email subject" value="Incident title" />
                  <MappingPreview title="Email body" value="Incident description" />
                </div>
                <button
                  type="button"
                  disabled
                  className="mt-4 rounded-md border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-400"
                  title="Requires backend email processing and mapping APIs"
                >
                  Configure mapping
                </button>
              </div>
            </section>

            <section className="rounded-lg border border-slate-200 bg-white p-5">
              <div className="flex flex-wrap items-center justify-between gap-4">
                <div>
                  <h2 className="text-base font-semibold text-slate-900">Email listener</h2>
                  <p className="mt-1 text-sm text-slate-500">
                    A listener or scheduled poller is needed to fetch messages and create records.
                  </p>
                </div>
                <span className="inline-flex items-center gap-2 rounded-full bg-slate-100 px-3 py-1.5 text-xs font-medium text-slate-600">
                  <span className="h-2 w-2 rounded-full bg-slate-400" />
                  Not running
                </span>
              </div>
              <p className="mt-4 rounded-md bg-blue-50 px-4 py-3 text-sm text-blue-800">
                Saving and testing the connection only validates access to the mailbox. DEX does not currently poll,
                download, store, or convert incoming messages into incidents or service requests.
              </p>
            </section>

            <div className="flex flex-wrap items-center justify-center gap-3">
              <button
                type="submit"
                disabled={!canSave}
                className="rounded-md bg-primary-600 px-5 py-2 text-sm font-medium text-white hover:bg-primary-700 disabled:opacity-50"
              >
                {saving ? 'Saving…' : 'Save mailbox settings'}
              </button>
              <button
                type="button"
                onClick={() => void testConnection()}
                disabled={!settings.incomingEnabled || isDirty || saving || testing}
                className="rounded-md border border-primary-600 px-5 py-2 text-sm font-medium text-primary-700 hover:bg-primary-50 disabled:opacity-50"
              >
                {testing ? 'Testing…' : 'Test connection'}
              </button>
              {settings.incomingEnabled && !isDirty && (
                <button
                  type="button"
                  onClick={() => fill(settings)}
                  className="rounded-md border border-slate-300 px-5 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
                >
                  Reload settings
                </button>
              )}
            </div>
            {saveFeedback && <Notice feedback={saveFeedback} />}
            {testFeedback && <Notice feedback={testFeedback} />}
          </form>
        </>
      )}
    </div>
  );
}

function Field({
  label,
  children,
  required = false,
  hint,
}: {
  label: string;
  children: ReactNode;
  required?: boolean;
  hint?: string;
}) {
  return (
    <label className="block space-y-1">
      <span className="block text-sm font-medium text-slate-700">
        {label}{required && <span className="text-red-600"> *</span>}
      </span>
      {children}
      {hint && <span className="block text-xs text-slate-500">{hint}</span>}
    </label>
  );
}

function SectionHeading({ title, description }: { title: string; description: string }) {
  return (
    <div>
      <h2 className="text-base font-semibold text-slate-900">{title}</h2>
      <p className="mt-1 text-sm text-slate-500">{description}</p>
    </div>
  );
}

function MappingPreview({ title, value }: { title: string; value: string }) {
  return (
    <div className="rounded-md border border-slate-200 bg-white px-3 py-2">
      <p className="text-xs text-slate-500">{title}</p>
      <p className="mt-1 font-medium text-slate-800">{value}</p>
    </div>
  );
}

function SummaryCard({
  label,
  value,
  detail,
  tone,
}: {
  label: string;
  value: string;
  detail: string;
  tone: 'green' | 'slate' | 'blue' | 'amber';
}) {
  const indicator = {
    green: 'bg-emerald-500',
    slate: 'bg-slate-400',
    blue: 'bg-blue-500',
    amber: 'bg-amber-500',
  }[tone];
  return (
    <div className="rounded-lg border border-slate-200 bg-white p-4">
      <p className="text-xs font-medium uppercase tracking-wide text-slate-500">{label}</p>
      <p className="mt-2 flex items-center gap-2 text-sm font-semibold text-slate-900">
        <span className={`h-2 w-2 rounded-full ${indicator}`} />
        {value}
      </p>
      <p className="mt-1 truncate text-xs text-slate-500">{detail}</p>
    </div>
  );
}

function Notice({ feedback }: { feedback: Feedback }) {
  return (
    <p
      role={feedback.ok ? 'status' : 'alert'}
      className={`rounded-md px-3 py-2 text-sm ${
        feedback.ok ? 'bg-emerald-50 text-emerald-700' : 'bg-red-50 text-red-700'
      }`}
    >
      {feedback.text}
    </p>
  );
}

/** Mail Box: the messages (Inbox, Sent, Drafts) and, on the second tab, the mailbox connection settings. */
export default function MailBoxPage() {
  const [tab, setTab] = useState<'messages' | 'connection'>('messages');
  const tabClass = (active: boolean) =>
    `-mb-px rounded-t border border-b-0 px-4 py-2 text-sm ${active ? 'border-slate-300 bg-white font-medium text-slate-900' : 'border-transparent text-slate-500 hover:text-slate-800'}`;
  return (
    <div className="space-y-4">
      <nav aria-label="Breadcrumb" className="flex flex-wrap items-center gap-2 text-xs">
        <Link to="/setup" className="text-primary-700 hover:underline">Setup</Link>
        <span className="text-slate-300">›</span>
        <Link to="/setup/mail/server" className="text-primary-700 hover:underline">Mail Settings</Link>
        <span className="text-slate-300">›</span>
        <span className="text-slate-500">Mail Box</span>
      </nav>
      <div>
        <h1 className="text-lg font-semibold text-slate-900">Mail Box</h1>
        <p className="mt-1 max-w-3xl text-sm text-slate-500">
          Your mailbox is where incoming, outgoing and saved messages are kept on the mail server. Read the support inbox, see what DEX has sent, and write replies.
        </p>
      </div>
      <div className="flex gap-1 border-b border-slate-300">
        <button className={tabClass(tab === 'messages')} onClick={() => setTab('messages')}>Messages</button>
        <button className={tabClass(tab === 'connection')} onClick={() => setTab('connection')}>Connection settings</button>
      </div>
      {tab === 'messages' ? <MailboxMessages /> : <MailBoxConnection />}
    </div>
  );
}
