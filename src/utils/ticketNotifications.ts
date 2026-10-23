import { getMailSettings, sendTestMail } from '../api/mailSettingsApi';
import { emailTicket } from '../api/itsmApi';
import { getGroupPeople } from '../api/groupApi';
import { escapeHtml, HTML_MARKER, renderBody } from './emailHtml';

const TEMPLATES_KEY = 'dex.notificationTemplates.v2';
const RULES_KEY = 'dex.notificationRules.v1';

export interface EmailTemplate {
  id: string;
  name: string;
  type: string;
  channel: 'EMAIL' | 'IN_APP';
  subject: string;
  body: string;
  active: boolean;
  /** Set on notifications built with the ServiceNow-style form: recipients live on the notification itself. */
  who?: { requester: boolean; technician: boolean; extra: string; users?: string[]; groups?: string[]; assignmentGroup?: boolean; subscribable?: boolean };
}
type StoredTemplate = EmailTemplate;

interface StoredRule {
  enabled: boolean;
  templateId: string;
  requester: boolean;
  technician: boolean;
}

const DEFAULT_CREATED: StoredTemplate = {
  id: 'default-ticket-created',
  name: 'Default - ticket created',
  type: 'TICKET_CREATED',
  channel: 'EMAIL',
  subject: '[{{ticket.id}}] New ticket: {{ticket.title}}',
  body: `Hi {{requester.name}},

Your ticket {{ticket.id}} ({{ticket.title}}) has been created with {{ticket.priority}} priority.

View your ticket: {{ticket.link}}

Thanks,
DEX IT Operations`,
  active: true,
};

function read<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/** The email addresses of every enabled technician and user in each group, keyed by group id. A group that cannot be read maps to []. */
export async function groupMemberEmails(groupIds: number[]): Promise<Record<number, string[]>> {
  const out: Record<number, string[]> = {};
  await Promise.all(
    Array.from(new Set(groupIds)).map(async (id) => {
      try {
        const [techs, users] = await Promise.all([getGroupPeople(id, 'TECHNICIAN'), getGroupPeople(id, 'USER')]);
        const emails = [...techs, ...users].filter((p) => p.enabled).map((p) => (p.email ?? '').trim()).filter((e) => EMAIL_RE.test(e));
        out[id] = Array.from(new Set(emails));
      } catch {
        out[id] = [];
      }
    }),
  );
  return out;
}

/** The {{raise.link}} value: a mailto: that opens a pre-filled Email Command addressed to the service desk mailbox. */
async function raiseLink(): Promise<string> {
  let supportEmail = '';
  try {
    supportEmail = (await getMailSettings()).fromEmail ?? '';
  } catch {
    /* link falls back to an empty address */
  }
  const command = encodeURIComponent('$$action=create;record=incident;priority=medium;description=Describe the issue here$$');
  return `mailto:${supportEmail}?subject=${encodeURIComponent('[ITSM] New incident')}&body=${command}`;
}

/** Every email template saved by the admin, for the "Notification template" picker. */
export function listEmailTemplates(): EmailTemplate[] {
  return read<StoredTemplate[]>(TEMPLATES_KEY, []).filter((t) => t.channel === 'EMAIL');
}

/** Requester name/email kept in this browser for an incident (same key as the incident details page). */
export function savedRequester(ticketId: number): { name: string; email: string } {
  try {
    const f = JSON.parse(localStorage.getItem(`dex.incident.fields.${ticketId}`) ?? '{}') as {
      requesterName?: string;
      requesterEmail?: string;
    };
    return { name: f.requesterName?.trim() ?? '', email: f.requesterEmail?.trim() ?? '' };
  } catch {
    return { name: '', email: '' };
  }
}

/** Stores the Mail ID on the incident's saved fields (same place the New Incident form puts it). */
export function saveRequesterEmail(ticketId: number, email: string): void {
  const key = `dex.incident.fields.${ticketId}`;
  try {
    const fields = JSON.parse(localStorage.getItem(key) ?? '{}') as Record<string, string>;
    localStorage.setItem(key, JSON.stringify({ ...fields, requesterEmail: email }));
  } catch {
    /* storage unavailable: the address is used for this send only */
  }
}

function findTemplate(eventType: string): StoredTemplate | undefined {
  const rule = read<Record<string, StoredRule>>(RULES_KEY, {})[eventType];
  const templates = read<StoredTemplate[]>(TEMPLATES_KEY, []).filter(
    (t) => t.type === eventType && t.channel === 'EMAIL',
  );
  return templates.find((t) => t.id === rule?.templateId) ?? templates.find((t) => t.active);
}

/**
 * Emails each given ticket with the event's active email template. The backend fills the template from the
 * ticket's own data; the requester's address and name come from the fields saved in this browser for the ticket
 * (same key as the incident details page). Returns a short status for the UI.
 */
export async function emailTicketsWithTemplate(
  tickets: { id: number }[],
  eventType = 'TICKET_CREATED',
  chosen?: EmailTemplate,
  /** Addresses mailed in addition to each ticket's saved Mail ID. */
  extraTo: string[] = [],
  opts: {
    /** False to skip the requester's saved Mail ID (default true). */
    includeRequester?: boolean;
    /** Extra addresses for one ticket, for example the members of its assignment group. */
    extraByTicket?: Record<number, string[]>;
  } = {},
): Promise<string> {
  const template = chosen ?? findTemplate(eventType) ?? (eventType === 'TICKET_CREATED' ? DEFAULT_CREATED : undefined);
  if (!template) return 'No active email template for this event, so no email was sent.';
  let sent = 0;
  const failed: string[] = [];
  const raise = await raiseLink();
  for (const ticket of tickets) {
    let fields: { requesterEmail?: string; requesterName?: string } = {};
    try {
      fields = JSON.parse(localStorage.getItem(`dex.incident.fields.${ticket.id}`) ?? '{}');
    } catch {
      /* no saved fields: the backend falls back to the ticket's requester */
    }
    // The server fills {{requester.name}} with the ticket's requester (an email address), so the saved name is put in here.
    const name = fields.requesterName?.trim() ?? '';
    const email = opts.includeRequester === false ? undefined : fields.requesterEmail?.trim();
    const to = [...(email ? [email] : []), ...extraTo, ...(opts.extraByTicket?.[ticket.id] ?? [])].filter((a, i, all) => all.indexOf(a) === i);
    if (to.length === 0) {
      failed.push('no recipient with an email address');
      continue;
    }
    try {
      // The backend takes at most 10 addresses per email, so a large group is mailed in batches.
      for (let i = 0; i < to.length; i += 10) {
        await emailTicket(ticket.id, {
          to: to.slice(i, i + 10),
          subject: withName(template.subject, name),
          body: withName(template.body, name, template.body.startsWith(HTML_MARKER)),
          vars: {
            'ticket.link': `${window.location.origin}/tickets/incidents/${ticket.id}`,
            'raise.link': raise,
          },
        });
      }
      sent += 1;
    } catch (e) {
      const data = (e as { response?: { data?: { message?: string } } })?.response?.data;
      failed.push(data?.message || (e instanceof Error ? e.message : 'failed'));
    }
  }
  if (failed.length === 0) return `Email sent for ${sent} ticket${sent === 1 ? '' : 's'}.`;
  return `Sent ${sent}, failed ${failed.length}: ${failed[0]}`;
}

/** Replaces {{requester.name}} with the requester's name; with no saved name the placeholder is left for the server. */
const withName = (text: string, name: string, html = false) =>
  name ? text.replace(/\{\{\s*requester\.name\s*\}\}/g, () => (html ? escapeHtml(name) : name)) : text;

const render = (text: string, vars: Record<string, string>) =>
  text.replace(/\{\{\s*([\w.]+)\s*\}\}/g, (match, key: string) => vars[key] ?? match);

/**
 * Emails the requester for a ticket event, using the Notification Rules and Templates set up by the admin.
 * Interim: it goes through the admin mail endpoint, so it only works for admin users and never throws —
 * a failed notification must not block the ticket itself. Returns a short status for the UI, or null if
 * no rule applies.
 */
export async function notifyTicketEvent(
  eventType: string,
  vars: Record<string, string>,
  recipients: { requesterEmail?: string; extra?: string[]; ticketId?: number },
  /** The person ticked "send email" on the form: mail the requester even if the rule is off or was never saved. */
  asked = false,
): Promise<string | null> {
  const stored = read<Record<string, StoredRule>>(RULES_KEY, {})[eventType];
  // Ticking the box overrides a rule that is off (the default) or missing: the requester is mailed either way.
  const rule = asked ? { ...{ templateId: '', technician: false }, ...stored, enabled: true, requester: true } as StoredRule : stored;
  const all = read<StoredTemplate[]>(TEMPLATES_KEY, []).filter((t) => t.channel === 'EMAIL');
  const pick = (type: string) => {
    const list = all.filter((t) => t.type === type);
    return list.find((t) => t.id === rule?.templateId) ?? list.find((t) => t.active);
  };
  // Resolved / closed fall back to the general "Status updated" notification when they have none of their own.
  const template =
    pick(eventType) ??
    (eventType === 'TICKET_RESOLVED' || eventType === 'TICKET_CLOSED' ? pick('TICKET_STATUS') : undefined) ??
    // The admin never saved a template for this event (the Templates page not opened yet): use the built-in one.
    (eventType === 'TICKET_CREATED' && !all.some((t) => t.type === eventType) ? DEFAULT_CREATED : undefined);

  // A notification with its own recipients ("Who will receive") is self-contained; otherwise the rule decides.
  const own = template?.active ? template.who : undefined;
  const sendToRequester = own ? own.requester : rule?.requester;
  const to = [
    ...(sendToRequester && recipients.requesterEmail ? [recipients.requesterEmail] : []),
    ...(own ? own.extra.split(/[,;\s]+/).filter(Boolean) : []),
    ...(own?.users ?? []),
    ...(recipients.extra ?? []),
  ].filter((address, index, all) => all.indexOf(address) === index);
  if (asked && to.length === 0) return 'No email was sent: there is no recipient.';
  if ((!own && !rule?.enabled) || to.length === 0) return null;
  // No active template: send a plain built-in email instead of skipping the notification.
  const eventLabel = eventType.replace(/^TICKET_/, '').replace(/_/g, ' ').toLowerCase();
  const message = template ?? {
    subject: `Ticket ${eventLabel}: {{ticket.id}}`,
    body:
      HTML_MARKER +
      `<p>Hello {{requester.name}},</p><p>Ticket <strong>{{ticket.id}}</strong> - {{ticket.title}} (${eventLabel}).</p>` +
      '<p>Priority: {{ticket.priority}}</p><p><a href="{{ticket.link}}">View ticket</a></p>',
  };

  // {{raise.link}}: a mailto: that opens a pre-filled Email Command ("[ITSM]" subject, $$key=value$$ body)
  // addressed to the service desk mailbox, so the receiver can raise a ticket by replying by email.
  let supportEmail = '';
  try {
    supportEmail = (await getMailSettings()).fromEmail ?? '';
  } catch {
    /* link falls back to an empty address */
  }
  const command = encodeURIComponent('$$action=create;record=incident;priority=medium;description=Describe the issue here$$');
  const allVars = {
    'raise.link': `mailto:${supportEmail}?subject=${encodeURIComponent('[ITSM] New incident')}&body=${command}`,
    ...vars,
  };

  const failed: string[] = [];
  let reason = '';
  for (const address of to) {
    const content = { subject: render(message.subject, allVars), body: renderBody(message.body, allVars) };
    try {
      // A saved ticket goes through the ticket email endpoint (any signed-in user); otherwise the admin test-mail one.
      if (recipients.ticketId) await emailTicket(recipients.ticketId, { to: [address], ...content, vars: allVars });
      else await sendTestMail(address, content);
    } catch (e) {
      failed.push(address);
      const data = (e as { response?: { data?: { message?: string } } })?.response?.data;
      reason ||= data?.message || (e instanceof Error ? e.message : '');
    }
  }
  const why = reason ? ` (${reason})` : '';
  if (failed.length === to.length) return `The ticket was created, but the email could not be sent to ${failed.join(', ')}${why}.`;
  if (failed.length) return `Email sent, but not to ${failed.join(', ')}${why}.`;
  return `Email sent to ${to.join(', ')}.`;
}

/** Splits a comma/semicolon/space separated list of addresses; `bad` holds the ones that are not valid emails. */
export function parseAddresses(list: string): { good: string[]; bad: string[] } {
  const all = Array.from(new Set(list.split(/[,;\s]+/).filter(Boolean)));
  return { good: all.filter((a) => EMAIL_RE.test(a)), bad: all.filter((a) => !EMAIL_RE.test(a)) };
}

/**
 * Emails the people on an incident's Watch list (customer-visible comments) or Work notes list (work notes).
 * Sent directly, whatever the notification rules say: being on the list is the request to be told.
 */
export async function notifyWatchers(
  ticket: { id: number; ticketCode: string; title: string },
  kind: 'comment' | 'work note',
  text: string,
  by: string,
  addresses: string[],
): Promise<string | null> {
  if (addresses.length === 0) return null;
  const link = `${window.location.origin}/tickets/incidents/${ticket.id}`;
  const subject = `[${ticket.ticketCode}] New ${kind}: ${ticket.title}`;
  const body =
    HTML_MARKER +
    `<p>${escapeHtml(by)} added a ${kind} to <strong>${escapeHtml(ticket.ticketCode)}</strong> - ${escapeHtml(ticket.title)}:</p>` +
    `<blockquote>${escapeHtml(text).replace(/\n/g, '<br>')}</blockquote><p><a href="${link}">View incident</a></p>`;
  const failed: string[] = [];
  for (const address of addresses) {
    try {
      await emailTicket(ticket.id, { to: [address], subject, body });
    } catch {
      failed.push(address);
    }
  }
  if (failed.length === addresses.length) return `The ${kind} was saved, but the email could not be sent to ${failed.join(', ')}.`;
  if (failed.length) return `${kind[0].toUpperCase()}${kind.slice(1)} emailed, but not to ${failed.join(', ')}.`;
  return `${kind[0].toUpperCase()}${kind.slice(1)} emailed to ${addresses.join(', ')}.`;
}

/** Tells the members of the incident's assignment group that it was resolved. Sent directly, whatever the notification rules say. */
export async function notifyGroupResolved(
  ticket: { id: number; ticketCode: string; title: string },
  groupName: string,
  by: string,
  note: string,
  addresses: string[],
): Promise<string | null> {
  if (addresses.length === 0) return null;
  const link = `${window.location.origin}/tickets/incidents/${ticket.id}`;
  const subject = `[${ticket.ticketCode}] Resolved: ${ticket.title}`;
  const body =
    HTML_MARKER +
    `<p>${escapeHtml(by)} resolved <strong>${escapeHtml(ticket.ticketCode)}</strong> - ${escapeHtml(ticket.title)}, assigned to the ${escapeHtml(groupName)} group.</p>` +
    (note ? `<blockquote>${escapeHtml(note).replace(/\n/g, '<br>')}</blockquote>` : '') +
    `<p><a href="${link}">View incident</a></p>`;
  const failed: string[] = [];
  for (const address of addresses) {
    try {
      await emailTicket(ticket.id, { to: [address], subject, body });
    } catch {
      failed.push(address);
    }
  }
  if (failed.length === addresses.length) return `The ${groupName} group could not be emailed (${failed.join(', ')}).`;
  if (failed.length) return `${groupName} group emailed, but not ${failed.join(', ')}.`;
  return `${groupName} group emailed (${addresses.length} member${addresses.length === 1 ? '' : 's'}).`;
}
