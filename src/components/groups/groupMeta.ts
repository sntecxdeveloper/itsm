import type { GroupHealth, GroupKind, GroupSection, GroupType } from '../../types/group';

export const GROUP_COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#06b6d4', '#ec4899', '#64748b'];

export const KINDS: GroupKind[] = ['DEPARTMENT', 'SITE', 'REGION', 'TEAM', 'PROJECT', 'CUSTOMER', 'CUSTOM'];

export const KIND_INFO: Record<GroupKind, { label: string; plural: string }> = {
  DEPARTMENT: { label: 'Department', plural: 'Departments' },
  SITE: { label: 'Site / location', plural: 'Sites' },
  REGION: { label: 'Region', plural: 'Regions' },
  TEAM: { label: 'Team', plural: 'Teams' },
  PROJECT: { label: 'Project', plural: 'Projects' },
  CUSTOMER: { label: 'Customer', plural: 'Customers' },
  CUSTOM: { label: 'Other', plural: 'Other' },
};

/** The three things inside a group, in the order they are shown. */
export const SECTIONS: GroupSection[] = ['DEVICE', 'TECHNICIAN', 'USER'];

export const SECTION_INFO: Record<GroupSection, { title: string; one: string; many: string; blurb: string }> = {
  DEVICE: { title: 'Devices', one: 'device', many: 'devices', blurb: 'The computers that belong to this group' },
  TECHNICIAN: { title: 'Technicians', one: 'technician', many: 'technicians', blurb: 'Who handles the issues of these devices' },
  USER: { title: 'Users', one: 'user', many: 'users', blurb: 'The people who use these devices' },
};

export const HEALTH_INFO: Record<GroupHealth, { label: string; text: string; ring: string }> = {
  HEALTHY: { label: 'Healthy', text: 'text-emerald-700', ring: 'bg-emerald-50 ring-emerald-200' },
  WARNING: { label: 'Needs attention', text: 'text-amber-700', ring: 'bg-amber-50 ring-amber-200' },
  CRITICAL: { label: 'Critical', text: 'text-red-700', ring: 'bg-red-50 ring-red-200' },
  EMPTY: { label: 'No devices', text: 'text-slate-500', ring: 'bg-slate-50 ring-slate-200' },
};

export const OPERATOR_LABEL: Record<string, string> = {
  equals: 'is',
  not_equals: 'is not',
  contains: 'contains',
  not_contains: 'does not contain',
  starts_with: 'starts with',
  ends_with: 'ends with',
  gt: 'is more than',
  gte: 'is at least',
  lt: 'is less than',
  lte: 'is at most',
  is_true: 'is on / yes',
  is_false: 'is off / no',
};

export const EDITOR_ROLES = ['ROLE_ADMIN', 'ROLE_OPERATOR'];

export function canEditGroups(role?: string | null): boolean {
  return !!role && EDITOR_ROLES.includes(role);
}

/** Two letters for the coloured badge: "Finance Laptops" gives "FL". */
export function initials(name: string): string {
  const words = name.trim().split(/\s+/).filter(Boolean);
  if (words.length === 0) return '?';
  if (words.length === 1) return words[0].slice(0, 2).toUpperCase();
  return (words[0][0] + words[1][0]).toUpperCase();
}

/** "3 technicians" / "1 technician". */
export function countLabel(section: GroupSection, n: number): string {
  return `${n} ${n === 1 ? SECTION_INFO[section].one : SECTION_INFO[section].many}`;
}

/** What a group holds, in the order they are shown. */
export const GROUP_TYPES: GroupType[] = ['TECHNICIAN', 'USER', 'DEVICE'];

export const TYPE_INFO: Record<
  GroupType,
  { label: string; plural: string; blurb: string; example: string; chip: string; tile: string; icon: string; sections: GroupSection[] }
> = {
  TECHNICIAN: {
    label: 'Technician Group',
    plural: 'Technician groups',
    blurb: 'Technicians who handle one kind of ticket. Assign an incident to the group and any member can handle it.',
    example: 'Software, Hardware, Network',
    chip: 'bg-sky-50 text-sky-700 ring-sky-200',
    tile: 'border-sky-300 bg-sky-50/70 ring-sky-200',
    icon: 'M15 19.128a9.38 9.38 0 0 0 2.625.372 9.337 9.337 0 0 0 4.121-.952 4.125 4.125 0 0 0-7.533-2.493M15 19.128v-.003c0-1.113-.285-2.16-.786-3.07M15 19.128v.106A12.318 12.318 0 0 1 8.624 21c-2.331 0-4.512-.645-6.374-1.766l-.001-.109a6.375 6.375 0 0 1 11.964-3.07M12 6.375a3.375 3.375 0 1 1-6.75 0 3.375 3.375 0 0 1 6.75 0Zm8.25 2.25a2.625 2.625 0 1 1-5.25 0 2.625 2.625 0 0 1 5.25 0Z',
    sections: ['TECHNICIAN'],
  },
  USER: {
    label: 'User Group',
    plural: 'User groups',
    blurb: 'People who share a department or role, for approvals and access.',
    example: 'Finance, HR',
    chip: 'bg-emerald-50 text-emerald-700 ring-emerald-200',
    tile: 'border-emerald-300 bg-emerald-50/70 ring-emerald-200',
    icon: 'M15.75 6a3.75 3.75 0 1 1-7.5 0 3.75 3.75 0 0 1 7.5 0ZM4.501 20.118a7.5 7.5 0 0 1 14.998 0A17.933 17.933 0 0 1 12 21.75c-2.676 0-5.216-.584-7.499-1.632Z',
    sections: ['USER'],
  },
  DEVICE: {
    label: 'Device Group',
    plural: 'Device groups',
    blurb: 'Computers managed together, with the technicians and users who look after them.',
    example: 'Finance laptops, Server room',
    chip: 'bg-amber-50 text-amber-700 ring-amber-200',
    tile: 'border-amber-300 bg-amber-50/70 ring-amber-200',
    icon: 'M9 17.25v1.007a3 3 0 0 1-.879 2.122L7.5 21h9l-.621-.621A3 3 0 0 1 15 18.257V17.25m6-12V15a2.25 2.25 0 0 1-2.25 2.25H5.25A2.25 2.25 0 0 1 3 15V5.25m18 0A2.25 2.25 0 0 0 18.75 3H5.25A2.25 2.25 0 0 0 3 5.25m18 0V12a2.25 2.25 0 0 1-2.25 2.25H5.25A2.25 2.25 0 0 1 3 12V5.25',
    sections: ['DEVICE'],
  },
};

/** The sections to show inside a group: a technician group only holds technicians; a general group shows all three. */
export function sectionsFor(type?: GroupType | null): GroupSection[] {
  return type ? TYPE_INFO[type].sections : SECTIONS;
}
