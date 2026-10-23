import { useState, type ReactNode } from 'react';
import { control } from './IncidentFormPage';
import type { TicketStatus } from '../../types';

/** Small-text form look, shared with the incident pages. */
export const FORM_WRAP =
  '-mx-1 [&_input]:!py-1 [&_select]:!py-1 [&_textarea]:!py-1 [&_input]:!text-[11px] [&_select]:!text-[11px] [&_textarea]:!text-[11px] [&_label]:!text-[11px] [&_button]:!text-[11px]';

export const actionBtn =
  'rounded border border-slate-300 bg-white px-3 py-1.5 text-[13px] font-medium text-slate-800 hover:bg-slate-50 disabled:text-slate-300 disabled:hover:bg-white';
export const primaryBtn =
  'rounded bg-primary-600 px-4 py-1.5 text-[13px] font-medium text-white hover:bg-primary-700 disabled:opacity-60';
export const iconBtn =
  'flex h-8 w-8 items-center justify-center rounded border border-slate-300 bg-white text-slate-600 hover:bg-slate-50 disabled:text-slate-300 disabled:hover:bg-white';

// Service-request wording for the four ticket states the backend knows.
export const STATE_LABEL: Record<TicketStatus, string> = {
  OPEN: 'Open',
  IN_PROGRESS: 'Work in Progress',
  RESOLVED: 'Closed Complete',
  CLOSED: 'Closed Incomplete',
};
export const STATES: TicketStatus[] = ['OPEN', 'IN_PROGRESS', 'RESOLVED', 'CLOSED'];

export interface CatalogCategory {
  key: string;
  title: string;
  description: string;
  items: { name: string; description: string }[];
}

/** What a user can ask for, grouped the way the Service Requests landing page shows it. */
export const CATALOG: CatalogCategory[] = [
  {
    key: 'software',
    title: 'Software',
    description: 'Install, upgrade or license an application',
    items: [
      { name: 'Software Installation', description: 'Install an approved application on your device' },
      { name: 'Software Upgrade', description: 'Move an installed application to a newer version' },
      { name: 'Software License Request', description: 'Request a license or seat for a paid application' },
    ],
  },
  {
    key: 'ad',
    title: 'AD',
    description: 'Active Directory accounts, groups and permissions',
    items: [
      { name: 'System Access', description: 'Request access to a system' },
      { name: 'Adobe Access', description: 'Request access to Adobe applications' },
      { name: 'Outlook 365 Access', description: 'Request access to Outlook / Microsoft 365' },
    ],
  },
  {
    key: 'iam',
    title: 'IAM Team',
    description: 'Identity and access management requests',
    items: [
      { name: 'Onboarding', description: 'Access and accounts for a new joiner' },
      { name: 'Offboarding', description: 'Remove access and accounts for a leaver' },
    ],
  },
];

export const CATALOG_ITEMS = CATALOG.flatMap((c) => c.items.map((i) => i.name));
export const STAGES = ['Request Approved', 'Fulfillment', 'Delivery', 'Completed'];

export const requestNumber = (id: number) => `REQ${String(id).padStart(7, '0')}`;

export const stamp = (iso?: string | number | Date) => {
  if (iso == null || iso === '') return '';
  const d = new Date(iso);
  if (isNaN(d.getTime())) return '';
  const p = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}:${p(d.getSeconds())}`;
};

/** Value for an <input type="datetime-local"> from a stored string. */
export const toLocalInput = (v: string) => (v ? v.replace(' ', 'T').slice(0, 16) : '');

// The backend stores only the ticket itself: everything else is kept in this browser, per record.
export function readJson<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    if (raw == null) return fallback;
    const parsed = JSON.parse(raw) as T;
    return Array.isArray(fallback) ? parsed : { ...fallback, ...parsed };
  } catch {
    return fallback;
  }
}
export function writeJson(key: string, value: unknown) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    /* storage unavailable: the values stay for this visit only */
  }
}

/* ------------------------------ Requested item ------------------------------ */

export interface RitmFields {
  item: string;
  requestedFor: string;
  requestedBy: string;
  openedBy: string;
  assignmentGroup: string;
  assignedTo: string;
  dueDate: string;
  ci: string;
  parent: string;
  watchList: string;
  stage: string;
  quantity: string;
  estimatedDelivery: string;
  backordered: boolean;
  contact: string;
  phone: string;
  email: string;
  location: string;
}

export const NO_RITM: RitmFields = {
  item: '',
  requestedFor: '',
  requestedBy: '',
  openedBy: '',
  assignmentGroup: '',
  assignedTo: '',
  dueDate: '',
  ci: '',
  parent: '',
  watchList: '',
  stage: 'Request Approved',
  quantity: '1',
  estimatedDelivery: '',
  backordered: false,
  contact: '',
  phone: '',
  email: '',
  location: '',
};

export const ritmKey = (id: number) => `dex.ritm.fields.${id}`;
export const ritmTasksKey = (id: number) => `dex.ritm.tasks.${id}`;
export const loadRitm = (id: number) => readJson<RitmFields>(ritmKey(id), NO_RITM);

/* ------------------------------- Catalog task ------------------------------- */

export interface TaskNote {
  kind: 'Work notes' | 'Additional comments' | 'Field changes';
  at: string;
  by: string;
  text?: string;
  changes?: [string, string][];
}

export interface TaskFields {
  requestItem: number | null;
  affectedCi: string;
  watchList: string;
  workInstructions: string;
  affectedCis: string[];
}

export const NO_TASK: TaskFields = { requestItem: null, affectedCi: '', watchList: '', workInstructions: '', affectedCis: [] };

export const taskKey = (id: number) => `dex.task.fields.${id}`;
export const taskNotesKey = (id: number) => `dex.task.notes.${id}`;
export const loadTask = (id: number) => readJson<TaskFields>(taskKey(id), NO_TASK);

/* --------------------------------- Widgets --------------------------------- */

export function ReadOnly({ value, className = '' }: { value?: string; className?: string }) {
  return <input disabled readOnly value={value ?? ''} className={`${control} ${className}`} />;
}

export function Banner({ text, tone = 'amber' }: { text: string; tone?: 'amber' | 'red' }) {
  const cls = tone === 'red' ? 'bg-red-50 text-red-600' : 'bg-amber-50 text-amber-700';
  return <p className={`px-3 py-1.5 text-[13px] ${cls}`}>{text}</p>;
}

function Stacked({ label, required, children }: { label: string; required?: boolean; children: ReactNode }) {
  return (
    <div>
      <p className="mb-1 text-[11px] text-slate-600">
        {required && <span className="mr-1 text-red-500">*</span>}
        {label}
      </p>
      {children}
    </div>
  );
}

/** The "Variables → Requester Details" panel shown on requested items and catalog tasks. */
export function RequesterDetails({
  values,
  onChange,
}: {
  values: RitmFields;
  /** Omit for the read-only copy shown on a catalog task. */
  onChange?: (k: keyof RitmFields) => (v: string) => void;
}) {
  const [open, setOpen] = useState(true);
  const field = (k: 'requestedBy' | 'requestedFor' | 'contact' | 'phone' | 'email' | 'location') =>
    onChange ? (
      <input value={values[k]} onChange={(e) => onChange(k)(e.target.value)} className={control} />
    ) : (
      <ReadOnly value={values[k]} />
    );

  return (
    <div className="px-4 pb-4">
      <h2 className="mb-2 text-[13px] font-semibold text-slate-800">Variables</h2>
      <div className="rounded border border-slate-300">
        <button
          type="button"
          onClick={() => setOpen((o) => !o)}
          className="flex w-full items-center gap-2 border-b border-slate-200 bg-slate-50 px-3 py-2 text-left text-[13px] font-semibold text-slate-800"
        >
          <span className="flex h-4 w-4 items-center justify-center rounded border border-slate-400 text-[12px] leading-none">{open ? '−' : '+'}</span>
          Requester Details
        </button>
        {open && (
          <div className="grid gap-x-10 gap-y-3 p-4 lg:grid-cols-2">
            <Stacked label="Requested By" required>
              {field('requestedBy')}
            </Stacked>
            <Stacked label="Requested For" required>
              {field('requestedFor')}
            </Stacked>
            <Stacked label="Primary Contact">{field('contact')}</Stacked>
            <Stacked label="Primary Contact Phone">{field('phone')}</Stacked>
            <Stacked label="Primary Contact Email">{field('email')}</Stacked>
            <Stacked label="Location">{field('location')}</Stacked>
          </div>
        )}
      </div>
    </div>
  );
}
