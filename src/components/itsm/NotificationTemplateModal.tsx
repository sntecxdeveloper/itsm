import { createPortal } from 'react-dom';
import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { getGroupPeople } from '../../api/groupApi';
import { Button } from '../ui/Button';
import { isHtmlBody, previewHtml, renderBody } from '../../utils/emailHtml';
import {
  emailTicketsWithTemplate,
  listEmailTemplates,
  saveRequesterEmail,
  savedRequester,
  type EmailTemplate,
} from '../../utils/ticketNotifications';

const validEmail = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/** Pick a notification template for the selected incidents and email it to each incident's Mail ID. */
export default function NotificationTemplateModal({
  tickets,
  onClose,
  onDone,
}: {
  tickets: {
    id: number;
    ticketCode: string;
    title?: string;
    priority?: string;
    status?: string;
    category?: string;
    assignedTo?: string;
    assignmentGroupId?: number | null;
    assignmentGroup?: string | null;
  }[];
  onClose: () => void;
  onDone: (note: string) => void;
}) {
  const templates = useMemo<EmailTemplate[]>(listEmailTemplates, []);
  const [templateId, setTemplateId] = useState(templates.find((t) => t.active)?.id ?? templates[0]?.id ?? '');
  const [busy, setBusy] = useState(false);
  const template = templates.find((t) => t.id === templateId);
  // Edits apply to this send only; the saved template is changed in Notification Templates.
  const [edit, setEdit] = useState<{ id: string; subject: string; body: string } | null>(null);
  const draft = template && edit?.id === template.id ? edit : null;
  // One incident: show the subject and message already filled with its real number, title and so on.
  // Several incidents: keep the {{variables}}, they are filled per incident when sent.
  const only = tickets.length === 1 ? tickets[0] : null;
  const vars: Record<string, string> = only
    ? {
        'ticket.id': only.ticketCode,
        'ticket.title': only.title ?? '',
        'ticket.priority': only.priority ?? '',
        'ticket.status': only.status ?? '',
        'ticket.category': only.category ?? '',
        'ticket.assignedTo': only.assignedTo ?? '',
        'technician.name': only.assignedTo ?? '',
        'ticket.link': `${window.location.origin}/tickets/incidents/${only.id}`,
        ...(savedRequester(only.id).name ? { 'requester.name': savedRequester(only.id).name } : {}),
      }
    : {};
  const fill = (text: string) => (only ? renderBody(text, vars) : text);
  const subject = draft?.subject ?? fill(template?.subject ?? '');
  const body = draft?.body ?? fill(template?.body ?? '');
  const change = (patch: Partial<{ subject: string; body: string }>) =>
    template && setEdit({ id: template.id, subject, body, ...patch });
  const [emails, setEmails] = useState<Record<number, string>>(() =>
    Object.fromEntries(tickets.map((t) => [t.id, savedRequester(t.id).email])),
  );
  const [formError, setFormError] = useState<string | null>(null);

  // The people in each assignment group (technicians and users), for "send to the group".
  const groupIds = useMemo(
    () => Array.from(new Set(tickets.map((t) => t.assignmentGroupId).filter((g): g is number => typeof g === 'number'))),
    [tickets],
  );
  const [toRequester, setToRequester] = useState(true);
  const [toGroup, setToGroup] = useState(true);
  const [groupMail, setGroupMail] = useState<Record<number, { emails: string[]; people: number }> | null>(groupIds.length ? null : {});
  const groupKey = groupIds.join(',');
  useEffect(() => {
    if (!groupKey) return;
    let live = true;
    Promise.all(
      groupKey.split(',').map(Number).map(async (id) => {
        const [techs, users] = await Promise.all([getGroupPeople(id, 'TECHNICIAN'), getGroupPeople(id, 'USER')]);
        const people = [...techs, ...users].filter((p) => p.enabled);
        const emails = people.map((p) => (p.email ?? '').trim()).filter((e) => validEmail.test(e));
        return [id, { emails: Array.from(new Set(emails)), people: people.length }] as const;
      }),
    )
      .then((entries) => live && setGroupMail(Object.fromEntries(entries)))
      .catch(() => live && setGroupMail({}));
    return () => {
      live = false;
    };
  }, [groupKey]);
  const groupTickets = tickets.filter((t) => t.assignmentGroupId != null);
  const groupAddressCount = new Set(groupIds.flatMap((id) => groupMail?.[id]?.emails ?? [])).size;
  const missing = toRequester ? tickets.filter((t) => !(emails[t.id] ?? '').trim()).length : 0;

  const send = async () => {
    if (!template) return;
    if (!toRequester && !(toGroup && groupAddressCount > 0)) return setFormError('Choose someone to send it to.');
    const noMail = toRequester ? tickets.find((t) => !(emails[t.id] ?? '').trim()) : undefined;
    if (noMail) return setFormError(`Enter the receiver's Mail ID for ${noMail.ticketCode}.`);
    const bad = toRequester ? tickets.find((t) => !validEmail.test(emails[t.id].trim())) : undefined;
    if (bad) return setFormError(`Enter a valid Mail ID for ${bad.ticketCode}.`);
    setFormError(null);
    setBusy(true);
    try {
      // Remember the edited Mail IDs on the incidents, then send.
      if (toRequester) tickets.forEach((t) => (emails[t.id] ?? '').trim() && saveRequesterEmail(t.id, emails[t.id].trim()));
      const extraByTicket: Record<number, string[]> = {};
      if (toGroup) groupTickets.forEach((t) => (extraByTicket[t.id] = groupMail?.[t.assignmentGroupId as number]?.emails ?? []));
      onDone(await emailTicketsWithTemplate(tickets, template.type, { ...template, subject, body }, [], { includeRequester: toRequester, extraByTicket }));
    } finally {
      setBusy(false);
    }
  };

  return createPortal(
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-900/50 p-4" onClick={onClose}>
      <div
        role="dialog"
        aria-modal="true"
        className="max-h-[90vh] w-full max-w-lg space-y-4 overflow-y-auto rounded-xl bg-white p-5 shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 className="text-base font-semibold text-slate-900">
          Notification template · {tickets.length} incident{tickets.length === 1 ? '' : 's'}
        </h2>

        {templates.length === 0 ? (
          <p className="text-sm text-slate-500">
            No email templates yet. Create one in{' '}
            <Link to="/setup/automation/notification-templates" className="text-primary-600 underline">Notification Templates</Link>.
          </p>
        ) : (
          <>
            <label className="block text-sm font-medium text-slate-700">
              Template
              <select
                value={templateId}
                onChange={(e) => setTemplateId(e.target.value)}
                className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-800 focus:border-primary-500 focus:outline-none"
              >
                {templates.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.name}{t.active ? ' (active)' : ''}
                  </option>
                ))}
              </select>
            </label>

            {template && (
              <div className="space-y-2">
                <label className="block text-sm font-medium text-slate-700">
                  Subject
                  <input
                    value={subject}
                    onChange={(e) => change({ subject: e.target.value })}
                    className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-800 focus:border-primary-500 focus:outline-none"
                  />
                </label>
                <label className="block text-sm font-medium text-slate-700">
                  Message
                  {isHtmlBody(body) ? (
                    <div
                      className="mt-1 max-h-56 overflow-auto rounded-lg border border-slate-300 bg-slate-50 px-3 py-2 text-sm font-normal text-slate-800 [&_a]:text-sky-700 [&_a]:underline [&_ol]:ml-5 [&_ol]:list-decimal [&_ul]:ml-5 [&_ul]:list-disc"
                      dangerouslySetInnerHTML={{ __html: previewHtml(body, {}) }}
                    />
                  ) : (
                    <textarea
                      rows={8}
                      value={body}
                      onChange={(e) => change({ body: e.target.value })}
                      className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 font-mono text-xs text-slate-800 focus:border-primary-500 focus:outline-none"
                    />
                  )}
                </label>
                <div className="flex items-center justify-between text-xs text-slate-500">
                  <span>
                    {draft ? 'Edited for this send only. ' : ''}
                    {only ? 'Filled in from this incident.' : <>Variables like {'{{ticket.id}}'} are filled in per incident.</>}
                    {isHtmlBody(body) ? ' Formatted message: change it in Notification Templates.' : ''}
                  </span>
                  <span className="flex gap-3">
                    {draft && (
                      <button type="button" onClick={() => setEdit(null)} className="text-primary-600 hover:underline">
                        Reset
                      </button>
                    )}
                    <Link to="/setup/automation/notification-templates" className="text-primary-600 hover:underline">
                      Edit saved template
                    </Link>
                  </span>
                </div>
              </div>
            )}

            <div className="space-y-1.5 rounded-md border border-slate-200 bg-slate-50 p-3 text-sm">
              <p className="font-medium text-slate-700">Send to</p>
              <label className="flex items-center gap-2 text-slate-800">
                <input type="checkbox" checked={toRequester} onChange={(e) => setToRequester(e.target.checked)} className="h-4 w-4" />
                The requester&apos;s Mail ID
              </label>
              {groupTickets.length > 0 ? (
                <label className="flex items-start gap-2 text-slate-800">
                  <input type="checkbox" checked={toGroup} onChange={(e) => setToGroup(e.target.checked)} className="mt-0.5 h-4 w-4" />
                  <span>
                    The assignment group&apos;s technicians and users
                    <span className="block text-xs text-slate-500">
                      {groupMail === null
                        ? 'Loading the group…'
                        : groupTickets
                            .map((t) => t.assignmentGroup)
                            .filter((n, i, all) => n && all.indexOf(n) === i)
                            .join(', ') + ` · ${groupAddressCount} email address${groupAddressCount === 1 ? '' : 'es'}`}
                      {groupMail !== null && toGroup && groupAddressCount === 0 ? ' (the members have no email address saved)' : ''}
                    </span>
                  </span>
                </label>
              ) : (
                <p className="text-xs text-slate-500">To email a group, assign the incident to a group first (Actions → Assign → A group).</p>
              )}
            </div>

            {toRequester && (
            <div>
              <p className="mb-1 text-sm font-medium text-slate-700">Requester Mail ID</p>
              <ul className="max-h-36 divide-y divide-slate-100 overflow-y-auto rounded-md border border-slate-200 text-sm">
                {tickets.map((tk) => (
                  <li key={tk.id} className="flex items-center justify-between gap-3 px-3 py-1.5">
                    <span className="shrink-0 font-medium text-slate-800">{tk.ticketCode}</span>
                    <input
                      type="email"
                      value={emails[tk.id] ?? ''}
                      onChange={(e) => setEmails((cur) => ({ ...cur, [tk.id]: e.target.value }))}
                      placeholder="Mail ID"
                      aria-label={`Mail ID for ${tk.ticketCode}`}
                      className="w-full max-w-[16rem] rounded border border-slate-300 px-2 py-1 text-sm text-slate-800 focus:border-primary-500 focus:outline-none"
                    />
                  </li>
                ))}
              </ul>
              {missing > 0 && (
                <p className="mt-1 text-xs text-amber-600">
                  Enter the receiver&apos;s Mail ID for {missing} incident{missing === 1 ? '' : 's'}; the email is sent to it.
                </p>
              )}
            </div>
            )}
            {formError && <p className="text-xs text-red-600">{formError}</p>}
          </>
        )}

        <div className="flex justify-end gap-3">
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={send} disabled={!template} loading={busy}>
            Send email
          </Button>
        </div>
      </div>
    </div>,
    document.body,
  );
}
