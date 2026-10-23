import { useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import { sendTestMail } from '../../api/mailSettingsApi';
import { escapeHtml, HTML_MARKER } from '../../utils/emailHtml';
import type { GroupPersonMember, GroupSummary } from '../../types/group';

interface Props {
  group: GroupSummary;
  technicians: GroupPersonMember[];
  users: GroupPersonMember[];
  onClose: () => void;
  onDone: (note: string) => void;
}

const validEmail = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/** Writes one message and emails it to every enabled technician (and optionally user) of a group. */
export default function GroupEmailModal({ group, technicians, users, onClose, onDone }: Props) {
  const [withUsers, setWithUsers] = useState(true);
  const [subject, setSubject] = useState('');
  const [message, setMessage] = useState('');
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const addresses = useMemo(() => {
    const people = [...technicians, ...(withUsers ? users : [])].filter((p) => p.enabled);
    return Array.from(new Set(people.map((p) => (p.email ?? '').trim()).filter((e) => validEmail.test(e))));
  }, [technicians, users, withUsers]);

  const send = async () => {
    if (!subject.trim() || !message.trim()) return setError('Enter a subject and a message.');
    if (addresses.length === 0) return setError('No member has an email address saved.');
    setSending(true);
    setError(null);
    const body = HTML_MARKER + message.trim().split(/\n{2,}/).map((p) => `<p>${escapeHtml(p).replace(/\n/g, '<br>')}</p>`).join('');
    const results = await Promise.allSettled(addresses.map((to) => sendTestMail(to, { subject: subject.trim(), body })));
    const failed = results.filter((r) => r.status === 'rejected');
    setSending(false);
    if (failed.length === results.length) {
      const reason = (failed[0] as PromiseRejectedResult).reason as { response?: { data?: { message?: string } } } | Error;
      return setError((reason as { response?: { data?: { message?: string } } }).response?.data?.message || (reason as Error).message || 'The email could not be sent.');
    }
    onDone(
      failed.length
        ? `Email sent to ${results.length - failed.length} of ${results.length} members of ${group.name}.`
        : `Email sent to ${results.length} member${results.length === 1 ? '' : 's'} of ${group.name}.`,
    );
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={onClose}>
      <motion.div
        initial={{ opacity: 0, scale: 0.96 }}
        animate={{ opacity: 1, scale: 1 }}
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-label="Email this group"
        className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-2xl bg-white p-5 shadow-xl"
      >
        <h2 className="text-lg font-semibold text-slate-900">Email {group.name}</h2>
        <p className="mt-1 text-sm text-slate-500">
          Goes to {addresses.length} email address{addresses.length === 1 ? '' : 'es'} at once.
        </p>
        <label className="mt-3 flex items-center gap-2 text-sm text-slate-700">
          <input type="checkbox" checked={withUsers} onChange={(e) => setWithUsers(e.target.checked)} className="h-4 w-4" />
          Include the group&apos;s users as well as its technicians
        </label>
        <input
          value={subject}
          onChange={(e) => setSubject(e.target.value)}
          placeholder="Subject"
          className="mt-3 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
        />
        <textarea
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          placeholder="Message"
          rows={7}
          className="mt-3 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
        />
        {error && <p className="mt-2 text-sm text-red-600">{error}</p>}
        <div className="mt-4 flex justify-end gap-2">
          <button type="button" onClick={onClose} className="rounded-lg px-3 py-1.5 text-sm text-slate-600 hover:bg-slate-100">
            Cancel
          </button>
          <button
            type="button"
            onClick={() => void send()}
            disabled={sending}
            className="rounded-lg bg-blue-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
          >
            {sending ? 'Sending…' : 'Send email'}
          </button>
        </div>
      </motion.div>
    </div>
  );
}
