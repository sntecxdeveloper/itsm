import { useCallback, useEffect, useState, type FormEvent } from 'react';
import { Link } from 'react-router-dom';
import {
  createMailSenderAddress,
  deleteMailSenderAddress,
  getMailSenderAddresses,
  setDefaultMailSenderAddress,
  updateMailSenderAddress,
  type MailSenderAddress,
} from '../../api/mailSettingsApi';

const field =
  'w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm text-slate-800 focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500';
const validEmail = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const errorText = (error: unknown, fallback: string) =>
  error instanceof Error ? error.message : fallback;

export default function MailAddressesPage() {
  const [addresses, setAddresses] = useState<MailSenderAddress[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [activeAction, setActiveAction] = useState<number | null>(null);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [displayName, setDisplayName] = useState('');
  const [localPart, setLocalPart] = useState('');
  const [domain, setDomain] = useState('');
  const [replyTo, setReplyTo] = useState('');
  const [makeDefault, setMakeDefault] = useState(false);
  const [formOpen, setFormOpen] = useState(false);

  const loadAddresses = useCallback(async () => {
    try {
      setAddresses(await getMailSenderAddresses());
      setLoadError(null);
    } catch (error) {
      setLoadError(errorText(error, 'Could not load sender addresses'));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    let active = true;
    getMailSenderAddresses()
      .then((items) => {
        if (active) {
          setAddresses(items);
          setLoadError(null);
        }
      })
      .catch((error: unknown) => {
        if (active) setLoadError(errorText(error, 'Could not load sender addresses'));
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, []);

  const resetForm = () => {
    setEditingId(null);
    setDisplayName('');
    setLocalPart('');
    setDomain('');
    setReplyTo('');
    setMakeDefault(addresses.length === 0);
    setActionError(null);
    setFormOpen(false);
  };

  const startCreate = () => {
    setEditingId(null);
    setDisplayName('');
    setLocalPart('');
    setDomain('');
    setReplyTo('');
    setMakeDefault(addresses.length === 0);
    setActionError(null);
    setFormOpen(true);
  };

  const startEdit = (address: MailSenderAddress) => {
    const separator = address.email.lastIndexOf('@');
    setEditingId(address.id);
    setDisplayName(address.displayName);
    setLocalPart(separator > -1 ? address.email.slice(0, separator) : address.email);
    setDomain(separator > -1 ? address.email.slice(separator + 1) : '');
    setReplyTo(address.replyTo ?? '');
    setMakeDefault(address.isDefault);
    setActionError(null);
    setFormOpen(true);
  };

  const email = `${localPart.trim()}@${domain.trim()}`;
  const emailError = localPart.trim() && domain.trim() && !validEmail.test(email)
    ? 'Enter a valid username and domain'
    : undefined;
  const replyToError = replyTo.trim() && !validEmail.test(replyTo.trim())
    ? 'Enter a valid reply-to address'
    : undefined;
  const canSubmit =
    !saving &&
    displayName.trim().length > 0 &&
    displayName.trim().length <= 100 &&
    validEmail.test(email) &&
    (!replyTo.trim() || validEmail.test(replyTo.trim()));

  const saveAddress = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!canSubmit) return;
    setSaving(true);
    setActionError(null);
    try {
      const payload = {
        displayName: displayName.trim(),
        email,
        replyTo: replyTo.trim() || undefined,
        isDefault: makeDefault,
      };
      if (editingId === null) {
        await createMailSenderAddress(payload);
      } else {
        await updateMailSenderAddress(editingId, payload);
      }
      await loadAddresses();
      resetForm();
    } catch (error) {
      setActionError(errorText(error, 'Could not save this sender address'));
    } finally {
      setSaving(false);
    }
  };

  const changeDefault = async (address: MailSenderAddress) => {
    setActiveAction(address.id);
    setActionError(null);
    try {
      await setDefaultMailSenderAddress(address.id);
      await loadAddresses();
    } catch (error) {
      setActionError(errorText(error, 'Could not change the default sender'));
    } finally {
      setActiveAction(null);
    }
  };

  const removeAddress = async (address: MailSenderAddress) => {
    if (!window.confirm(`Delete sender address ${address.email}?`)) return;
    setActiveAction(address.id);
    setActionError(null);
    try {
      await deleteMailSenderAddress(address.id);
      await loadAddresses();
    } catch (error) {
      setActionError(errorText(error, 'Could not delete this sender address'));
    } finally {
      setActiveAction(null);
    }
  };

  return (
    <div className="space-y-5">
      <nav aria-label="Breadcrumb" className="flex flex-wrap items-center gap-2 text-xs">
        <Link to="/setup" className="text-primary-700 hover:underline">Setup</Link>
        <span className="text-slate-300">›</span>
        <Link to="/setup/mail/server" className="text-primary-700 hover:underline">Mail Settings</Link>
        <span className="text-slate-300">›</span>
        <span className="text-slate-500">Mail Addresses</span>
      </nav>

      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-lg font-semibold text-slate-900">Mail Addresses</h1>
          <p className="mt-1 max-w-2xl text-sm text-slate-500">
            Manage sender identities used by DEX when sending outgoing email. These entries do not create mailboxes with external providers.
          </p>
        </div>
        <button
          type="button"
          onClick={startCreate}
          className="rounded-md bg-primary-600 px-4 py-2 text-sm font-medium text-white hover:bg-primary-700"
        >
          Add mail address
        </button>
      </div>

      {loadError && <Notice text={loadError} error />}
      {actionError && <Notice text={actionError} error />}

      {formOpen && (
        <form onSubmit={(event) => void saveAddress(event)} className="space-y-5 rounded-lg border border-slate-200 bg-white p-5">
          <div>
            <h2 className="text-base font-semibold text-slate-900">
              {editingId === null ? 'Add sender address' : 'Edit sender address'}
            </h2>
            <p className="mt-1 text-sm text-slate-500">
              An email address combines a mailbox username and a domain, like <code>john.smith@example.com</code>.
            </p>
          </div>

          {actionError && <Notice text={actionError} error />}

          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label htmlFor="sender-display-name" className="mb-1 block text-sm font-medium text-slate-700">
                Display name <span className="text-red-600">*</span>
              </label>
              <input
                id="sender-display-name"
                value={displayName}
                onChange={(event) => setDisplayName(event.target.value)}
                maxLength={100}
                autoComplete="name"
                className={field}
                required
              />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-slate-700">
                Mail address <span className="text-red-600">*</span>
              </label>
              <div className="flex items-center gap-2">
                <input
                  aria-label="Email username"
                  value={localPart}
                  onChange={(event) => setLocalPart(event.target.value)}
                  placeholder="john.smith"
                  autoComplete="username"
                  className={field}
                  required
                />
                <span className="text-slate-400" aria-hidden>@</span>
                <input
                  aria-label="Email domain"
                  value={domain}
                  onChange={(event) => setDomain(event.target.value)}
                  placeholder="example.com"
                  autoComplete="email"
                  className={field}
                  required
                />
              </div>
              <p className="mt-1 text-xs text-slate-500">Address: {localPart.trim() && domain.trim() ? email : 'username@domain.com'}</p>
              {emailError && <p className="mt-1 text-xs text-red-600">{emailError}</p>}
            </div>
            <div>
              <label htmlFor="sender-reply-to" className="mb-1 block text-sm font-medium text-slate-700">
                Reply-to address <span className="text-slate-400">(optional)</span>
              </label>
              <input
                id="sender-reply-to"
                type="email"
                value={replyTo}
                onChange={(event) => setReplyTo(event.target.value)}
                placeholder="replies@example.com"
                autoComplete="email"
                className={`${field} ${replyToError ? 'border-red-500 focus:border-red-500 focus:ring-red-500' : ''}`}
                aria-invalid={Boolean(replyToError)}
              />
              {replyToError && <p className="mt-1 text-xs text-red-600">{replyToError}</p>}
            </div>
          </div>

          <label className="flex items-center gap-2 text-sm text-slate-700">
            <input
              type="checkbox"
              checked={makeDefault}
              onChange={(event) => setMakeDefault(event.target.checked)}
              disabled={editingId !== null && addresses.some((address) => address.id === editingId && address.isDefault)}
              className="h-4 w-4 rounded border-slate-300 text-primary-600 focus:ring-primary-500"
            />
            {editingId !== null && addresses.some((address) => address.id === editingId && address.isDefault)
              ? 'Default outgoing sender'
              : 'Use as the default outgoing sender'}
          </label>

          <div className="flex flex-wrap justify-end gap-2 border-t border-slate-100 pt-4">
            <button type="button" onClick={resetForm} disabled={saving} className="rounded-md border border-slate-300 px-4 py-2 text-sm text-slate-700 hover:bg-slate-50 disabled:opacity-50">
              Cancel
            </button>
            <button type="submit" disabled={!canSubmit} className="rounded-md bg-primary-600 px-4 py-2 text-sm font-medium text-white hover:bg-primary-700 disabled:opacity-50">
              {saving ? 'Saving…' : editingId === null ? 'Add address' : 'Save changes'}
            </button>
          </div>
        </form>
      )}

      <section aria-labelledby="configured-addresses-heading" className="overflow-hidden rounded-lg border border-slate-200 bg-white">
        <div className="flex items-center justify-between border-b border-slate-200 px-5 py-4">
          <div>
            <h2 id="configured-addresses-heading" className="text-base font-semibold text-slate-900">Configured sender addresses</h2>
            <p className="mt-1 text-sm text-slate-500">The default address is used for outgoing mail sent through DEX.</p>
          </div>
          {!loading && <span className="text-sm text-slate-500">{addresses.length} {addresses.length === 1 ? 'address' : 'addresses'}</span>}
        </div>

        {loading && <p className="px-5 py-10 text-center text-sm text-slate-400">Loading sender addresses…</p>}

        {!loading && !loadError && addresses.length === 0 && (
          <div className="px-5 py-10 text-center">
            <p className="text-sm font-medium text-slate-700">No sender addresses configured</p>
            <p className="mt-1 text-sm text-slate-500">Add an existing mailbox address to use as the default sender for DEX email.</p>
            <button type="button" onClick={startCreate} className="mt-4 text-sm font-medium text-primary-700 underline">
              Add your first address
            </button>
          </div>
        )}

        {!loading && addresses.length > 0 && (
          <ul className="divide-y divide-slate-100">
            {addresses.map((address) => (
              <li key={address.id} className="flex flex-col gap-4 px-5 py-4 sm:flex-row sm:items-center">
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary-50 text-primary-700" aria-hidden>
                  <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M21.75 6.75v10.5a2.25 2.25 0 0 1-2.25 2.25h-15a2.25 2.25 0 0 1-2.25-2.25V6.75m19.5 0A2.25 2.25 0 0 0 19.5 4.5h-15a2.25 2.25 0 0 0-2.25 2.25m19.5 0v.243a2.25 2.25 0 0 1-1.07 1.916l-7.5 4.615a2.25 2.25 0 0 1-2.36 0L3.32 8.91a2.25 2.25 0 0 1-1.07-1.916V6.75" />
                  </svg>
                </span>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="font-medium text-slate-900">{address.displayName}</p>
                    {address.isDefault && <span className="rounded-full bg-emerald-100 px-2.5 py-1 text-xs font-medium text-emerald-800">Default sender</span>}
                  </div>
                  <p className="break-all text-sm text-slate-600">{address.email}</p>
                  {address.replyTo && <p className="mt-1 text-xs text-slate-500">Replies go to {address.replyTo}</p>}
                </div>
                <div className="flex flex-wrap items-center gap-3 sm:justify-end">
                  {!address.isDefault && (
                    <button type="button" onClick={() => void changeDefault(address)} disabled={activeAction !== null} className="text-sm font-medium text-primary-700 hover:underline disabled:opacity-50">
                      {activeAction === address.id ? 'Updating…' : 'Make default'}
                    </button>
                  )}
                  <button type="button" onClick={() => startEdit(address)} disabled={activeAction !== null} className="text-sm text-slate-600 hover:text-slate-900 disabled:opacity-50">
                    Edit
                  </button>
                  <button type="button" onClick={() => void removeAddress(address)} disabled={activeAction !== null} className="text-sm text-red-600 hover:text-red-800 disabled:opacity-50">
                    Delete
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}

function Notice({ text, error }: { text: string; error?: boolean }) {
  return (
    <p role={error ? 'alert' : 'status'} className={`rounded-md px-3 py-2 text-sm ${error ? 'bg-red-50 text-red-700' : 'bg-emerald-50 text-emerald-700'}`}>
      {text}
    </p>
  );
}
