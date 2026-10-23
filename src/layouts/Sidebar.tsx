import { AccessContext, useSetupAccess } from '../utils/access';
import { useContext, useState, type ReactNode } from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import { AnimatePresence, motion } from 'framer-motion';
import { useAppSelector } from '../hooks/useAppSelector';
import { useAppDispatch } from '../hooks/useAppDispatch';
import { setSidebarOpen, toggleSidebarCollapse } from '../store/uiSlice';
import { NAV_ITEMS, ADMIN_NAV_ITEMS, NAV_PERMISSIONS } from '../utils/constants';
import { Logo } from '../components/ui/Logo';
import { INCIDENT_VIEWS } from '../utils/incidentViews';
import { arrange, useLayoutArea } from '../hooks/useLayoutArea';
import ArrangeModal from '../components/customization/ArrangeModal';
import WhyThis from '../components/customization/WhyThis';
import ThemeModal from '../components/customization/ThemeModal';
import { MENU_PAGE, useAccess } from '../context/AccessContext';

/* ------------------------------------------------------------------ */
/* Icons (heroicons outline, stroke 1.5)                               */
/* ------------------------------------------------------------------ */
const iconMap: Record<string, ReactNode> = {
  customize: (
    <svg className="h-[18px] w-[18px]" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" d="M10.5 6h9.75M10.5 6a1.5 1.5 0 1 1-3 0m3 0a1.5 1.5 0 1 0-3 0M3.75 6H7.5m3 12h9.75m-9.75 0a1.5 1.5 0 0 1-3 0m3 0a1.5 1.5 0 0 0-3 0m-3.75 0H7.5m9-6h3.75m-3.75 0a1.5 1.5 0 0 1-3 0m3 0a1.5 1.5 0 0 0-3 0m-9.75 0h9.75" />
    </svg>
  ),
  groups: (
    <svg className="h-[18px] w-[18px]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M18 18.72a9.094 9.094 0 0 0 3.741-.479 3 3 0 0 0-4.682-2.72m.94 3.198.001.031c0 .225-.012.447-.037.666A11.944 11.944 0 0 1 12 21c-2.17 0-4.207-.576-5.963-1.584A6.062 6.062 0 0 1 6 18.719m12 0a5.971 5.971 0 0 0-.941-3.197m0 0A5.995 5.995 0 0 0 12 12.75a5.995 5.995 0 0 0-5.058 2.772m0 0a3 3 0 0 0-4.681 2.72 8.986 8.986 0 0 0 3.74.477m.94-3.197a5.971 5.971 0 0 0-.94 3.197M15 6.75a3 3 0 1 1-6 0 3 3 0 0 1 6 0Zm6 3a2.25 2.25 0 1 1-4.5 0 2.25 2.25 0 0 1 4.5 0Zm-13.5 0a2.25 2.25 0 1 1-4.5 0 2.25 2.25 0 0 1 4.5 0Z" />
    </svg>
  ),
  dashboard: (
    <svg className="h-[18px] w-[18px]" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 6A2.25 2.25 0 0 1 6 3.75h2.25A2.25 2.25 0 0 1 10.5 6v2.25a2.25 2.25 0 0 1-2.25 2.25H6a2.25 2.25 0 0 1-2.25-2.25V6Zm0 9.75A2.25 2.25 0 0 1 6 13.5h2.25a2.25 2.25 0 0 1 2.25 2.25V18a2.25 2.25 0 0 1-2.25 2.25H6A2.25 2.25 0 0 1 3.75 18v-2.25Zm9.75 0A2.25 2.25 0 0 1 16 13.5h2.25a2.25 2.25 0 0 1 2.25 2.25V18a2.25 2.25 0 0 1-2.25 2.25H16a2.25 2.25 0 0 1-2.25-2.25v-2.25Zm9.75 0A2.25 2.25 0 0 1 21 13.5h2.25a2.25 2.25 0 0 1 2.25 2.25V18a2.25 2.25 0 0 1-2.25 2.25H21a2.25 2.25 0 0 1-2.25-2.25v-2.25Z" />
    </svg>
  ),
  devices: (
    <svg className="h-[18px] w-[18px]" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" d="M9 17.25v1.007a3 3 0 0 1-.879 2.122L7.5 21h9l-.621-.621A3 3 0 0 1 15 18.257V17.25m6-12V15a2.25 2.25 0 0 1-2.25 2.25H5.25A2.25 2.25 0 0 1 3 15V5.25m18 0A2.25 2.25 0 0 0 18.75 3H5.25A2.25 2.25 0 0 0 3 5.25m18 0v.243a2.25 2.25 0 0 1-1.07 1.916l-7.5 4.615a2.25 2.25 0 0 1-2.36 0L3.32 7.41A2.25 2.25 0 0 1 2.25 5.494V5.25" />
    </svg>
  ),
  deleted: (
    <svg className="h-[18px] w-[18px]" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 12.76c0 1.6 1.123 2.994 2.707 3.227 1.087.16 2.185.283 3.293.369V21l4.076-4.076a1.526 1.526 0 0 1 1.037-.443 48.282 48.282 0 0 0 5.68-.494c1.584-.233 2.707-1.626 2.707-3.228V6.741c0-1.602-1.123-2.995-2.707-3.228A48.394 48.394 0 0 0 12 3c-2.392 0-4.744.175-7.043.513C3.373 3.746 2.25 5.14 2.25 6.741v6.018Z" />
      <path strokeLinecap="round" strokeLinejoin="round" d="m9 9 6 6m0-6-6 6" />
    </svg>
  ),
  issues: (
    <svg className="h-[18px] w-[18px]" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126ZM12 15.75h.007v.008H12v-.008Z" />
    </svg>
  ),
  remediation: (
    <svg className="h-[18px] w-[18px]" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" d="M11.42 15.17 17.25 21A2.652 2.652 0 0 0 21 17.25l-5.877-5.877M11.42 15.17l2.496-3.03c.317-.384.74-.626 1.208-.766M11.42 15.17l-4.655 5.653a2.548 2.548 0 1 1-3.586-3.586l6.837-5.63m5.108-.233c.55-.164 1.163-.188 1.743-.14a4.5 4.5 0 0 0 4.486-6.336l-3.276 3.277a3.004 3.004 0 0 1-2.25-2.25l3.276-3.276a4.5 4.5 0 0 0-6.336 4.486c.091 1.076-.071 2.264-.904 2.95l-.102.085m-1.745 1.437L5.909 7.5H4.5L2.25 3.75l1.5-1.5L7.5 4.5v1.409l4.26 4.26m-1.745 1.437 1.745-1.437m6.615 8.206L15.75 15.75M4.867 19.125h.008v.008h-.008v-.008Z" />
    </svg>
  ),
  execute: (
    <svg className="h-[18px] w-[18px]" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" d="M5.25 5.653c0-.856.917-1.398 1.667-.986l11.54 6.347a1.125 1.125 0 0 1 0 1.972l-11.54 6.347a1.125 1.125 0 0 1-1.667-.986V5.653Z" />
    </svg>
  ),
  knowledge: (
    <svg className="h-[18px] w-[18px]" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 6.042A8.967 8.967 0 0 0 6 3.75c-1.052 0-2.062.18-3 .512v14.25A8.987 8.987 0 0 1 6 18c2.305 0 4.408.867 6 2.292m0-14.25a8.966 8.966 0 0 1 6-2.292c1.052 0 2.062.18 3 .512v14.25A8.987 8.987 0 0 0 18 18a8.967 8.967 0 0 0-6 2.292m0-14.25v14.25" />
    </svg>
  ),
  aichat: (
    <svg className="h-[18px] w-[18px]" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" d="M9.813 15.904 9 18.75l-.813-2.846a4.5 4.5 0 0 0-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 0 0 3.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 0 0 3.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 0 0-3.09 3.09ZM18.259 8.715 18 9.75l-.259-1.035a3.375 3.375 0 0 0-2.455-2.456L14.25 6l1.036-.259a3.375 3.375 0 0 0 2.455-2.456L18 2.25l.259 1.035a3.375 3.375 0 0 0 2.455 2.456L21.75 6l-1.036.259a3.375 3.375 0 0 0-2.455 2.456Z" />
    </svg>
  ),
  aitasks: (
    <svg className="h-[18px] w-[18px]" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75 11.25 15 15 9.75M21 12c0 1.268-.63 2.39-1.593 3.068a3.745 3.745 0 0 1-1.043 3.296 3.745 3.745 0 0 1-3.296 1.043A3.745 3.745 0 0 1 12 21c-1.268 0-2.39-.63-3.068-1.593a3.746 3.746 0 0 1-3.296-1.043 3.745 3.745 0 0 1-1.043-3.296A3.745 3.745 0 0 1 3 12c0-1.268.63-2.39 1.593-3.068a3.745 3.745 0 0 1 1.043-3.296 3.746 3.746 0 0 1 3.296-1.043A3.746 3.746 0 0 1 12 3c1.268 0 2.39.63 3.068 1.593a3.746 3.746 0 0 1 3.296 1.043 3.746 3.746 0 0 1 1.043 3.296A3.745 3.745 0 0 1 21 12Z" />
    </svg>
  ),
  tickets: (
    <svg className="h-[18px] w-[18px]" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 6v.75m0 3v.75m0 3v.75m0 3V18m-9-5.25h5.25M7.5 15h3M3.375 5.25c-.621 0-1.125.504-1.125 1.125v3.026a2.999 2.999 0 0 1 0 5.198v3.026c0 .621.504 1.125 1.125 1.125h17.25c.621 0 1.125-.504 1.125-1.125v-3.026a2.999 2.999 0 0 1 0-5.198V6.375c0-.621-.504-1.125-1.125-1.125H3.375Z" />
    </svg>
  ),
  assets: (
    <svg className="h-[18px] w-[18px]" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" d="m20.25 7.5-.625 10.632a2.25 2.25 0 0 1-2.247 2.118H6.622a2.25 2.25 0 0 1-2.247-2.118L3.75 7.5M10 11.25h4M3.375 7.5h17.25c.621 0 1.125-.504 1.125-1.125v-1.5c0-.621-.504-1.125-1.125-1.125H3.375c-.621 0-1.125.504-1.125 1.125v1.5c0 .621.504 1.125 1.125 1.125Z" />
    </svg>
  ),
  reports: (
    <svg className="h-[18px] w-[18px]" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" d="M3 13.125C3 12.504 3.504 12 4.125 12h2.25c.621 0 1.125.504 1.125 1.125v6.75C7.5 20.496 6.996 21 6.375 21h-2.25A1.125 1.125 0 0 1 3 19.875v-6.75ZM9.75 8.625c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125v11.25c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 0 1-1.125-1.125V8.625ZM16.5 4.125c0-.621.504-1.125 1.125-1.125h2.25C20.496 3 21 3.504 21 4.125v15.75c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 0 1-1.125-1.125V4.125Z" />
    </svg>
  ),
  alerts: (
    <svg className="h-[18px] w-[18px]" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" d="M14.857 17.082a23.848 23.848 0 0 0 5.454-1.31A8.967 8.967 0 0 1 18 9.75V9A6 6 0 0 0 6 9v.75a8.967 8.967 0 0 1-2.312 6.022c1.733.64 3.56 1.085 5.455 1.31m5.714 0a24.255 24.255 0 0 1-5.714 0m5.714 0a3 3 0 1 1-5.714 0" />
    </svg>
  ),
  audit: (
    <svg className="h-[18px] w-[18px]" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 0 0-3.375-3.375h-1.5A1.125 1.125 0 0 1 13.5 7.125v-1.5a3.375 3.375 0 0 0-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 0 0-9-9Z" />
    </svg>
  ),
  security: (
    <svg className="h-[18px] w-[18px]" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 10.5V6.75a4.5 4.5 0 1 0-9 0v3.75m-.75 11.25h10.5a2.25 2.25 0 0 0 2.25-2.25v-6.75a2.25 2.25 0 0 0-2.25-2.25H6.75a2.25 2.25 0 0 0-2.25 2.25v6.75a2.25 2.25 0 0 0 2.25 2.25Z" />
    </svg>
  ),
  organizations: (
    <svg className="h-[18px] w-[18px]" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 21h19.5m-18-18v18m10.5-18v18m6-13.5V21M6.75 6.75h.75m-.75 3h.75m-.75 3h.75m3-6h.75m-.75 3h.75m-.75 3h.75M6.75 21v-3.375c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125V21M3 3h12m-.75 4.5H21m-3.75 3.75h.008v.008h-.008v-.008Zm0 3h.008v.008h-.008v-.008Zm0 3h.008v.008h-.008v-.008Z" />
    </svg>
  ),
  users: (
    <svg className="h-[18px] w-[18px]" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" d="M15 19.128a9.38 9.38 0 0 0 2.625.372 9.337 9.337 0 0 0 4.121-.952 4.125 4.125 0 0 0-7.533-2.493M15 19.128v-.003c0-1.113-.285-2.16-.786-3.07M15 19.128v.106A12.318 12.318 0 0 1 8.624 21c-2.331 0-4.512-.645-6.374-1.766l-.001-.109a6.375 6.375 0 0 1 11.964-3.07M12 6.375a3.375 3.375 0 1 1-6.75 0 3.375 3.375 0 0 1 6.75 0Zm8.25 2.25a2.625 2.625 0 1 1-5.25 0 2.625 2.625 0 0 1 5.25 0Z" />
    </svg>
  ),
  settings: (
    <svg className="h-[18px] w-[18px]" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" d="M9.594 3.94c.09-.542.56-.94 1.11-.94h2.593c.55 0 1.02.398 1.11.94l.213 1.281c.063.374.313.686.645.87.074.04.147.083.22.127.325.196.72.257 1.075.124l1.217-.456a1.125 1.125 0 0 1 1.37.49l1.296 2.247a1.125 1.125 0 0 1-.26 1.431l-1.003.827c-.293.241-.438.613-.43.992a7.723 7.723 0 0 1 0 .255c-.008.378.137.75.43.991l1.004.827c.424.35.534.955.26 1.43l-1.298 2.247a1.125 1.125 0 0 1-1.369.491l-1.217-.456c-.355-.133-.75-.072-1.076.124a6.47 6.47 0 0 1-.22.128c-.331.183-.581.495-.644.869l-.213 1.281c-.09.543-.56.94-1.11.94h-2.594c-.55 0-1.019-.398-1.11-.94l-.213-1.281c-.062-.374-.312-.686-.644-.87a6.52 6.52 0 0 1-.22-.127c-.325-.196-.72-.257-1.076-.124l-1.217.456a1.125 1.125 0 0 1-1.369-.49l-1.297-2.247a1.125 1.125 0 0 1 .26-1.431l1.004-.827c.292-.24.437-.613.43-.991a6.932 6.932 0 0 1 0-.255c.007-.38-.138-.751-.43-.992l-1.004-.827a1.125 1.125 0 0 1-.26-1.43l1.297-2.247a1.125 1.125 0 0 1 1.37-.491l1.216.456c.356.133.751.072 1.076-.124.072-.044.146-.086.22-.128.332-.183.582-.495.644-.869l.214-1.28Z" />
      <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z" />
    </svg>
  ),
};

/* ------------------------------------------------------------------ */
/* Sections                                                            */
/* ------------------------------------------------------------------ */

const GROUPS: { label: string; iconKeys: string[] }[] = [
  { label: 'Fleet', iconKeys: ['dashboard', 'devices', 'groups', 'customize', 'issues', 'deleted', 'remediation', 'execute'] },
  { label: 'Workspace', iconKeys: ['aichat', 'aitasks', 'knowledge', 'tickets', 'assets', 'reports', 'alerts'] },
  { label: 'System', iconKeys: ['security', 'audit'] },
];

interface SubItem {
  path: string;
  label: string;
  depth?: number;
  end?: boolean;
  /** Only listed while the current path starts with this prefix. */
  group?: string;
}

const ITSM_SUBNAV: SubItem[] = [
  { path: '/tickets/incidents', label: 'Incidents', end: true },
  ...INCIDENT_VIEWS.map(
    (v): SubItem => ({ path: `/tickets/incidents/${v.slug}`, label: v.label, depth: 1, group: '/tickets/incidents' }),
  ),
  { path: '/tickets/service-requests', label: 'Service Requests', end: true },
  ...(
    [
      ['catalog', 'Service Catalog'],
      ['requests', 'All Requests'],
      ['create-new', 'Create New'],
    ] as const
  ).map(([slug, label]): SubItem => ({ path: `/tickets/service-requests/${slug}`, label, depth: 1, group: '/tickets/service-requests' })),
  { path: '/tickets/problems', label: 'Problems', end: true },
  ...(
    [
      ['create-new', 'Create New'],
      ['assigned-to-me', 'Assigned to me'],
      ['open', 'Open'],
      ['open-unassigned', 'Open - Unassigned'],
      ['resolved', 'Resolved'],
      ['risk-accepted', 'Risk Accepted'],
      ['all', 'All'],
      ['overview', 'Overview'],
    ] as const
  ).map(([slug, label]): SubItem => ({ path: `/tickets/problems/${slug}`, label, depth: 1, group: '/tickets/problems' })),
  { path: '/tickets/change-requests', label: 'Changes' },
  { path: '/tickets/groups', label: 'ITSM Groups' },
  { path: '/setup', label: 'Setup', end: true },
];

/** Sub-items that own a nested group, toggled by a chevron. */
const NESTED_PARENTS = ['/tickets/incidents', '/tickets/problems', '/tickets/service-requests'];

const ASSET_SUBNAV: SubItem[] = [
  { path: '/assets', label: 'All Assets', end: true },
  { path: '/assets/computers', label: 'Computers' },
  { path: '/assets/servers', label: 'Servers', depth: 1 },
  { path: '/assets/workstations', label: 'Workstations', depth: 1 },
  { path: '/assets/printers', label: 'Printers' },
  { path: '/assets/network', label: 'Network Devices' },
  { path: '/assets/monitors', label: 'Monitors' },
  { path: '/assets/software', label: 'Software' },
  { path: '/assets/others', label: 'Others' },
];

const SUBMENUS: Record<string, { label: string; items: SubItem[] }> = {
  '/tickets': { label: 'ITSM', items: ITSM_SUBNAV },
  '/assets': { label: 'Assets', items: ASSET_SUBNAV },
};

function NavBadge({ count }: { count: number }) {
  if (count <= 0) return null;
  return (
    <span className="ml-auto inline-flex h-[18px] min-w-[18px] items-center justify-center rounded-full bg-red-50 px-1.5 font-mono text-[10px] font-semibold text-red-600 ring-1 ring-inset ring-red-200">
      {count > 99 ? '99+' : count}
    </span>
  );
}

function NavItem({
  item,
  collapsed,
  badge = 0,
  onClick,
}: {
  item: { path: string; label: string; icon: string };
  collapsed: boolean;
  badge?: number;
  onClick: () => void;
}) {
  return (
    <NavLink
      key={item.path}
      to={item.path}
      onClick={onClick}
      title={collapsed ? item.label : undefined}
      className={({ isActive }) =>
        [
          'group relative flex items-center gap-3 rounded-lg px-3 py-[9px] text-[12px] font-medium transition-all duration-150',
          collapsed ? 'justify-center' : '',
          isActive
            ? 'bg-primary-100 text-primary-700 ring-1 ring-inset ring-primary-500/25'
            : 'text-slate-500 hover:bg-slate-100/70 hover:text-slate-900',
        ].join(' ')
      }
    >
      {({ isActive }) => (
        <>
          {/* active rail */}
          <span
            className={`absolute left-0 top-1/2 h-5 w-[3px] -translate-y-1/2 rounded-r-full bg-primary-500 transition-all duration-200 ${
              isActive ? 'opacity-100 shadow-[0_0_10px_rgba(2,132,199,0.4)]' : 'opacity-0'
            }`}
          />
          <span className={`shrink-0 transition-colors ${isActive ? 'text-primary-600' : ''}`}>
            {iconMap[item.icon]}
          </span>
          {!collapsed && (
            <>
              <span className="truncate whitespace-nowrap">{item.label}</span>
              <NavBadge count={badge} />
            </>
          )}
        </>
      )}
    </NavLink>
  );
}

function SectionLabel({ title, collapsed }: { title: string; collapsed: boolean }) {
  if (collapsed) return <div className="mx-4 my-3 h-px bg-line" />;
  return (
    <p className="px-3 pb-1.5 pt-5 text-[10px] font-semibold uppercase tracking-[0.16em] text-slate-600">
      {title}
    </p>
  );
}

/* ------------------------------------------------------------------ */

/** The role-system page behind a menu item, where the menu path is not simply the page's name. */
const NAV_PAGE_KEY: Record<string, string> = {
  '/audit-logs': 'audit',
  '/remediation/execute': 'remediation',
};

export default function Sidebar() {
  const dispatch = useAppDispatch();
  const { pathname } = useLocation();
  // Open by default on any ITSM page; the arrow lets the user fold it at any time.
  const [menuOpen, setMenuOpen] = useState<Record<string, boolean>>(() =>
    Object.fromEntries(Object.keys(SUBMENUS).map((p) => [p, pathname.startsWith(p)])),
  );
  // Nested groups (e.g. Problems) follow the current path until the user toggles them.
  const [groupOpen, setGroupOpen] = useState<Record<string, boolean>>({});
  const { sidebarCollapsed, sidebarOpen } = useAppSelector((state) => state.ui);
  const { user } = useAppSelector((state) => state.auth);
  const { issues } = useAppSelector((state) => state.dashboard);
  const isAdmin = user?.role === 'ROLE_ADMIN';
  const { hasAnySetup } = useSetupAccess();
  const rawAccess = useContext(AccessContext);

  // Defensive: issues defaults to [] in dashboardSlice's initialState, but a
  // fresh deployment's very first render (before the dashboard fetch even
  // starts) hit this as undefined in production - guard here rather than
  // rely solely on the slice's default, since this crashed the whole app via
  // ErrorBoundary on the login screen itself where the redirect hadn't even
  // resolved yet.
  const openIssueCount = (issues ?? []).filter((i) => i.status === 'OPEN').length;

  const byPath = Object.fromEntries(NAV_ITEMS.map((i) => [i.icon, i]));

  const access = useAccess();
  const visible = (icon: string) => {
    const item = byPath[icon];
    if (!item) return null;
    // Pages of the role matrix follow the person's role; the rest (ITSM, customization) keep their fixed rules.
    const page = MENU_PAGE[icon];
    if (page) return access.page(page) === 'HIDDEN' ? null : item;
    const allowedRoles = NAV_PERMISSIONS[item.path];
    if (allowedRoles && user?.role && !allowedRoles.includes(user.role)) return null;
    // A page an administrator hid from this person's role (Setup → Roles) is left out of the menu.
    const key = NAV_PAGE_KEY[item.path] ?? item.path.replace(/^\//, '');
    if (!isAdmin && rawAccess?.pages[key] === 'HIDDEN') return null;
    return item;
  };

  // The menu can be rearranged per person (or per group, role or for everyone): area "sidebar", keys are the icon names.
  const menuLayout = useLayoutArea('sidebar');
  const [arranging, setArranging] = useState(false);
  const [coloring, setColoring] = useState(false);
  const menuItems = GROUPS.flatMap((g) => g.iconKeys.map(visible).filter((i): i is { path: string; label: string; icon: string } => !!i))
    .map((i) => ({ key: i.icon, label: i.label, fixed: i.icon === 'dashboard' || (!!MENU_PAGE[i.icon] && access.isRequired(MENU_PAGE[i.icon])) }));

  const closeMobile = () => {
    if (window.innerWidth < 1024) dispatch(setSidebarOpen(false));
  };

  return (
    <>
      {/* Mobile overlay */}
      <AnimatePresence>
        {sidebarOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-30 bg-black/60 backdrop-blur-sm lg:hidden"
            onClick={() => dispatch(setSidebarOpen(false))}
          />
        )}
      </AnimatePresence>

      <aside
        className={[
          'fixed inset-y-0 left-0 z-40 flex h-dvh w-64 flex-col border-r border-line bg-[var(--dex-sidebar-bg,#ffffff)]',
          'transition-[width,transform] duration-200 ease-out',
          sidebarCollapsed ? 'lg:w-[72px]' : 'lg:w-64',
          sidebarOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0',
        ].join(' ')}
      >
        {/* Brand */}
        <div
          className={`flex h-16 shrink-0 items-center border-b border-line px-4 ${
            sidebarCollapsed ? 'lg:justify-center lg:px-0' : ''
          }`}
        >
          {sidebarCollapsed ? <Logo iconOnly size="md" /> : <Logo size="md" />}
        </div>

        {/* Nav */}
        <nav className="flex-1 overflow-y-auto overflow-x-hidden px-3 py-2 scrollbar-thin">
          {GROUPS.map((group) => {
            const items = arrange(
              group.iconKeys
                .map(visible)
                .filter((i): i is { path: string; label: string; icon: string } => !!i)
                .map((i) => ({ ...i, key: i.icon })),
              menuLayout.arrangement && { ...menuLayout.arrangement, hidden: menuLayout.arrangement.hidden.filter((k) => k !== 'dashboard' && !(MENU_PAGE[k] && access.isRequired(MENU_PAGE[k]))) },
            );
            if (items.length === 0) return null;
            return (
              <div key={group.label}>
                <SectionLabel title={group.label} collapsed={sidebarCollapsed} />
                <div className="space-y-0.5">
                  {items.map((item) => (
                    <div key={item.path} className="relative">
                      <NavItem
                        item={item}
                        collapsed={sidebarCollapsed}
                        badge={item.path === '/issues' ? openIssueCount : 0}
                        onClick={closeMobile}
                      />
                      {SUBMENUS[item.path] && !sidebarCollapsed && (
                        <button
                          type="button"
                          onClick={() => setMenuOpen((m) => ({ ...m, [item.path]: !m[item.path] }))}
                          aria-label={`${menuOpen[item.path] ? 'Collapse' : 'Expand'} ${SUBMENUS[item.path].label} menu`}
                          aria-expanded={!!menuOpen[item.path]}
                          className="absolute right-2 top-[7px] flex h-6 w-6 items-center justify-center rounded-md text-slate-400 hover:bg-slate-200/60 hover:text-slate-700"
                        >
                          <svg
                            className={`h-3.5 w-3.5 transition-transform duration-200 ${menuOpen[item.path] ? 'rotate-180' : ''}`}
                            viewBox="0 0 24 24"
                            fill="none"
                            stroke="currentColor"
                            strokeWidth={2}
                          >
                            <path strokeLinecap="round" strokeLinejoin="round" d="m6 9 6 6 6-6" />
                          </svg>
                        </button>
                      )}
                      {SUBMENUS[item.path] && !sidebarCollapsed && menuOpen[item.path] && (
                        <div className="ml-5 mt-0.5 space-y-0.5 border-l border-line pl-3">
                          {SUBMENUS[item.path].items.filter((sub) => (sub.path !== '/setup' || hasAnySetup) && (!sub.group || (groupOpen[sub.group] ?? pathname.startsWith(sub.group)))).map((sub) => (
                            <div key={sub.path} className="relative">
                              <NavLink
                                to={sub.path}
                                end={sub.end}
                                onClick={closeMobile}
                                style={sub.depth ? { marginLeft: sub.depth * 12 } : undefined}
                                className={({ isActive }) =>
                                  `block rounded-md px-2.5 py-1.5 text-[11.5px] transition-colors ${
                                    isActive
                                      ? 'bg-primary-50 font-medium text-primary-700'
                                      : 'text-slate-500 hover:bg-slate-100/70 hover:text-slate-900'
                                  }`
                                }
                              >
                                {sub.label}
                              </NavLink>
                              {NESTED_PARENTS.includes(sub.path) && (
                                <button
                                  type="button"
                                  onClick={() => setGroupOpen((g) => ({ ...g, [sub.path]: !(g[sub.path] ?? pathname.startsWith(sub.path)) }))}
                                  aria-label={`Toggle ${sub.label} menu`}
                                  className="absolute right-1 top-1 flex h-5 w-5 items-center justify-center rounded text-slate-400 hover:bg-slate-200/60 hover:text-slate-700"
                                >
                                  <svg
                                    className={`h-3 w-3 transition-transform ${(groupOpen[sub.path] ?? pathname.startsWith(sub.path)) ? 'rotate-180' : ''}`}
                                    viewBox="0 0 24 24"
                                    fill="none"
                                    stroke="currentColor"
                                    strokeWidth={2}
                                  >
                                    <path strokeLinecap="round" strokeLinejoin="round" d="m6 9 6 6 6-6" />
                                  </svg>
                                </button>
                              )}
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            );
          })}

          {/* Administration (admin only) */}
          {isAdmin && (
            <div>
              <SectionLabel title="Administration" collapsed={sidebarCollapsed} />
              <div className="space-y-0.5">
                {ADMIN_NAV_ITEMS.map((item) => (
                  <NavItem key={item.path} item={item} collapsed={sidebarCollapsed} onClick={closeMobile} />
                ))}
              </div>
            </div>
          )}
        </nav>

        {/* User + collapse */}
        <div className="shrink-0 border-t border-line p-3">
          {!sidebarCollapsed ? (
            <div className="flex items-center gap-2.5 rounded-lg bg-slate-50 px-2.5 py-2 ring-1 ring-inset ring-line">
              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-gradient-to-br from-primary-500 to-primary-800 font-display text-sm font-semibold text-white">
                {user?.username?.charAt(0).toUpperCase() || 'U'}
              </div>
              <div className="min-w-0 flex-1">
                <p className="truncate text-[13px] font-medium text-slate-800">
                  {user?.username || 'User'}
                </p>
                <p className="truncate text-[10px] text-slate-500">{user?.role.replace('ROLE_', '') || ''}</p>
              </div>
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 shadow-[0_0_6px_rgba(52,211,153,0.9)]" />
            </div>
          ) : (
            <div className="flex justify-center py-1">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-primary-500 to-primary-800 font-display text-sm font-semibold text-white">
                {user?.username?.charAt(0).toUpperCase() || 'U'}
              </div>
            </div>
          )}

          {!sidebarCollapsed && (
            <div className="mt-2 flex items-center justify-center gap-1">
              {menuLayout.level !== 'NONE' && (
                <>
                  <button
                    type="button"
                    onClick={() => setArranging(true)}
                    aria-label="Customize the menu"
                    className="rounded-lg p-1.5 text-slate-400 transition-colors hover:bg-slate-100/70 hover:text-slate-700"
                    title={menuLayout.lockedByAdmin ? 'An administrator set this menu' : 'Choose which tabs show, and in which order'}
                  >
                    <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M10.5 6h9.75M10.5 6a1.5 1.5 0 1 1-3 0m3 0a1.5 1.5 0 1 0-3 0M3.75 6H7.5m3 12h9.75m-9.75 0a1.5 1.5 0 0 1-3 0m3 0a1.5 1.5 0 0 0-3 0m-3.75 0H7.5m9-6h3.75m-3.75 0a1.5 1.5 0 0 1-3 0m3 0a1.5 1.5 0 0 0-3 0m-9.75 0h9.75" />
                    </svg>
                  </button>
                  <button
                    type="button"
                    onClick={() => setColoring(true)}
                    aria-label="Colors"
                    title="Colors"
                    className="rounded-lg p-1.5 text-slate-400 transition-colors hover:bg-slate-100/70 hover:text-slate-700"
                  >
                    <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M4.098 19.902a3.75 3.75 0 0 0 5.304 0l6.401-6.402M6.75 21A3.75 3.75 0 0 1 3 17.25V4.125C3 3.504 3.504 3 4.125 3h5.25c.621 0 1.125.504 1.125 1.125v4.072M6.75 21a3.75 3.75 0 0 0 3.75-3.75V8.197M6.75 21h13.125c.621 0 1.125-.504 1.125-1.125v-5.25c0-.621-.504-1.125-1.125-1.125h-4.072M10.5 8.197l2.88-2.88c.438-.439 1.15-.439 1.59 0l3.712 3.713c.44.44.44 1.152 0 1.59l-2.879 2.88M6.75 17.25h.008v.008H6.75v-.008Z" />
                    </svg>
                  </button>
                </>
              )}
              <WhyThis area="sidebar" />
            </div>
          )}

          {/* Collapse toggle — desktop only */}
          <button
            onClick={() => dispatch(toggleSidebarCollapse())}
            className="mt-2 hidden w-full items-center justify-center gap-1.5 rounded-lg py-1.5 text-[11px] font-medium text-slate-500 transition-colors hover:bg-slate-100/70 hover:text-slate-700 lg:flex"
            title={sidebarCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          >
            <svg
              className={`h-3.5 w-3.5 transition-transform duration-200 ${sidebarCollapsed ? 'rotate-180' : ''}`}
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth={2}
            >
              <path strokeLinecap="round" strokeLinejoin="round" d="m18 15-6-6-6 6" />
            </svg>
            {!sidebarCollapsed && 'Collapse'}
          </button>
        </div>
      </aside>
      {coloring && <ThemeModal onClose={() => setColoring(false)} />}
      {arranging && <ArrangeModal area="sidebar" title="Customize the menu" items={menuItems} onClose={() => setArranging(false)} />}
    </>
  );
}
