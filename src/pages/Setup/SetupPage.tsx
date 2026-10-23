import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { setupPageOf, useSetupAccess } from '../../utils/access';

interface SetupItem {
  label: string;
  /** Omitted when the page doesn't exist in DEX yet; rendered muted. */
  to?: string;
}

interface SetupSection {
  title: string;
  items: SetupItem[];
}

const i = (label: string, to?: string): SetupItem => ({ label, to });

const SECTIONS: SetupSection[] = [
  {
    title: 'Instance Configurations',
    items: [i('Instance Settings', '/settings'), i('Regions', '/groups?view=REGION'), i('Sites', '/groups?view=SITE'), i('Operational Hours'), i('Holiday Groups'), i('Unavailability Types'), i('Departments', '/groups?view=DEPARTMENT'), i('Currency'), i('Organization Roles')],
  },
  { title: 'Users & Permissions', items: [i('Roles', '/setup/roles'), i('Users', '/admin/users'), i('Groups', '/groups?view=ALL'), i('User Groups', '/groups?view=USERS'), i('Technician Groups', '/groups?view=TECHNICIANS'), i('Fine-Grained Access'), i('Privacy Settings', '/security')] },
  { title: 'Mail Settings', items: [i('Mail Server Settings', '/setup/mail/server'), i('Mail Addresses', '/setup/mail/addresses'), i('Mail Box', '/setup/mail/mailbox'), i('Mail Filter', '/setup/mail/filter'), i('Email Command', '/setup/mail/commands')] },
  {
    title: 'Customization',
    items: [i('Categories & Subcategories', '/setup/categories'), i('Incident Form', '/setup/incident-form'), i('Helpdesk', '/tickets'), i('Problem Management', '/tickets/problems'), i('Change Management', '/tickets/change-requests'), i('Release Management'), i('Asset Management', '/assets'), i('CMDB'), i('Additional Fields'), i('Checklists & Items'), i('Announcement'), i('Maintenance Management'), i('Custom Configuration'), i('Subform Types')],
  },
  {
    title: 'Templates & Forms',
    items: [i('Service Category', '/setup/service-category'), i('Incident Template', '/tickets/incidents/new'), i('Problem Template', '/tickets/problems/create-new'), i('Change Template', '/setup/automation/notification-templates'), i('Release Template', '/setup/automation/notification-templates'), i('Reply Template', '/setup/automation/notification-templates'), i('Resolution Template', '/setup/automation/notification-templates'), i('Announcement Template', '/setup/automation/notification-templates'), i('Form Rules'), i('Custom Scripts', '/scripts')],
  },
  { title: 'Layouts', items: [i('Details Page Layouts')] },
  {
    title: 'Automation',
    items: [i('Business Rules', '/setup/automation/business-rules'), i('Service Level Agreements', '/setup/automation/sla'), i('Life Cycles', '/setup/automation/life-cycles'), i('Triggers'), i('Schedules'), i('Custom Actions'), i('Notification Templates', '/setup/automation/notification-templates'), i('Notification Rules', '/setup/automation/notification-rules'), i('Alert Rules', '/alerts'),i('Closure Rules'), i('Delegation'), i('Technician Auto Assign'), i('Asset Auto Assign'), i('Workflows'), i('Conflict Detection')],
  },
  { title: 'Probes & Discovery', items: [i('Probe'), i('Agent Configurations', '/devices'), i('Credential Library'), i('Domain Scan'), i('Network Scan'), i('Settings', '/settings')] },
  { title: 'User Survey', items: [i('Survey Settings'), i('Survey Templates'), i('Survey Rules'), i('Ad Hoc Survey'), i('Survey Results')] },
  { title: 'Data Administration', items: [i('Data Archive', '/deleted'), i('Sandbox'), i('Audit Log', '/audit-logs'), i('System Log'), i('Telephony Log'), i('Import Data'), i('Export Data', '/reports')] },
  { title: 'General Settings', items: [i('Advanced Portal Settings'), i('Requester Portal'), i('Theme Settings'), i('Navigation & Footer Settings'), i('Cloud Attachments'), i('Approval Settings')] },
  { title: 'Apps & Add-ons', items: [i('Chat Settings', '/setup/chat'), i('Analytics Plus', '/reports'), i('Projects'), i('SMS Settings'), i('Integrations'), i('Extensions')] },
  { title: 'Developer Space', items: [i('Custom Menu'), i('Custom Widgets'), i('Custom Functions'), i('Connections'), i('Global Variables'), i('Custom Modules')] },
];

/** Heroicons outline paths, keyed by section title. */
const SECTION_ICONS: Record<string, string> = {
  'Instance Configurations': 'M3.75 21h16.5M4.5 3h15M5.25 3v18m13.5-18v18M9 6.75h1.5m-1.5 3h1.5m-1.5 3h1.5m3-6H15m-1.5 3H15m-1.5 3H15M9 21v-3.375c0-.621.504-1.125 1.125-1.125h3.75c.621 0 1.125.504 1.125 1.125V21',
  'Users & Permissions': 'M9 12.75 11.25 15 15 9.75m-3-7.036A11.959 11.959 0 0 1 3.598 6 11.99 11.99 0 0 0 3 9.749c0 5.592 3.824 10.29 9 11.623 5.176-1.332 9-6.03 9-11.622 0-1.31-.21-2.571-.598-3.751h-.152c-3.196 0-6.1-1.248-8.25-3.285Z',
  'Mail Settings': 'M21.75 6.75v10.5a2.25 2.25 0 0 1-2.25 2.25h-15a2.25 2.25 0 0 1-2.25-2.25V6.75m19.5 0A2.25 2.25 0 0 0 19.5 4.5h-15a2.25 2.25 0 0 0-2.25 2.25m19.5 0v.243a2.25 2.25 0 0 1-1.07 1.916l-7.5 4.615a2.25 2.25 0 0 1-2.36 0L3.32 8.91a2.25 2.25 0 0 1-1.07-1.916V6.75',
  'Customization': 'M9.53 16.122a3 3 0 0 0-5.78 1.128 2.25 2.25 0 0 1-2.4 2.245 4.5 4.5 0 0 0 8.4-2.245c0-.399-.078-.78-.22-1.128Zm0 0a15.998 15.998 0 0 0 3.388-1.62m-5.043-.025a15.994 15.994 0 0 1 1.622-3.395m3.42 3.42a15.995 15.995 0 0 0 4.764-4.648l3.876-5.814a1.151 1.151 0 0 0-1.597-1.597L14.146 6.32a15.996 15.996 0 0 0-4.649 4.763m3.42 3.42a6.776 6.776 0 0 0-3.42-3.42',
  'Categories & Subcategories': 'M9.568 3H5.25A2.25 2.25 0 0 0 3 5.25v4.318c0 .597.237 1.17.659 1.591l9.581 9.581c.699.699 1.78.872 2.607.33a18.095 18.095 0 0 0 5.223-5.223c.542-.827.369-1.908-.33-2.607L11.16 3.66A2.25 2.25 0 0 0 9.568 3ZM6 6h.008v.008H6V6Z',
  'Templates & Forms': 'M19.5 14.25v-2.625a3.375 3.375 0 0 0-3.375-3.375h-1.5A1.125 1.125 0 0 1 13.5 7.125v-1.5a3.375 3.375 0 0 0-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 0 0-9-9Z',
  'Layouts': 'M3.75 6A2.25 2.25 0 0 1 6 3.75h2.25A2.25 2.25 0 0 1 10.5 6v2.25a2.25 2.25 0 0 1-2.25 2.25H6a2.25 2.25 0 0 1-2.25-2.25V6ZM3.75 15.75A2.25 2.25 0 0 1 6 13.5h2.25a2.25 2.25 0 0 1 2.25 2.25V18a2.25 2.25 0 0 1-2.25 2.25H6A2.25 2.25 0 0 1 3.75 18v-2.25ZM13.5 6a2.25 2.25 0 0 1 2.25-2.25H18A2.25 2.25 0 0 1 20.25 6v2.25A2.25 2.25 0 0 1 18 10.5h-2.25a2.25 2.25 0 0 1-2.25-2.25V6ZM13.5 15.75a2.25 2.25 0 0 1 2.25-2.25H18a2.25 2.25 0 0 1 2.25 2.25V18A2.25 2.25 0 0 1 18 20.25h-2.25A2.25 2.25 0 0 1 13.5 18v-2.25Z',
  'Automation': 'm3.75 13.5 10.5-11.25L12 10.5h8.25L9.75 21.75 12 13.5H3.75Z',
  'Probes & Discovery': 'm21 21-5.197-5.197m0 0A7.5 7.5 0 1 0 5.196 5.196a7.5 7.5 0 0 0 10.607 10.607Z',
  'User Survey': 'M9 12h3.75M9 15h3.75M9 18h3.75m3 .75H18a2.25 2.25 0 0 0 2.25-2.25V6.108c0-1.135-.845-2.098-1.976-2.192a48.424 48.424 0 0 0-1.123-.08m-5.801 0c-.065.21-.1.433-.1.664 0 .414.336.75.75.75h4.5a.75.75 0 0 0 .75-.75 2.25 2.25 0 0 0-.1-.664m-5.8 0A2.251 2.251 0 0 1 13.5 2.25H15c1.012 0 1.867.668 2.15 1.586m-5.8 0c-.376.023-.75.05-1.124.08C9.095 4.01 8.25 4.973 8.25 6.108V8.25m0 0H4.875c-.621 0-1.125.504-1.125 1.125v11.25c0 .621.504 1.125 1.125 1.125h9.75c.621 0 1.125-.504 1.125-1.125V9.375c0-.621-.504-1.125-1.125-1.125H8.25Z',
  'Data Administration': 'M20.25 6.375c0 2.278-3.694 4.125-8.25 4.125S3.75 8.653 3.75 6.375m16.5 0c0-2.278-3.694-4.125-8.25-4.125S3.75 4.097 3.75 6.375m16.5 0v11.25c0 2.278-3.694 4.125-8.25 4.125s-8.25-1.847-8.25-4.125V6.375m16.5 0v3.75m-16.5-3.75v3.75m16.5 0v3.75C20.25 16.153 16.556 18 12 18s-8.25-1.847-8.25-4.125v-3.75m16.5 0c0 2.278-3.694 4.125-8.25 4.125s-8.25-1.847-8.25-4.125',
  'General Settings': 'M10.5 6h9.75M10.5 6a1.5 1.5 0 1 1-3 0m3 0a1.5 1.5 0 1 0-3 0M3.75 6H7.5m3 12h9.75m-9.75 0a1.5 1.5 0 0 1-3 0m3 0a1.5 1.5 0 0 0-3 0m-3.75 0H7.5m9-6h3.75m-3.75 0a1.5 1.5 0 0 1-3 0m3 0a1.5 1.5 0 0 0-3 0m-9.75 0h9.75',
  'Apps & Add-ons': 'M14.25 6.087c0-.355.186-.676.401-.959.221-.29.349-.634.349-1.003 0-1.036-1.007-1.875-2.25-1.875s-2.25.84-2.25 1.875c0 .369.128.713.349 1.003.215.283.401.604.401.959v0a.64.64 0 0 1-.657.643 48.39 48.39 0 0 1-4.163-.3c.186 1.613.293 3.25.315 4.907a.656.656 0 0 1-.658.663v0c-.355 0-.676-.186-.959-.401a1.647 1.647 0 0 0-1.003-.349c-1.036 0-1.875 1.007-1.875 2.25s.84 2.25 1.875 2.25c.369 0 .713-.128 1.003-.349.283-.215.604-.401.959-.401v0c.31 0 .555.26.532.57a48.039 48.039 0 0 1-.642 5.056c1.518.19 3.058.309 4.616.354a.64.64 0 0 0 .657-.643v0c0-.355-.186-.676-.401-.959a1.647 1.647 0 0 1-.349-1.003c0-1.035 1.008-1.875 2.25-1.875 1.243 0 2.25.84 2.25 1.875 0 .369-.128.713-.349 1.003-.215.283-.4.604-.4.959v0c0 .333.277.599.61.58a48.1 48.1 0 0 0 5.427-.63 48.05 48.05 0 0 0 .582-4.717.532.532 0 0 0-.533-.57v0c-.355 0-.676.186-.959.401-.29.221-.634.349-1.003.349-1.035 0-1.875-1.007-1.875-2.25s.84-2.25 1.875-2.25c.37 0 .713.128 1.003.349.283.215.604.401.96.401v0a.656.656 0 0 0 .658-.663 48.422 48.422 0 0 0-.37-5.36c-1.886.342-3.81.574-5.766.689a.578.578 0 0 1-.61-.58v0Z',
  'Developer Space': 'M17.25 6.75 22.5 12l-5.25 5.25m-10.5 0L1.5 12l5.25-5.25m7.5-3-4.5 16.5',
};

/** Setup landing page: every section as a card with its options listed inside. */
export default function SetupPage() {
  const [query, setQuery] = useState('');
  const q = query.trim().toLowerCase();
  const { isAdmin, level } = useSetupAccess();

  const sections = useMemo(
    () =>
      SECTIONS.map((s) => {
        // Someone who is not an administrator sees only the Setup sections their role was given.
        const allowed = isAdmin ? s.items : s.items.filter((it) => {
          const page = setupPageOf(it.to);
          return page !== undefined && level(page) !== 'HIDDEN';
        });
        return {
          ...s,
          items: q && !s.title.toLowerCase().includes(q) ? allowed.filter((it) => it.label.toLowerCase().includes(q)) : allowed,
        };
      }).filter((s) => s.items.length > 0),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [q, isAdmin, level],
  );

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <h1 className="text-base font-semibold text-slate-900">Setup</h1>
        <div className="relative ml-auto w-full max-w-xs">
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search in Setup"
            aria-label="Search in Setup"
            className="h-8 w-full rounded-lg border border-slate-300 bg-white pl-3 pr-8 text-xs text-slate-800 outline-none placeholder:text-slate-400 focus:border-primary-500 focus:ring-1 focus:ring-primary-500"
          />
          <svg className="pointer-events-none absolute right-2 top-2 h-4 w-4 text-slate-400" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" d="m21 21-5.197-5.197m0 0A7.5 7.5 0 1 0 5.196 5.196a7.5 7.5 0 0 0 10.607 10.607Z" />
          </svg>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {sections.map((s) => (
          <section key={s.title} className="rounded-xl border border-slate-200 bg-white p-4">
            <div className="mb-3 flex items-center gap-2.5 border-b border-slate-100 pb-3">
              <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary-50 text-primary-600">
                <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" d={SECTION_ICONS[s.title]} />
                </svg>
              </span>
              <h2 className="min-w-0 flex-1 truncate text-[13px] font-semibold text-slate-900">{s.title}</h2>
              <span className="text-[11px] text-slate-400">{s.items.length}</span>
            </div>
            <ul className="space-y-0.5">
              {s.items.map((it) => (
                <li key={it.label}>
                  {it.to ? (
                    <Link to={it.to} className="flex items-center justify-between rounded-md px-2 py-1.5 text-xs text-slate-700 hover:bg-primary-50 hover:text-primary-700">
                      <span>{it.label}</span>
                      <span className="text-slate-300" aria-hidden>›</span>
                    </Link>
                  ) : (
                    <div title="Not available yet" className="flex cursor-default items-center justify-between rounded-md px-2 py-1.5 text-xs text-slate-400">
                      <span>{it.label}</span>
                      <span className="text-[9px] uppercase tracking-wide">Soon</span>
                    </div>
                  )}
                </li>
              ))}
            </ul>
          </section>
        ))}
        {sections.length === 0 && <p className="text-xs text-slate-500">No setup options match "{query}".</p>}
      </div>
    </div>
  );
}
