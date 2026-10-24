import type { MasterCategory, PriorityLevel } from '../../api/masterApi';
import type { SheetRows } from '../../utils/xlsxRead';

/**
 * Setup → Categories → Import from Excel. The workbook is the one "Export to Excel" writes, with these sheets (names and column
 * headings are matched without regard to case, and the columns can be in any order):
 *   Categories        Category, Subcategory, Item, Assignment group
 *   Priority          Impact, Urgency, Priority
 *   Assignment groups Group, Description
 *   Technicians       Username, Assignment groups (comma separated)
 * A sheet that is not in the file is left alone.
 */

export interface ImportPlan {
  /** False when the file has no Categories sheet: the saved categories are then left as they are. */
  hasCategories: boolean;
  categories: MasterCategory[];
  /** Null when the file has no Priority sheet. */
  priority: PriorityLevel[] | null;
  groups: { name: string; description: string }[];
  technicians: { username: string; groups: string[] }[];
  /** What must be fixed before the file can be imported. */
  problems: string[];
  /** Worth knowing, but the import can go ahead. */
  warnings: string[];
}

const same = (a: string, b: string) => a.trim().toLowerCase() === b.trim().toLowerCase();

function sheet(sheets: SheetRows, name: string): string[][] | undefined {
  const key = Object.keys(sheets).find((k) => same(k, name));
  return key ? sheets[key] : undefined;
}

/** The data rows of a sheet as objects keyed by the (lower-cased) heading. Empty rows are skipped. */
function records(rows: string[][] | undefined, required: string[], problems: string[], label: string): Record<string, string>[] {
  if (!rows) return [];
  const header = (rows[0] ?? []).map((h) => (h ?? '').trim().toLowerCase());
  const missing = required.filter((r) => !header.includes(r));
  if (missing.length) {
    problems.push(`The ${label} sheet needs the column${missing.length > 1 ? 's' : ''} ${missing.map((m) => `"${m}"`).join(', ')}.`);
    return [];
  }
  return rows
    .slice(1)
    .map((row) => Object.fromEntries(header.map((h, i) => [h, (row[i] ?? '').trim()])))
    .filter((r) => Object.values(r).some(Boolean));
}

/** The common value of a list when every entry is the same non-empty one, else ''. */
const common = (values: string[]) => (values.length > 0 && values.every((v) => v && same(v, values[0])) ? values[0] : '');

/** Reads the sheets into what would be imported. `existingGroups` are the assignment group names the server already has. */
export function parseReference(sheets: SheetRows, existingGroups: string[] = []): ImportPlan {
  const problems: string[] = [];
  const warnings: string[] = [];

  // Categories: a row is a category, a category and subcategory, or a category, subcategory and item.
  const catRows = records(sheet(sheets, 'Categories'), ['category'], problems, 'Categories');
  const byCategory = new Map<string, { name: string; rows: Record<string, string>[] }>();
  catRows.forEach((r, i) => {
    if (!r['category']) return problems.push(`Categories sheet, row ${i + 2}: the Category is empty.`);
    if (r['item'] && !r['subcategory']) return problems.push(`Categories sheet, row ${i + 2}: "${r['item']}" has an Item but no Subcategory.`);
    const key = r['category'].toLowerCase();
    const entry = byCategory.get(key) ?? { name: r['category'], rows: [] };
    entry.rows.push(r);
    byCategory.set(key, entry);
  });
  const categories: MasterCategory[] = [...byCategory.values()].map(({ name, rows }) => {
    // The group on a row is the group of its subcategory; one every row of the category agrees on becomes the category's own.
    const categoryGroup = common(rows.map((r) => r['assignment group'] ?? ''));
    const subs = new Map<string, { name: string; group: string; items: string[] }>();
    for (const r of rows) {
      if (!r['subcategory']) continue;
      const key = r['subcategory'].toLowerCase();
      const sub = subs.get(key) ?? { name: r['subcategory'], group: r['assignment group'] ?? '', items: [] };
      if (r['item'] && !sub.items.some((i) => same(i, r['item']))) sub.items.push(r['item']);
      subs.set(key, sub);
    }
    return {
      name,
      group: categoryGroup || (rows.length === 1 && !rows[0]['subcategory'] ? rows[0]['assignment group'] || null : null),
      subcategories: [...subs.values()].map((s) => ({ name: s.name, group: s.group && !same(s.group, categoryGroup) ? s.group : null, items: s.items })),
    };
  });

  // Priority table.
  const prioritySheet = sheet(sheets, 'Priority');
  let priority: PriorityLevel[] | null = null;
  if (prioritySheet) {
    const seen = new Set<string>();
    priority = [];
    records(prioritySheet, ['impact', 'urgency', 'priority'], problems, 'Priority').forEach((r, i) => {
      if (!r['impact'] || !r['urgency'] || !r['priority']) return problems.push(`Priority sheet, row ${i + 2}: Impact, Urgency and Priority are all needed.`);
      const key = `${r['impact'].toLowerCase()}|${r['urgency'].toLowerCase()}`;
      if (seen.has(key)) return problems.push(`Priority sheet, row ${i + 2}: "${r['impact']}" with "${r['urgency']}" is listed twice.`);
      seen.add(key);
      priority!.push({ impact: r['impact'], urgency: r['urgency'], priority: r['priority'] });
    });
    if (priority.length === 0 && !problems.some((p) => p.startsWith('The Priority sheet'))) priority = null;
  }

  // Assignment groups and their technicians.
  const groups: ImportPlan['groups'] = [];
  for (const r of records(sheet(sheets, 'Assignment groups'), ['group'], problems, 'Assignment groups')) {
    if (r['group'] && !groups.some((g) => same(g.name, r['group']))) groups.push({ name: r['group'], description: r['description'] ?? '' });
  }
  const technicians: ImportPlan['technicians'] = [];
  for (const r of records(sheet(sheets, 'Technicians'), ['username'], problems, 'Technicians')) {
    if (!r['username'] || technicians.some((t) => same(t.username, r['username']))) continue;
    technicians.push({ username: r['username'], groups: (r['assignment groups'] ?? '').split(/[,;]/).map((g) => g.trim()).filter(Boolean) });
  }

  // Every group the file names should exist or be created by it.
  const known = [...existingGroups, ...groups.map((g) => g.name)];
  const missing = new Set<string>();
  const used = [...categories.flatMap((c) => [c.group, ...c.subcategories.map((s) => s.group)]), ...technicians.flatMap((t) => t.groups)];
  for (const name of used) if (name && !known.some((k) => same(k, name))) missing.add(name);
  if (missing.size) {
    warnings.push(`These assignment groups do not exist yet and are not in the Assignment groups sheet, so they are skipped: ${[...missing].join(', ')}.`);
  }
  if (!sheet(sheets, 'Categories') && !prioritySheet && groups.length === 0 && technicians.length === 0) {
    problems.push('The file has none of the sheets Categories, Priority, Assignment groups or Technicians. Use the file from "Export to Excel".');
  }
  return { hasCategories: !!sheet(sheets, 'Categories'), categories, priority, groups, technicians, problems, warnings };
}

/** Adds the incoming categories to the current ones: same names are merged, a group in the file replaces the saved one. */
export function mergeCategories(current: MasterCategory[], incoming: MasterCategory[]): MasterCategory[] {
  const out = current.map((c) => ({ ...c, subcategories: c.subcategories.map((s) => ({ ...s, items: [...s.items] })) }));
  for (const inc of incoming) {
    let cat = out.find((c) => same(c.name, inc.name));
    if (!cat) out.push((cat = { name: inc.name, group: inc.group, subcategories: [] }));
    else if (inc.group) cat.group = inc.group;
    for (const s of inc.subcategories) {
      let sub = cat.subcategories.find((x) => same(x.name, s.name));
      if (!sub) cat.subcategories.push((sub = { name: s.name, group: s.group, items: [] }));
      else if (s.group) sub.group = s.group;
      for (const item of s.items) if (!sub.items.some((i) => same(i, item))) sub.items.push(item);
    }
  }
  return out;
}
