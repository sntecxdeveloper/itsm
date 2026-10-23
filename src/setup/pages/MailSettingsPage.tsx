import { useEffect, useState, type ReactNode } from 'react';
import { Link, Navigate, useParams } from 'react-router-dom';
import {
  getMailSettings,
  saveMailSettings,
  sendTestMail,
  testIncomingMail,
  type MailSettings,
  type SaveMailSettingsPayload,
} from '../../api/mailSettingsApi';

const inputClass =
  'w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm text-slate-800 focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500 disabled:bg-slate-100 disabled:text-slate-500';
const selectClass = `${inputClass} cursor-pointer`;
const validEmail = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
type Provider = 'RESEND' | 'SMTP';
type SecurityMode = 'NONE' | 'STARTTLS' | 'SSL';
type IncomingProtocol = 'IMAP' | 'POP3';
type Feedback = { ok: boolean; text: string };
const errorText = (error: unknown, fallback: string) => {
  const data = (error as { response?: { data?: { message?: string; error?: string } } })?.response?.data;
  return data?.message || data?.error || (error instanceof Error ? error.message : fallback);
};

export default function MailSettingsPage() {
  const { tab } = useParams();
  const [settings, setSettings] = useState<MailSettings | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [provider, setProvider] = useState<Provider>('RESEND');
  const [senderName, setSenderName] = useState('');
  const [senderEmail, setSenderEmail] = useState('');
  const [supportEmail, setSupportEmail] = useState('');
  const [smtpHost, setSmtpHost] = useState('');
  const [smtpPort, setSmtpPort] = useState('587');
  const [smtpTlsMode, setSmtpTlsMode] = useState<SecurityMode>('STARTTLS');
  const [smtpRequiresAuth, setSmtpRequiresAuth] = useState(true);
  const [smtpUsername, setSmtpUsername] = useState('');
  const [smtpPassword, setSmtpPassword] = useState('');
  const [incomingEnabled, setIncomingEnabled] = useState(false);
  const [incomingProtocol, setIncomingProtocol] = useState<IncomingProtocol>('IMAP');
  const [incomingHost, setIncomingHost] = useState('');
  const [incomingPort, setIncomingPort] = useState('993');
  const [incomingTlsMode, setIncomingTlsMode] = useState<SecurityMode>('SSL');
  const [incomingUsername, setIncomingUsername] = useState('');
  const [incomingPassword, setIncomingPassword] = useState('');
  const [notificationRecipients, setNotificationRecipients] = useState('');
  const [notifyTicketCreated, setNotifyTicketCreated] = useState(false);
  const [notifyTicketAssigned, setNotifyTicketAssigned] = useState(false);
  const [notifyTicketUpdated, setNotifyTicketUpdated] = useState(false);
  const [notifySlaApproaching, setNotifySlaApproaching] = useState(false);
  const [testRecipient, setTestRecipient] = useState('');

  const [saving, setSaving] = useState(false);
  const [testingOutgoing, setTestingOutgoing] = useState(false);
  const [testingIncoming, setTestingIncoming] = useState(false);
  const [saveFeedback, setSaveFeedback] = useState<Feedback | null>(null);
  const [outgoingFeedback, setOutgoingFeedback] = useState<Feedback | null>(null);
  const [incomingFeedback, setIncomingFeedback] = useState<Feedback | null>(null);

  const fill = (value: MailSettings) => {
    setSettings(value);
    setProvider(value.provider?.toUpperCase() === 'SMTP' ? 'SMTP' : 'RESEND');
    setSenderName(value.fromName ?? '');
    setSenderEmail(value.fromEmail ?? '');
    setSupportEmail(value.replyTo && value.replyTo !== value.fromEmail ? value.replyTo : '');
    setSmtpHost(value.smtpHost ?? '');
    setSmtpPort(value.smtpPort?.toString() ?? '587');
    setSmtpTlsMode(value.smtpTlsMode ?? 'STARTTLS');
    setSmtpRequiresAuth(value.smtpRequiresAuth ?? true);
    setSmtpUsername(value.smtpUsername ?? '');
    setSmtpPassword('');
    setIncomingEnabled(value.incomingEnabled ?? false);
    setIncomingProtocol(value.incomingProtocol ?? 'IMAP');
    setIncomingHost(value.incomingHost ?? '');
    setIncomingPort(value.incomingPort?.toString() ?? (value.incomingProtocol === 'POP3' ? '995' : '993'));
    setIncomingTlsMode(value.incomingTlsMode ?? 'SSL');
    setIncomingUsername(value.incomingUsername ?? '');
    setIncomingPassword('');
    setNotificationRecipients((value.notificationRecipients ?? []).join(', '));
    setNotifyTicketCreated(value.notifyTicketCreated ?? false);
    setNotifyTicketAssigned(value.notifyTicketAssigned ?? false);
    setNotifyTicketUpdated(value.notifyTicketUpdated ?? false);
    setNotifySlaApproaching(value.notifySlaApproaching ?? false);
    setTestRecipient(value.fromEmail ?? '');
  };

  useEffect(() => {
    let live = true;
    getMailSettings()
      .then((value) => {
        if (live) fill(value);
      })
      .catch((error: unknown) => {
        if (live) setLoadError(errorText(error, 'Could not load mail server settings'));
      });
    return () => {
      live = false;
    };
  }, []);

  const payload: SaveMailSettingsPayload = {
    provider,
    fromEmail: senderEmail.trim(),
    fromName: senderName.trim(),
    replyTo: supportEmail.trim() || senderEmail.trim(),
    smtpHost: smtpHost.trim(),
    smtpPort: smtpPort.trim() ? Number(smtpPort) : null,
    smtpTlsMode,
    smtpRequiresAuth,
    smtpUsername: smtpUsername.trim(),
    smtpPassword,
    incomingEnabled,
    incomingProtocol,
    incomingHost: incomingHost.trim(),
    incomingPort: incomingPort.trim() ? Number(incomingPort) : null,
    incomingTlsMode,
    incomingUsername: incomingUsername.trim(),
    incomingPassword,
    notificationRecipients: notificationRecipients.split(/[,\n;]/).map((address) => address.trim()).filter(Boolean),
    notifyTicketCreated,
    notifyTicketAssigned,
    notifyTicketUpdated,
    notifySlaApproaching,
  };

  const parsedNotificationRecipients = payload.notificationRecipients ?? [];
  const invalidNotificationRecipient = parsedNotificationRecipients.find((address) => !validEmail.test(address));
  const notificationsEnabled =
    notifyTicketCreated || notifyTicketAssigned || notifyTicketUpdated || notifySlaApproaching;
  const isDirty =
    settings !== null &&
    (provider !== (settings.provider?.toUpperCase() === 'SMTP' ? 'SMTP' : 'RESEND') ||
      senderName !== (settings.fromName ?? '') ||
      senderEmail !== (settings.fromEmail ?? '') ||
      supportEmail !== (settings.replyTo && settings.replyTo !== settings.fromEmail ? settings.replyTo : '') ||
      smtpHost !== (settings.smtpHost ?? '') ||
      smtpPort !== (settings.smtpPort?.toString() ?? '587') ||
      smtpTlsMode !== (settings.smtpTlsMode ?? 'STARTTLS') ||
      smtpRequiresAuth !== (settings.smtpRequiresAuth ?? true) ||
      smtpUsername !== (settings.smtpUsername ?? '') ||
      smtpPassword !== '' ||
      incomingEnabled !== (settings.incomingEnabled ?? false) ||
      incomingProtocol !== (settings.incomingProtocol ?? 'IMAP') ||
      incomingHost !== (settings.incomingHost ?? '') ||
      incomingPort !== (settings.incomingPort?.toString() ?? (settings.incomingProtocol === 'POP3' ? '995' : '993')) ||
      incomingTlsMode !== (settings.incomingTlsMode ?? 'SSL') ||
      incomingUsername !== (settings.incomingUsername ?? '') ||
      incomingPassword !== '' ||
      notificationRecipients !== (settings.notificationRecipients ?? []).join(', ') ||
      notifyTicketCreated !== (settings.notifyTicketCreated ?? false) ||
      notifyTicketAssigned !== (settings.notifyTicketAssigned ?? false) ||
      notifyTicketUpdated !== (settings.notifyTicketUpdated ?? false) ||
      notifySlaApproaching !== (settings.notifySlaApproaching ?? false));

  const senderEmailError = senderEmail && !validEmail.test(senderEmail) ? 'Enter a valid sender email address' : undefined;
  const supportEmailError = supportEmail && !validEmail.test(supportEmail) ? 'Enter a valid support email address' : undefined;
  const recipientError = testRecipient && !validEmail.test(testRecipient) ? 'Enter a valid recipient email address' : undefined;
  const canSave =
    settings !== null &&
    !saving &&
    isDirty &&
    !invalidNotificationRecipient &&
    parsedNotificationRecipients.length <= 20 &&
    (!notificationsEnabled || parsedNotificationRecipients.length > 0) &&
    Boolean(senderName.trim()) &&
    Boolean(senderEmail.trim()) &&
    !senderEmailError &&
    !supportEmailError &&
    (provider !== 'SMTP' ||
      (Boolean(smtpHost.trim()) &&
        Number(smtpPort) >= 1 &&
        Number(smtpPort) <= 65535 &&
        (!smtpRequiresAuth ||
          (Boolean(smtpUsername.trim()) && (Boolean(smtpPassword) || settings.smtpPasswordConfigured))))) &&
    (!incomingEnabled ||
      (Boolean(incomingHost.trim()) &&
        Number(incomingPort) >= 1 &&
        Number(incomingPort) <= 65535 &&
        Boolean(incomingUsername.trim()) &&
        (Boolean(incomingPassword) || settings.incomingPasswordConfigured)));

  const save = async () => {
    setSaving(true);
    setSaveFeedback(null);
    setOutgoingFeedback(null);
    setIncomingFeedback(null);
    try {
      fill(await saveMailSettings(payload));
      setSaveFeedback({ ok: true, text: 'Mail server settings saved.' });
    } catch (error) {
      setSaveFeedback({ ok: false, text: errorText(error, 'Could not save mail server settings') });
    } finally {
      setSaving(false);
    }
  };

  const sendTest = async () => {
    if (!validEmail.test(testRecipient.trim())) return;
    setTestingOutgoing(true);
    setOutgoingFeedback(null);
    try {
      await sendTestMail(testRecipient.trim());
      setOutgoingFeedback({ ok: true, text: `Email sent successfully to ${testRecipient.trim()}.` });
    } catch (error) {
      setOutgoingFeedback({ ok: false, text: errorText(error, 'The test email was not sent') });
    } finally {
      setTestingOutgoing(false);
    }
  };

  const testIncoming = async () => {
    setTestingIncoming(true);
    setIncomingFeedback(null);
    try {
      setIncomingFeedback({ ok: true, text: await testIncomingMail() });
    } catch (error) {
      setIncomingFeedback({ ok: false, text: errorText(error, 'Could not connect to the incoming mail server') });
    } finally {
      setTestingIncoming(false);
    }
  };

  if (!tab || tab !== 'server') return <Navigate to="/setup/mail/server" replace />;

  return (
    <div className="space-y-5">
      <nav aria-label="Breadcrumb" className="flex flex-wrap items-center gap-2 text-xs">
        <Link to="/setup" className="text-primary-700 hover:underline">Setup</Link>
        <span className="text-slate-300">›</span>
        <Link to="/setup/mail/server" className="text-primary-700 hover:underline">Mail Settings</Link>
        <span className="text-slate-300">›</span>
        <span className="text-slate-500">Mail Server Settings</span>
      </nav>

      <div>
        <h1 className="text-lg font-semibold text-slate-900">DEX ITSM - Send Email</h1>
        <p className="mt-1 text-sm text-slate-500">
          Set your platform display name, send a test message, and configure the mail server used by DEX.
        </p>
      </div>

      {loadError && <Notice feedback={{ ok: false, text: loadError }} />}
      {!settings && !loadError && <p className="py-8 text-center text-sm text-slate-400">Loading mail settings…</p>}

      {settings && (
        <div className="max-w-4xl space-y-5">
          <section className="space-y-4 rounded-lg border border-slate-200 bg-white p-5 sm:p-6">
            <div>
              <h2 className="text-base font-semibold text-slate-900">Send Email</h2>
              <p className="mt-1 text-sm text-slate-500">
                Send a test email using the saved DEX outgoing mail configuration.
              </p>
            </div>
            <Field label="Display Name" required>
              <input
                value={senderName}
                onChange={(event) => setSenderName(event.target.value)}
                maxLength={100}
                placeholder="DEX ITSM"
                className={inputClass}
              />
            </Field>
            <Field label="Receiver Email" error={recipientError}>
              <input
                type="email"
                value={testRecipient}
                onChange={(event) => setTestRecipient(event.target.value)}
                placeholder="user@example.com"
                autoComplete="email"
                className={`${inputClass} ${recipientError ? 'border-red-500' : ''}`}
                aria-invalid={Boolean(recipientError)}
              />
            </Field>
            <button
              type="button"
              onClick={() => void sendTest()}
              disabled={saving || isDirty || testingOutgoing || !senderName.trim() || !validEmail.test(testRecipient.trim())}
              className="w-full rounded-md bg-primary-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-primary-700 disabled:cursor-not-allowed disabled:opacity-50 sm:w-auto sm:min-w-40"
            >
              {testingOutgoing ? 'Sending…' : 'Send Mail'}
            </button>
            {isDirty && (
              <p className="text-xs text-amber-700">
                Save your platform and mail settings before sending so the saved display name and server are used.
              </p>
            )}
            {outgoingFeedback && <Notice feedback={outgoingFeedback} />}
          </section>

          <section className="space-y-5 rounded-lg border border-slate-200 bg-white p-5">
            <SectionHeading
              title="Outgoing mail"
              description="Choose how DEX sends notifications, password resets, and test messages."
            />

            <Field label="Sending provider">
              <select
                value={provider}
                onChange={(event) => setProvider(event.target.value as Provider)}
                className={selectClass}
              >
                <option value="RESEND">Resend API</option>
                <option value="SMTP">SMTP / SMTPS server</option>
              </select>
            </Field>

            {provider === 'SMTP' && (
              <>
                <div className="grid gap-4 sm:grid-cols-2">
                  <Field label="SMTP server hostname" required>
                    <input value={smtpHost} onChange={(event) => setSmtpHost(event.target.value)} placeholder="smtp.example.com" className={inputClass} />
                  </Field>
                  <Field label="Port" required>
                    <input type="number" min="1" max="65535" value={smtpPort} onChange={(event) => setSmtpPort(event.target.value)} placeholder="587" className={inputClass} />
                  </Field>
                </div>
                <Field label="Connection security">
                  <select value={smtpTlsMode} onChange={(event) => setSmtpTlsMode(event.target.value as SecurityMode)} className={selectClass}>
                    <option value="STARTTLS">STARTTLS (recommended)</option>
                    <option value="SSL">SSL/TLS (SMTPS)</option>
                    <option value="NONE">None</option>
                  </select>
                </Field>
                <label className="flex items-start gap-2 text-sm text-slate-700">
                  <input
                    type="checkbox"
                    checked={smtpRequiresAuth}
                    onChange={(event) => setSmtpRequiresAuth(event.target.checked)}
                    className="mt-0.5 h-4 w-4 rounded border-slate-300 text-primary-600 focus:ring-primary-500"
                  />
                  <span>SMTP server requires authentication</span>
                </label>
                {smtpRequiresAuth && (
                  <div className="grid gap-4 sm:grid-cols-2">
                    <Field label="Username" required>
                      <input value={smtpUsername} onChange={(event) => setSmtpUsername(event.target.value)} autoComplete="username" className={inputClass} />
                    </Field>
                    <Field label="Password" hint={settings.smtpPasswordConfigured ? 'Leave blank to keep the saved password.' : 'Password is encrypted before it is stored.'}>
                      <input type="password" value={smtpPassword} onChange={(event) => setSmtpPassword(event.target.value)} autoComplete="new-password" className={inputClass} />
                    </Field>
                  </div>
                )}
              </>
            )}

            <div className="border-t border-slate-100 pt-4">
              <Field label="Default outgoing address" required error={senderEmailError} hint="The verified address DEX sends from: ticket mails, replies and notifications. Customers see this in the From line.">
                <input type="email" value={senderEmail} onChange={(event) => setSenderEmail(event.target.value)} placeholder="notifications@example.com" autoComplete="email" aria-invalid={Boolean(senderEmailError)} className={`${inputClass} ${senderEmailError ? 'border-red-500' : ''}`} />
              </Field>
              <div className="mt-4">
                <Field label="Support address (incoming)" error={supportEmailError} hint="The public address customers write to, for example support@yourdomain.com. Replies to DEX mails go here. Leave blank to use the outgoing address.">
                  <input type="email" value={supportEmail} onChange={(event) => setSupportEmail(event.target.value)} placeholder="support@example.com" autoComplete="email" aria-invalid={Boolean(supportEmailError)} className={`${inputClass} ${supportEmailError ? 'border-red-500' : ''}`} />
                </Field>
              </div>
            </div>
          </section>

          <section className="space-y-5 rounded-lg border border-slate-200 bg-white p-5">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <SectionHeading
                title="Incoming mail"
                description="Configure an IMAP or POP3 mailbox connection for receiving email."
              />
              <label className="flex items-center gap-2 text-sm font-medium text-slate-700">
                <input
                  type="checkbox"
                  checked={incomingEnabled}
                  onChange={(event) => setIncomingEnabled(event.target.checked)}
                  className="h-4 w-4 rounded border-slate-300 text-primary-600 focus:ring-primary-500"
                />
                Enable incoming connection
              </label>
            </div>

            {incomingEnabled && (
              <>
                <div className="grid gap-4 sm:grid-cols-2">
                  <Field label="Incoming protocol">
                    <select
                      value={incomingProtocol}
                      onChange={(event) => {
                        const protocol = event.target.value as IncomingProtocol;
                        setIncomingProtocol(protocol);
                        if (incomingPort === '993' || incomingPort === '995') {
                          setIncomingPort(protocol === 'IMAP' ? '993' : '995');
                        }
                      }}
                      className={selectClass}
                    >
                      <option value="IMAP">IMAP</option>
                      <option value="POP3">POP3</option>
                    </select>
                  </Field>
                  <Field label="Connection security">
                    <select value={incomingTlsMode} onChange={(event) => setIncomingTlsMode(event.target.value as SecurityMode)} className={selectClass}>
                      <option value="SSL">SSL/TLS</option>
                      <option value="STARTTLS">STARTTLS</option>
                      <option value="NONE">None</option>
                    </select>
                  </Field>
                </div>
                <div className="grid gap-4 sm:grid-cols-2">
                  <Field label="Incoming server hostname" required>
                    <input value={incomingHost} onChange={(event) => setIncomingHost(event.target.value)} placeholder={incomingProtocol === 'IMAP' ? 'imap.example.com' : 'pop.example.com'} className={inputClass} />
                  </Field>
                  <Field label="Port" required>
                    <input type="number" min="1" max="65535" value={incomingPort} onChange={(event) => setIncomingPort(event.target.value)} placeholder={incomingProtocol === 'IMAP' ? '993' : '995'} className={inputClass} />
                  </Field>
                </div>
                <div className="grid gap-4 sm:grid-cols-2">
                  <Field label="System / forwarding address (mailbox username)" required hint="Forward your support address to this mailbox. DEX reads it and turns each incoming email into a ticket.">
                    <input value={incomingUsername} onChange={(event) => setIncomingUsername(event.target.value)} autoComplete="username" className={inputClass} />
                  </Field>
                  <Field label="Mailbox password" hint={settings.incomingPasswordConfigured ? 'Leave blank to keep the saved password.' : 'Password is encrypted before it is stored.'}>
                    <input type="password" value={incomingPassword} onChange={(event) => setIncomingPassword(event.target.value)} autoComplete="new-password" className={inputClass} />
                  </Field>
                </div>
                <p className="rounded-md bg-blue-50 px-3 py-2 text-xs text-blue-800">
                  The connection test checks mailbox access. Fetching and storing mailbox messages is not part of this settings page.
                </p>
              </>
            )}
          </section>

          <section className="space-y-4 rounded-lg border border-slate-200 bg-white p-5">
            <SectionHeading
              title="Incoming connection test"
              description="Save your settings before testing the mailbox connection."
            />
            {incomingEnabled && (
              <div className="flex flex-wrap items-center gap-3 border-t border-slate-100 pt-4">
                <button
                  type="button"
                  onClick={() => void testIncoming()}
                  disabled={saving || isDirty || testingIncoming}
                  className="rounded-md border border-primary-600 px-4 py-2 text-sm font-medium text-primary-700 hover:bg-primary-50 disabled:opacity-50"
                >
                  {testingIncoming ? 'Testing connection…' : 'Test incoming connection'}
                </button>
                {incomingFeedback && <Notice feedback={incomingFeedback} />}
              </div>
            )}
          </section>

          <div className="flex flex-wrap items-center justify-center gap-3">
            <button
              type="button"
              onClick={() => void save()}
              disabled={!canSave}
              className="rounded-md bg-primary-600 px-5 py-2 text-sm font-medium text-white hover:bg-primary-700 disabled:opacity-50"
            >
              {saving ? 'Saving…' : 'Save settings'}
            </button>
            <button
              type="button"
              onClick={() => settings && fill(settings)}
              disabled={!isDirty || saving}
              className="rounded-md border border-slate-300 bg-white px-5 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50"
            >
              Cancel
            </button>
            {saveFeedback && <Notice feedback={saveFeedback} />}
          </div>

          {settings.updatedBy && (
            <p className="text-center text-xs text-slate-400">
              Last saved by {settings.updatedBy}
              {settings.updatedAt ? ` on ${settings.updatedAt.replace('T', ' ').slice(0, 19)}` : ''}.
            </p>
          )}
        </div>
      )}
    </div>
  );
}

function Field({
  label,
  children,
  required = false,
  hint,
  error,
}: {
  label: string;
  children: ReactNode;
  required?: boolean;
  hint?: string;
  error?: string;
}) {
  return (
    <div>
      <label className="block space-y-1">
        <span className="block text-sm font-medium text-slate-700">
          {label}{required && <span className="text-red-600"> *</span>}
        </span>
        {children}
      </label>
      {hint && <p className="text-xs text-slate-500">{hint}</p>}
      {error && <p className="text-xs text-red-600">{error}</p>}
    </div>
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
