import { addGroupMembers, createGroup, getGroups } from '../../api/groupApi';
import { getMaster, saveMaster, type Master } from '../../api/masterApi';
import { mergeCategories, type ImportPlan } from './parseReference';

export { parseReference, mergeCategories, type ImportPlan } from './parseReference';

export interface ImportResult {
  categories: number;
  subcategories: number;
  items: number;
  groupsCreated: number;
  membersAdded: number;
  /** Things that did not go in: a technician who is not a DEX user, a group that could not be created. */
  skipped: string[];
  master: Master;
}

/**
 * Saves the plan: first the groups and their technicians (so the names categories use exist), then the lists.
 * Groups are only ever added. `mode` decides whether the categories replace the saved ones or are added to them.
 */
export async function applyImport(plan: ImportPlan, mode: 'replace' | 'add'): Promise<ImportResult> {
  const skipped: string[] = [];
  const existing = await getGroups();
  const idOf = new Map(existing.map((g) => [g.name.toLowerCase(), g.id]));
  let groupsCreated = 0;
  for (const g of plan.groups) {
    if (idOf.has(g.name.toLowerCase())) continue;
    try {
      const created = await createGroup({ name: g.name, description: g.description || undefined, kind: 'TEAM', membershipMode: 'STATIC', type: 'TECHNICIAN' });
      idOf.set(g.name.toLowerCase(), created.summary.id);
      groupsCreated++;
    } catch (e) {
      skipped.push(`Group "${g.name}": ${e instanceof Error ? e.message : 'could not be created'}`);
    }
  }

  const byGroup = new Map<string, string[]>();
  for (const t of plan.technicians) for (const g of t.groups) byGroup.set(g.toLowerCase(), [...(byGroup.get(g.toLowerCase()) ?? []), t.username]);
  let membersAdded = 0;
  for (const [name, usernames] of byGroup) {
    const id = idOf.get(name);
    if (id === undefined) continue; // already reported as a missing group
    try {
      const result = await addGroupMembers(id, 'TECHNICIAN', usernames);
      membersAdded += result.added;
      for (const s of result.skipped) skipped.push(`Technician "${s}" in "${name}" was not added (not a DEX user, or already there).`);
    } catch (e) {
      skipped.push(`Technicians of "${name}": ${e instanceof Error ? e.message : 'could not be added'}`);
    }
  }

  const saved = plan.hasCategories && mode === 'replace' ? [] : (await getMaster()).categories;
  const categories = !plan.hasCategories ? saved : mode === 'add' ? mergeCategories(saved, plan.categories) : plan.categories;
  const master = await saveMaster({ categories, priorityMatrix: plan.priority ?? undefined });
  return {
    categories: master.categories.length,
    subcategories: master.categories.reduce((n, c) => n + c.subcategories.length, 0),
    items: master.categories.reduce((n, c) => n + c.subcategories.reduce((m, s) => m + s.items.length, 0), 0),
    groupsCreated,
    membersAdded,
    skipped,
    master,
  };
}
