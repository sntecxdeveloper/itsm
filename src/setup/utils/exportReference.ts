import { getAssignmentGroups, getGroupPeople } from '../../api/groupApi';
import { loadCategories } from '../../utils/categoryStore';
import { loadCategoryGroups, subcategoryKey } from '../../utils/categoryGroupStore';
import { getIssues } from '../../utils/issueStore';
import { downloadWorkbook, type Sheet } from '../../utils/xlsx';
import type { GroupPersonMember } from '../../types/group';

/**
 * Downloads the lists the incident form uses as one Excel file: categories with their subcategories, items and group,
 * the impact x urgency priority table, the assignment groups and the technicians in them. What is on the screen is
 * exported, so edits made in Setup are included.
 */
export async function exportReferenceWorkbook(): Promise<void> {
  const { LEVELS, derivedPriority } = await import('../../incident/pages/IncidentFormPage');
  const groupOf = loadCategoryGroups();

  const categories: Sheet = { name: 'Categories', header: ['Category', 'Subcategory', 'Item', 'Assignment group'], rows: [], widths: [22, 28, 48, 24] };
  for (const c of loadCategories()) {
    for (const sub of c.subcategories) {
      const group = groupOf[subcategoryKey(c.name, sub)] ?? groupOf[c.name] ?? '';
      for (const item of getIssues(sub)) categories.rows.push([c.name, sub, item, group]);
    }
  }

  const priority: Sheet = { name: 'Priority', header: ['Impact', 'Urgency', 'Priority'], rows: [], widths: [16, 16, 16] };
  for (const impact of LEVELS) for (const urgency of LEVELS) priority.rows.push([impact, urgency, derivedPriority(impact, urgency) ?? '']);

  const groups = await getAssignmentGroups();
  const people = await Promise.all(groups.map((g) => getGroupPeople(g.id, 'TECHNICIAN').catch(() => [] as GroupPersonMember[])));

  const groupSheet: Sheet = {
    name: 'Assignment groups',
    header: ['Group', 'Status', 'Technicians', 'Description'],
    rows: groups.map((g, i) => [g.name, g.status === 'INACTIVE' ? 'Inactive' : 'Active', people[i].map((p) => p.fullName || p.username).join(', '), g.description ?? '']),
    widths: [28, 12, 60, 40],
  };

  const byUser = new Map<string, { person: GroupPersonMember; groups: string[] }>();
  groups.forEach((g, i) => {
    for (const p of people[i]) {
      const entry = byUser.get(p.username) ?? { person: p, groups: [] };
      entry.groups.push(g.name);
      byUser.set(p.username, entry);
    }
  });
  const technicians: Sheet = {
    name: 'Technicians',
    header: ['Username', 'Full name', 'Email', 'Role', 'Enabled', 'Assignment groups'],
    rows: [...byUser.values()]
      .sort((a, b) => a.person.username.localeCompare(b.person.username))
      .map(({ person, groups: names }) => [person.username, person.fullName ?? '', person.email ?? '', person.role ?? '', person.enabled ? 'Yes' : 'No', names.join(', ')]),
    widths: [20, 26, 32, 14, 10, 40],
  };

  downloadWorkbook('itsm-categories-groups-technicians.xlsx', [categories, priority, groupSheet, technicians]);
}
