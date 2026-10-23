import { useCallback, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useNavigate } from 'react-router-dom';
import RichTextEditor, { type RichTextEditorHandle } from '../../components/RichTextEditor';
import { useAppDispatch } from '../../hooks/useAppDispatch';
import { useAppSelector } from '../../hooks/useAppSelector';
import { fetchTickets } from '../../features/itsm/itsmSlice';
import {
  deleteDraft,
  listMailbox,
  readInboxMessage,
  readLoggedMessage,
  saveDraft,
  sendMailbox,
  type ComposePayload,
  type MailFolder,
  type MailListItem,
  type MailMessage,
} from '../../api/mailboxApi';
import { HTML_MARKER, sanitizeHtml } from '../../utils/emailHtml';

const PAGE_SIZE = 25;
const FOLDERS: { id: MailFolder; label: string }[] = [
  { id: 'INBOX', label: 'Inbox' },
  { id: 'SENT', label: 'Sent' },
  { id: 'DRAFTS', label: 'Drafts' },
];

const errorText = (error: unknown, fallback: string) => {
  const data = (error as { response?: { data?: { message?: string } } })?.response?.data;
  return data?.message || (error instanceof Error ? error.message : fallback);
};

const stamp = (iso?: string | null) => {
  if (!iso) return '';
  const d = new Date(iso);
  if (isNaN(d.getTime())) return '';
  const p = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}`;
};

const btn = 'rounded border border-slate-300 bg-white px-3 py-1.5 text-xs font-medium text-slate-800 hover:bg-slate-50 disabled:opacity-50';
const primary = 'rounded bg-primary-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-primary-700 disabled:opacity-50';

interface Compose {
  draftId?: number | null;
  to: string;
  subject: string;
  body: string;
}

/** Inbox (read live from the support mailbox), Sent and Drafts, with compose and reply. */
export default function MailboxMessages() {
  const navigate = useNavigate();
  const dispatch = useAppDispatch();
  const tickets = useAppSelector((s) => s.itsm.tickets);
  const [folder, setFolder] = useState<MailFolder>('INBOX');
  const [page, setPage] = useState(0);
  const [items, setItems] = useState<MailListItem[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [selected, setSelected] = useState<string | null>(null);
  const [message, setMessage] = useState<MailMessage | null>(null);
  const [opening, setOpening] = useState(false);
  const [compose, setCompose] = useState<Compose | null>(null);

  useEffect(() => {
    dispatch(fetchTickets());
  }, [dispatch]);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await listMailbox(folder, page, PAGE_SIZE);
      setItems(result.items);
      setTotal(result.total);
    } catch (e) {
      setItems([]);
      setTotal(0);
      setError(errorText(e, 'Could not load the mailbox'));
    } finally {
      setLoading(false);
    }
  }, [folder, page]);

  useEffect(() => {
    void load();
  }, [load]);

  const changeFolder = (next: MailFolder) => {
    setFolder(next);
    setPage(0);
    setSelected(null);
    setMessage(null);
    setNotice(null);
  };

  const keyOf = (item: MailListItem) => (item.uid !== undefined ? `u${item.uid}` : `l${item.id}`);

  const open = async (item: MailListItem) => {
    setSelected(keyOf(item));
    setOpening(true);
    setMessage(null);
    setNotice(null);
    try {
      setMessage(item.uid !== undefined ? await readInboxMessage(item.uid) : await readLoggedMessage(item.id as number));
    } catch (e) {
      setNotice(errorText(e, 'Could not open the message'));
    } finally {
      setOpening(false);
    }
  };

  const ticketFor = (code?: string | null) => (code ? tickets.find((t) => t.ticketCode === code) : undefined);

  const reply = () => {
    if (!message) return;
    const address = /<([^>]+)>/.exec(message.from)?.[1] ?? message.from;
    setCompose({ to: address, subject: /^re:/i.test(message.subject) ? message.subject : `Re: ${message.subject}`, body: '' });
  };

  const editDraft = () => {
    if (message?.draftId) setCompose({ draftId: message.draftId, to: message.to, subject: message.subject, body: message.body });
  };

  const removeDraft = async () => {
    if (!message?.draftId || !window.confirm('Delete this draft?')) return;
    try {
      await deleteDraft(message.draftId);
      setMessage(null);
      setSelected(null);
      void load();
    } catch (e) {
      setNotice(errorText(e, 'Could not delete the draft'));
    }
  };

  const pages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const ticket = message ? ticketFor(message.ticketCode) : undefined;

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        {FOLDERS.map((f) => (
          <button
            key={f.id}
            onClick={() => changeFolder(f.id)}
            className={`rounded px-3 py-1.5 text-xs font-medium ${folder === f.id ? 'bg-primary-600 text-white' : 'border border-slate-300 bg-white text-slate-800 hover:bg-slate-50'}`}
          >
            {f.label}
          </button>
        ))}
        <button className={btn} onClick={() => void load()} disabled={loading}>{loading ? 'Loading…' : 'Refresh'}</button>
        <button className={`${primary} ml-auto`} onClick={() => setCompose({ to: '', subject: '', body: '' })}>Compose</button>
      </div>

      {error && <p role="alert" className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}
      {notice && <p role="status" className="rounded-md bg-emerald-50 px-3 py-2 text-sm text-emerald-700">{notice}</p>}

      <div className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.2fr)]">
        <div className="overflow-hidden rounded-lg border border-slate-200 bg-white">
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50 text-left text-slate-500">
                <th className="px-3 py-2 font-medium">{folder === 'INBOX' ? 'From' : 'To'}</th>
                <th className="px-3 py-2 font-medium">Subject</th>
                <th className="px-3 py-2 font-medium">Date</th>
              </tr>
            </thead>
            <tbody>
              {items.map((item) => {
                const code = item.ticketCode ?? item.ticket_code;
                return (
                  <tr
                    key={keyOf(item)}
                    onClick={() => void open(item)}
                    className={`cursor-pointer border-b border-slate-100 hover:bg-primary-50/40 ${selected === keyOf(item) ? 'bg-primary-50' : ''}`}
                  >
                    <td className={`max-w-[10rem] truncate px-3 py-2 ${folder === 'INBOX' && item.seen === false ? 'font-semibold text-slate-900' : 'text-slate-700'}`}>
                      {folder === 'INBOX' ? item.from : item.to_address || '(no recipient)'}
                    </td>
                    <td className={`px-3 py-2 ${folder === 'INBOX' && item.seen === false ? 'font-semibold text-slate-900' : 'text-slate-800'}`}>
                      {item.subject || '(no subject)'}
                      {code && <span className="ml-2 rounded bg-sky-100 px-1.5 py-0.5 text-[10px] text-sky-800">{code}</span>}
                      {item.status === 'FAILED' && <span className="ml-2 rounded bg-red-100 px-1.5 py-0.5 text-[10px] text-red-700">Failed</span>}
                    </td>
                    <td className="whitespace-nowrap px-3 py-2 text-slate-500">{stamp(item.date ?? item.created_at)}</td>
                  </tr>
                );
              })}
              {items.length === 0 && !loading && !error && (
                <tr><td colSpan={3} className="px-3 py-10 text-center text-slate-400">No messages</td></tr>
              )}
            </tbody>
          </table>
          <div className="flex items-center justify-between border-t border-slate-200 px-3 py-2 text-xs text-slate-500">
            <span>{total} message{total === 1 ? '' : 's'}</span>
            <span className="flex items-center gap-2">
              <button className={btn} disabled={page === 0 || loading} onClick={() => setPage((p) => p - 1)}>Previous</button>
              {page + 1} / {pages}
              <button className={btn} disabled={page + 1 >= pages || loading} onClick={() => setPage((p) => p + 1)}>Next</button>
            </span>
          </div>
        </div>

        <div className="min-h-[16rem] rounded-lg border border-slate-200 bg-white p-4">
          {opening && <p className="text-sm text-slate-400">Opening…</p>}
          {!opening && !message && <p className="py-10 text-center text-sm text-slate-400">Select a message to read it</p>}
          {message && (
            <div className="space-y-3">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <h2 className="text-sm font-semibold text-slate-900">{message.subject || '(no subject)'}</h2>
                <div className="flex flex-wrap gap-2">
                  {folder === 'INBOX' && <button className={primary} onClick={reply}>Reply</button>}
                  {folder === 'DRAFTS' && <button className={primary} onClick={editDraft}>Edit</button>}
                  {folder === 'DRAFTS' && <button className={btn} onClick={() => void removeDraft()}>Delete</button>}
                  {ticket && <button className={btn} onClick={() => navigate(`/tickets/incidents/${ticket.id}`)}>Open {ticket.ticketCode}</button>}
                </div>
              </div>
              <dl className="grid grid-cols-[3.5rem_1fr] gap-x-2 gap-y-1 text-xs text-slate-600">
                <dt className="text-slate-400">From</dt><dd className="break-words">{message.from}</dd>
                <dt className="text-slate-400">To</dt><dd className="break-words">{message.to}</dd>
                <dt className="text-slate-400">Date</dt><dd>{stamp(message.date)}</dd>
                {message.ticketCode && (<><dt className="text-slate-400">Ticket</dt><dd>{message.ticketCode}{!ticket && ' (not in the loaded list)'}</dd></>)}
              </dl>
              {message.status === 'FAILED' && <p className="rounded bg-red-50 px-3 py-2 text-xs text-red-700">Not delivered: {message.error}</p>}
              <div className="border-t border-slate-100 pt-3">
                {message.html || message.body.startsWith(HTML_MARKER) ? (
                  <div
                    className="text-sm text-slate-800 [&_a]:text-sky-700 [&_a]:underline [&_ol]:ml-5 [&_ol]:list-decimal [&_ul]:ml-5 [&_ul]:list-disc"
                    dangerouslySetInnerHTML={{ __html: sanitizeHtml(message.body.replace(HTML_MARKER, '')) }}
                  />
                ) : (
                  <pre className="whitespace-pre-wrap font-sans text-sm text-slate-800">{message.body}</pre>
                )}
              </div>
            </div>
          )}
        </div>
      </div>

      {compose && (
        <ComposeModal
          initial={compose}
          onClose={() => setCompose(null)}
          onDone={(text) => {
            setCompose(null);
            setNotice(text);
            void load();
          }}
        />
      )}
    </div>
  );
}

function ComposeModal({ initial, onClose, onDone }: { initial: Compose; onClose: () => void; onDone: (note: string) => void }) {
  const editor = useRef<RichTextEditorHandle>(null);
  const [draftId, setDraftId] = useState<number | null>(initial.draftId ?? null);
  const [to, setTo] = useState(initial.to);
  const [subject, setSubject] = useState(initial.subject);
  const [body, setBody] = useState(initial.body);
  const [busy, setBusy] = useState(false);
  const [wide, setWide] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const payload = (): ComposePayload => ({ draftId, to, subject, body });
  const emptyBody = body.replace(HTML_MARKER, '').replace(/<[^>]*>/g, '').trim() === '';

  const send = async () => {
    setBusy(true);
    setError(null);
    try {
      onDone(await sendMailbox(payload()));
    } catch (e) {
      setError(errorText(e, 'The mail was not sent'));
      setBusy(false);
    }
  };

  const keep = async () => {
    setBusy(true);
    setError(null);
    try {
      setDraftId(await saveDraft(payload()));
      onDone('Draft saved.');
    } catch (e) {
      setError(errorText(e, 'Could not save the draft'));
      setBusy(false);
    }
  };

  const row = 'flex items-center gap-2 border-b border-slate-200 px-5';
  const bare = 'min-w-0 flex-1 bg-transparent py-2 text-sm text-slate-900 placeholder:text-slate-500 focus:outline-none';
  const sendDisabled = busy || !to.trim() || !subject.trim() || emptyBody;

  return createPortal(
    <div className="fixed inset-0 z-[100] flex items-end justify-end bg-slate-900/20 p-4 sm:pr-10" onClick={onClose}>
      <div
        role="dialog"
        aria-modal="true"
        className={`flex flex-col overflow-hidden rounded-t-xl bg-white shadow-2xl ring-1 ring-slate-200 ${wide ? 'h-[85vh] w-full max-w-4xl self-center rounded-xl' : 'h-[34rem] max-h-[90vh] w-full max-w-xl'}`}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between bg-[#f2f6fc] px-5 py-2.5">
          <h2 className="text-sm font-medium text-slate-900">{draftId ? 'Edit draft' : 'New Message'}</h2>
          <span className="flex items-center gap-1 text-slate-600">
            <button type="button" title={wide ? 'Exit full screen' : 'Full screen'} onClick={() => setWide((v) => !v)} className="rounded px-2 py-0.5 hover:bg-slate-200">{wide ? '↙' : '⤢'}</button>
            <button type="button" title="Close" onClick={onClose} disabled={busy} className="rounded px-2 py-0.5 hover:bg-slate-200">✕</button>
          </span>
        </div>
        <label className={row}>
          <span className="text-sm text-slate-600">To</span>
          <input value={to} onChange={(e) => setTo(e.target.value)} className={bare} aria-label="To (separate several with commas)" autoFocus />
        </label>
        <label className={row}>
          <input value={subject} onChange={(e) => setSubject(e.target.value)} className={bare} placeholder="Subject" aria-label="Subject" />
        </label>
        {error && <p role="alert" className="bg-red-50 px-5 py-2 text-xs text-red-700">{error}</p>}
        <RichTextEditor
          ref={editor}
          compact
          value={body}
          resetKey={`compose-${initial.draftId ?? 'new'}-${initial.subject}`}
          onChange={setBody}
          leading={
            <button
              type="button"
              onClick={() => void send()}
              disabled={sendDisabled}
              className="rounded-full bg-[#0b57d0] px-6 py-2 text-sm font-medium text-white hover:bg-[#0a4cb8] disabled:cursor-not-allowed disabled:opacity-50"
            >
              {busy ? 'Sending…' : 'Send'}
            </button>
          }
          trailing={
            <button type="button" className="rounded-full px-3 py-2 text-xs font-medium text-slate-700 hover:bg-slate-100 disabled:opacity-50" onClick={() => void keep()} disabled={busy || (!to.trim() && !subject.trim() && emptyBody)}>
              Save draft
            </button>
          }
        />
      </div>
    </div>,
    document.body,
  );
}
